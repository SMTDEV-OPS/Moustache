import { UserModel, IUser } from "../../models/user";
import { RoleModel } from "../../models/role";
import { UserRoleModel } from "../../models/userRole";
import { EmployeeGroupModel } from "../../models/employeeGroup";
import { IProfile } from "../../models/profile";
import { logger } from "../../config/logger";
import { AuthUser } from "../../middleware/auth";
import { ObjectId } from "mongoose";

// Permission format: resource:action:scope
// Example: leads:read:region

export class AccessControlService {
    /**
     * Parse a permission string into its components (Zoho dot notation)
     */
    static parsePermission(permission: string) {
        // e.g. "leads.view.own" -> resource: leads, action: view, scope: own
        // e.g. "leads.manage"  -> resource: leads, action: manage, scope: global
        // e.g. "users.manage"  -> resource: users, action: manage, scope: global
        const parts = permission.split(".");
        return {
            resource: parts[0],
            action: parts[1],
            scope: parts[2] || "global",
        };
    }

    /**
     * Check if a user has permission to perform an action on a resource,
     * considering the specific data context (target resource).
     */
    static async hasPermission(
        user: AuthUser & { permissions?: string[]; descendants?: string[] },
        resource: string,
        action: string,
        dataContext?: {
            ownerId?: string | ObjectId;
            regionId?: string | ObjectId;
            teamType?: string;
            [key: string]: any;
        }
    ): Promise<boolean> {
        if (!user || (!user.permissions && !user.isAdmin)) return false;

        // 1. Super Admin Check
        if (user.isAdmin || user.permissions?.includes("users.manage")) return true;

        if (!user.permissions) return false;

        // 2. Check for matching permissions
        // We look for permissions that match "resource.action" or "resource.manage"
        const relevantPermissions = user.permissions.filter(p => {
            const parsed = this.parsePermission(p);
            return parsed.resource === resource && (parsed.action === action || parsed.action === "manage");
        });

        if (relevantPermissions.length === 0) return false;

        // 3. Evaluate Scopes (If any permission grants access, return true)
        for (const perm of relevantPermissions) {
            const { scope, action: permAction } = this.parsePermission(perm);

            // "manage" action implicitly has global scope unless otherwise specified.
            if (permAction === "manage" && scope === "global") {
                return true;
            }

            switch (scope) {
                case "global":
                case "all":
                    return true; // Global access allows everything

                case "region":
                    if (!dataContext?.regionId) continue; // Cannot validate without context
                    const userRegions = await this.getUserRegions(user.id);
                    if (userRegions.map(r => r.toString()).includes(dataContext.regionId.toString())) {
                        return true;
                    }
                    break;



                case "own":
                    // If no data context is provided, we can only answer True 
                    // if it's a structural check (e.g. Can I show the create button?)
                    // For actual CRUD operations on specific rows, a context MUST be provided
                    // For structural checks the frontend usually doesn't pass a dataContext
                    if (!dataContext) {
                        return true;
                    }
                    if (!dataContext?.ownerId) continue;

                    // 1. Direct ownership
                    if (dataContext.ownerId.toString() === user.id) return true;

                    // 2. Subordinate ownership
                    const descendants = user.descendants || await this.getDescendants(user.id);
                    if (descendants.includes(dataContext.ownerId.toString())) {
                        return true;
                    }
                    break;
            }
        }

        return false;
    }

    /**
     * Helper to get User's regions (caching could be added here)
     */
    private static async getUserRegions(userId: string): Promise<string[]> {
        const user = await UserModel.findById(userId).select("regions").lean();
        return user?.regions?.map(r => r.toString()) || [];
    }


    /**
     * Get all subordinates (recursive) for a user.
     * Returns array of User IDs.
     */
    static async getDescendants(managerId: string): Promise<string[]> {
        // We look for direct reports, then recursively find their reports
        const subordinates = await UserModel.find({ reportsTo: managerId }).select("_id").lean();

        const descendantIds: string[] = [];

        for (const subordinate of subordinates) {
            const subordinateId = subordinate._id.toString();
            descendantIds.push(subordinateId);

            // Recursively find descendants of this subordinate
            const subDescendants = await this.getDescendants(subordinateId);
            descendantIds.push(...subDescendants);
        }

        return descendantIds;
    }

    /**
     * Rebuild hierarchy path for a user (and their children potentially)
     * This should be called when 'reportsTo' changes.
     */
    static async rebuildHierarchy(userId: string) {
        const user = await UserModel.findById(userId);
        if (!user) return;

        let path = "/";
        if (user.reportsTo) {
            const manager = await UserModel.findById(user.reportsTo);
            if (manager && manager.hierarchyPath) {
                path = `${manager.hierarchyPath}${manager._id}/`;
            } else if (manager) {
                // Fallback if manager has no path (shouldn't happen if root is set right)
                path = `/${manager._id}/`;
            }
        }

        user.hierarchyPath = path;
        await user.save();

        // Recursively update children
        const children = await UserModel.find({ reportsTo: userId });
        for (const child of children) {
            await this.rebuildHierarchy(child.id);
        }
    }

    /**
     * Calculate effective permissions for a user based on their Profile
     * In the Zoho model, Profiles define feature access (what you can do).
     */
    static async getUserPermissions(userId: string | ObjectId): Promise<{ permissions: string[], isAdmin: boolean }> {
        const user = await UserModel.findById(userId).populate<{ profileId: IProfile }>("profileId");

        if (!user || user.status !== "ACTIVE") {
            return { permissions: [], isAdmin: false };
        }

        let isAdmin = false;
        const permsSet = new Set<string>();

        // New system: Check Profile
        if (user.profileId) {
            const profile = user.profileId;

            console.log("DEBUG AccessControlService user profile:", profile.name);

            // Handle legacy flat permissions array if it still exists before migration
            if ((profile as any).permissions && Array.isArray((profile as any).permissions)) {
                for (const p of (profile as any).permissions) {
                    permsSet.add(p);
                }
            }

            // New structured permissions: Module Permissions
            if (profile.modulePermissions && Array.isArray(profile.modulePermissions)) {
                for (const mp of profile.modulePermissions) {
                    // Create legacy flat equivalents for backward compatibility in routing middleware
                    if (mp.view) permsSet.add(`${mp.module}.read`);
                    if (mp.create) permsSet.add(`${mp.module}.create`);
                    if (mp.edit) permsSet.add(`${mp.module}.update`);
                    if (mp.edit || mp.create) permsSet.add(`${mp.module}.write`);
                    if (mp.delete) permsSet.add(`${mp.module}.delete`);

                    // Specific edge-case: If they have everything, give them manage to be safe
                    if (mp.view && mp.create && mp.edit && mp.delete) {
                        permsSet.add(`${mp.module}.manage`);
                    }
                }
            }

            // New structured permissions: Setup Permissions
            if (profile.setupPermissions && Array.isArray(profile.setupPermissions)) {
                for (const sp of profile.setupPermissions) {
                    if (sp.enabled) {
                        permsSet.add(sp.key); // e.g., "users.manage", "roles.manage"
                    }
                }
            }

            if (profile.name?.toLowerCase() === "admin" || profile.isSystemProfile) {
                isAdmin = true;
                // Admins effectively have settings.manage
                permsSet.add("settings.manage");
                permsSet.add("users.manage");
            }
        } else {
            console.log("DEBUG AccessControlService user has no profileId", userId);
        }

        console.log("DEBUG AccessControlService returning:", { isAdmin, permsCount: permsSet.size });
        return {
            permissions: Array.from(permsSet),
            isAdmin
        };
    }
}
