import { ObjectId } from "mongoose";
import { DataSharingRuleModel, IDataSharingRule } from "../../models/dataSharingRule";
import { ModuleDefaultAccessModel, DataSharingDefaultAccess } from "../../models/moduleDefaultAccess";
import { EmployeeGroupModel } from "../../models/employeeGroup";
import { AccessControlService } from "./AccessControlService";

export class DataSharingService {

    /**
     * Get the default access level for a module.
     * Starts with 'private' if not configured yet.
     */
    static async getModuleDefaultAccess(moduleName: string): Promise<DataSharingDefaultAccess> {
        const doc = await ModuleDefaultAccessModel.findOne({ module: moduleName }).lean();
        return doc ? doc.defaultAccess : 'private';
    }

    /**
     * Get all active data sharing rules that grant access for a given module
     */
    static async getActiveRulesForModule(moduleName: string): Promise<IDataSharingRule[]> {
        const rules = await DataSharingRuleModel.find({ module: moduleName, isActive: true }).lean();
        return rules as unknown as IDataSharingRule[];
    }

    /**
     * Helper to recursively resolve all role IDs and subgroup IDs a user belongs to.
     * This is crucial for evaluating 'toId' in sharing rules to see if the user qualifies.
     */
    static async getUserMemberships(userId: string, roleId?: string): Promise<{ groupIds: string[], roleIds: string[] }> {
        const memberships = {
            groupIds: new Set<string>(),
            roleIds: new Set<string>()
        };

        if (roleId) memberships.roleIds.add(roleId.toString());

        // Find all groups the user is directly a member of
        const directGroups = await EmployeeGroupModel.find({ memberUserIds: userId, isActive: true }).lean();
        for (const g of directGroups) {
            memberships.groupIds.add(g._id.toString());
        }

        // Find all groups where the user's role is a member
        if (roleId) {
            // Include roles that includeSubordinates = true where my role is a subordinate
            // For now, doing a simpler check: direct role match
            const roleGroups = await EmployeeGroupModel.find({ memberRoleIds: roleId, isActive: true }).lean();
            for (const g of roleGroups) {
                memberships.groupIds.add(g._id.toString());
            }
        }

        // Note: A full implementation would also recursively check subGroupIds and 
        // includeSubordinates flag for roles to build an exhaustive graph of memberships.

        return {
            groupIds: Array.from(memberships.groupIds),
            roleIds: Array.from(memberships.roleIds)
        };
    }

    /**
     * Evaluate the highest level of access a user has to another user's (targetOwnerId) record in a specific module.
     * Returns: 'none' | 'read' | 'read_write' | 'full'
     */
    static async getEffectiveAccess(
        userId: string,
        userRoleId: string | undefined,
        targetOwnerId: string,
        targetOwnerRoleId: string | undefined,
        moduleName: string
    ): Promise<'none' | 'read' | 'read_write' | 'full'> {
        // 1. Direct Ownership
        if (userId.toString() === targetOwnerId.toString()) {
            return 'full';
        }

        // 2. Module Default Access
        const defaultAccess = await this.getModuleDefaultAccess(moduleName);
        if (defaultAccess === 'public_full') return 'full';

        // We track the maximum granted access found so far
        let maxAccessLevel = 'none';

        if (defaultAccess === 'public_read_write') maxAccessLevel = 'read_write';
        else if (defaultAccess === 'public_read') maxAccessLevel = 'read';

        // 3. Role Hierarchy Evaluation (Can I see my subordinate's data?)
        // (AccessControlService already has getDescendants, we can use that if needed, 
        //  but in this Zoho model we check if targetOwnerId is in my descendants array)
        const userDescendants = await AccessControlService.getDescendants(userId);
        if (userDescendants.includes(targetOwnerId.toString())) {
            return 'full'; // Superiors have full access to subordinates' records by default
        }

        // 4. Data Sharing Rules Evaluation
        // If we already have read_write from defaults, we only care about rules granting 'full'
        if (maxAccessLevel === 'full') return 'full';

        const sharingRules = await this.getActiveRulesForModule(moduleName);
        if (sharingRules.length === 0) return maxAccessLevel as any;

        const requestorMemberships = await this.getUserMemberships(userId, userRoleId);
        const targetOwnerMemberships = await this.getUserMemberships(targetOwnerId, targetOwnerRoleId);

        // A sharing rule grants access if:
        // FROM matches the target owner's role/group
        // TO matches the requestor's role/group

        for (const rule of sharingRules) {
            const ruleFromId = rule.fromId.toString();
            const ruleToId = rule.toId.toString();

            let fromMatches = false;
            if (rule.fromType === 'role' && targetOwnerMemberships.roleIds.includes(ruleFromId)) fromMatches = true;
            if (rule.fromType === 'group' && targetOwnerMemberships.groupIds.includes(ruleFromId)) fromMatches = true;

            let toMatches = false;
            if (rule.toType === 'role' && requestorMemberships.roleIds.includes(ruleToId)) toMatches = true;
            if (rule.toType === 'group' && requestorMemberships.groupIds.includes(ruleToId)) toMatches = true;

            if (fromMatches && toMatches) {
                // Determine if this rule grants a higher access level
                if (rule.accessLevel === 'full') return 'full';
                if (rule.accessLevel === 'read_write' && maxAccessLevel === 'read') maxAccessLevel = 'read_write';
                if (rule.accessLevel === 'read_write' && maxAccessLevel === 'none') maxAccessLevel = 'read_write';
                if (rule.accessLevel === 'read' && maxAccessLevel === 'none') maxAccessLevel = 'read';
            }
        }

        return maxAccessLevel as any;
    }
}
