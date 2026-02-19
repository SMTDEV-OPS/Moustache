import { UserModel, IUser } from "../../models/user";
import { RoleModel } from "../../models/role";
import { UserRoleModel } from "../../models/userRole";
import { EmployeeGroupModel } from "../../models/employeeGroup";
import { logger } from "../../config/logger";
import { AuthUser } from "../../middleware/auth";
import { ObjectId } from "mongoose";

// Permission format: resource:action:scope
// Example: leads:read:region

export class AccessControlService {
    /**
     * Parse a permission string into its components
     */
    static parsePermission(permission: string) {
        const parts = permission.split(":");
        return {
            resource: parts[0],
            action: parts[1],
            scope: parts[2] || "global", // Default to global if not specified? Or restrictive? 
            // Actually, usually 3 parts are required for this new system.
            // But for legacy support, we might see 2 parts.
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
        if (!user || !user.permissions) return false;

        // 1. Super Admin Check
        if (user.isAdmin || user.permissions.includes("*:*:*")) return true;

        // 2. Check for matching permissions
        // We look for permissions that match "resource:action:*"
        const relevantPermissions = user.permissions.filter(p => {
            const parts = p.split(":");
            // Handle wildcards if we want to support them, e.g. "leads:*:*"
            // For now constant exact match on resource and action is safest
            return parts[0] === resource && (parts[1] === action || parts[1] === "*");
        });

        if (relevantPermissions.length === 0) return false;

        // 3. Evaluate Scopes
        for (const perm of relevantPermissions) {
            const { scope } = this.parsePermission(perm);

            switch (scope) {
                case "global":
                    return true; // Global access allows everything

                case "region":
                    if (!dataContext?.regionId) continue; // Cannot validate without context
                    // Fetch user's regions if not in token (usually they should be in user object)
                    // For now assuming we might need to fetch if complex, but let's assume valid comparison
                    // TODO: Ensure user.regions is available.
                    // For MVP, we'll assume we check against what's known.
                    // Note: AccessControlService might need to fetch full User if AuthUser is slim.
                    const userRegions = await this.getUserRegions(user.id);
                    if (userRegions.map(r => r.toString()).includes(dataContext.regionId.toString())) {
                        return true;
                    }
                    break;

                case "team":
                    if (!dataContext?.teamType) continue;
                    const userTeam = await this.getUserTeam(user.id);
                    if (userTeam === dataContext.teamType) {
                        return true;
                    }
                    break;

                case "own":
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
     * Helper to get User's team
     */
    private static async getUserTeam(userId: string): Promise<string | undefined> {
        const user = await UserModel.findById(userId).select("teamType").lean();
        return user?.teamType;
    }

    /**
     * Get all subordinates (recursive) for a user.
     * Returns array of User IDs.
     */
    static async getDescendants(managerId: string): Promise<string[]> {
        // efficient query using hierarchyPath regex
        // hierarchyPath format: /CEO_ID/VP_ID/MANAGER_ID/
        // We look for paths that CONTAIN the managerId

        // Note: If hierarchyPath is implemented, we use it.
        // Otherwise fallback to recursive graph lookup?
        // Let's rely on hierarchyPath as per plan.

        const managerPattern = new RegExp(`/${managerId}/`);
        const subordinates = await UserModel.find({
            hierarchyPath: managerPattern
        }).select("_id").lean();

        return subordinates.map(u => u._id.toString());
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
     * Calculate effective permissions for a user based on:
     * 1. Explicit Role Assignments
     * 2. Group Memberships
     * 3. Owned Roles (SPOC)
     */
    static async getUserPermissions(userId: string | ObjectId): Promise<{ permissions: string[], isAdmin: boolean }> {
        const user = await UserModel.findById(userId);
        if (!user || user.status !== "ACTIVE") {
            return { permissions: [], isAdmin: false };
        }

        let isAdmin = false;
        const permsSet = new Set<string>();

        // 1. Explicit Role Assignments
        const explicitAssignments = await UserRoleModel.find({ userId: user._id }).lean();
        const explicitRoleIds = explicitAssignments.map((a) => a.roleId);

        // 2. Roles from Groups
        const groups = await EmployeeGroupModel.find({
            memberUserIds: user._id,
            isActive: true,
        }).lean();
        const groupRoleIds = groups.flatMap((g) => g.roleIds ?? []);

        // 3. Roles where user is an owner (SPOC)
        const ownedRoles = await RoleModel.find({
            $or: [
                { ownerUserId: user._id },
                { ownerUserIds: user._id },
            ],
        }).lean();

        const ownerRoleIds = ownedRoles.map((r) => r._id);

        // Combine standard roles (Explicit + Group)
        let roleIds = [...explicitRoleIds, ...groupRoleIds];

        // Fallback to legacy single roleId on user if no other roles
        if (roleIds.length === 0 && user.roleId) {
            roleIds = [user.roleId];
        }

        // Process Standard Roles
        if (roleIds.length > 0) {
            const uniqueIds = Array.from(new Set(roleIds.map((id) => id.toString())));
            const roles = await RoleModel.find({ _id: { $in: uniqueIds } }).lean();

            for (const role of roles) {
                // Use memberPermissions if available, fallback to legacy
                const memberPerms = role.permissions && role.permissions.length > 0
                    ? role.permissions // New standard field
                    : (role.memberPermissions && role.memberPermissions.length > 0
                        ? role.memberPermissions
                        : role.permissions ?? []); // Fallback

                for (const p of memberPerms) {
                    permsSet.add(p);
                }

                if (role.name?.toLowerCase() === "admin" || role.isSystemRole) {
                    isAdmin = true;
                }
            }
        }

        // Process Owned Roles (Additional Owner Permissions)
        // NOTE: In new system we prefer "Own" scope in standard permissions
        // but for legacy we maintain this check.
        for (const role of ownedRoles) {
            const ownerPerms = role.ownerPermissions && role.ownerPermissions.length > 0
                ? role.ownerPermissions
                : [];

            for (const p of ownerPerms) {
                permsSet.add(p);
            }

            if (role.name?.toLowerCase() === "admin" || role.isSystemRole) {
                isAdmin = true;
            }
        }

        return {
            permissions: Array.from(permsSet),
            isAdmin
        };
    }
}
