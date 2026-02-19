# Owner Permissions (SPOCs) - Implementation Guide

## Overview

Role owners (SPOCs - Single Point of Contacts) now have separate permission management. This allows admins to grant role owners specific permissions that may differ from the full role permissions.

## How It Works

### Permission Flow

1. **Group Members**: Get all permissions from roles mapped to their groups
2. **Role Owners (SPOCs)**: Get `ownerPermissions` if defined, otherwise fall back to full role permissions

### Key Features

- **Granular Control**: Admins can set specific permissions for owners separate from role permissions
- **Fallback Behavior**: If `ownerPermissions` is not set or empty, owners inherit all role permissions
- **Team Lead Access**: Owners can view/manage team leads for employees in groups mapped to their roles (if they have `leads.view.team` or `leads.manage`)

## Database Schema

### Role Model
```typescript
{
  name: string;
  permissions: string[];           // Full role permissions (for group members)
  ownerUserIds: ObjectId[];       // Array of owner user IDs
  ownerPermissions?: string[];    // Specific permissions for owners (optional)
}
```

## Permission Aggregation Logic

When a user logs in, permissions are calculated from:

1. **Direct Role Assignments** (`UserRole` collection)
2. **Group Roles** (roles mapped to groups where user is a member)
3. **Owned Roles** (roles where user is in `ownerUserIds` array)
   - Uses `ownerPermissions` if defined and not empty
   - Falls back to `permissions` if `ownerPermissions` is undefined or empty

## Example Scenarios

### Scenario 1: Owner with Custom Permissions
```
Role: "Sales Manager"
├─ Permissions: ["leads.view.all", "leads.manage", "leads.assign", "users.manage"]
├─ Owner Permissions: ["leads.view.team", "leads.update"]  // Limited permissions
├─ Owner: john@example.com
└─ Mapped to Group: "Sales Team"
   └─ Members: [jane@example.com, bob@example.com]

Result:
- jane & bob: Get all "Sales Manager" permissions (via group)
- john (owner): Gets only ["leads.view.team", "leads.update"]
- john: Can see leads assigned to jane & bob (team leads)
```

### Scenario 2: Owner with No Custom Permissions (Fallback)
```
Role: "Support Agent"
├─ Permissions: ["leads.view.own", "leads.update"]
├─ Owner Permissions: []  // Empty or undefined
├─ Owner: mary@example.com
└─ Mapped to Group: "Support Team"

Result:
- Group members: Get ["leads.view.own", "leads.update"]
- mary (owner): Gets ["leads.view.own", "leads.update"] (inherits role permissions)
```

### Scenario 3: Owner with Full Role Permissions
```
Role: "Team Lead"
├─ Permissions: ["leads.view.team", "leads.manage"]
├─ Owner Permissions: ["leads.view.team", "leads.manage"]  // Same as role
├─ Owner: alice@example.com
└─ Mapped to Group: "Team A"

Result:
- Group members: Get ["leads.view.team", "leads.manage"]
- alice (owner): Gets ["leads.view.team", "leads.manage"]
```

## UI Usage

### Role Definition Page

1. **Create/Edit Role**:
   - Set role name, description, and permissions (for group members)
   - Select owners (SPOCs) from user list
   - **If owners selected**: A new section appears for "Owner Permissions"
   - Select specific permissions for owners
   - If no owner permissions selected, owners will inherit all role permissions

2. **View Role**:
   - Role card shows:
     - Regular permissions (for group members)
     - Owners list
     - Owner permissions (if different from role permissions)

## Backend Implementation

### Auth Middleware (`backend/src/middleware/auth.ts`)

```typescript
// Find roles where user is an owner
const ownedRoles = await RoleModel.find({
  $or: [
    { ownerUserId: user._id },
    { ownerUserIds: user._id },
  ],
}).lean();

// Process owner permissions
for (const role of ownedRoles) {
  const ownerPerms = role.ownerPermissions && role.ownerPermissions.length > 0
    ? role.ownerPermissions
    : role.permissions; // Fallback to role permissions
  
  for (const p of ownerPerms ?? []) {
    permsSet.add(p);
  }
}
```

## Use Cases

### Use Case 1: Limited Owner Access
**Scenario**: You want team leads to view team leads but not have full management access.

**Solution**:
- Role: `["leads.view.all", "leads.manage", "leads.assign"]`
- Owner Permissions: `["leads.view.team", "leads.update"]`
- Result: Owners can view and update team leads, but cannot assign or manage all leads

### Use Case 2: Read-Only Owner Access
**Scenario**: You want owners to monitor team activity but not make changes.

**Solution**:
- Role: `["leads.view.all", "leads.manage", "leads.update"]`
- Owner Permissions: `["leads.view.team"]`
- Result: Owners can only view team leads, cannot update or manage

### Use Case 3: Full Owner Access
**Scenario**: Owners should have the same permissions as the role.

**Solution**:
- Role: `["leads.view.all", "leads.manage"]`
- Owner Permissions: Leave empty or set to same as role
- Result: Owners inherit all role permissions

## Best Practices

1. **Set Owner Permissions Explicitly**: Even if you want owners to have full access, it's better to set `ownerPermissions` explicitly for clarity
2. **Start Restrictive**: Begin with limited owner permissions and expand as needed
3. **Document Intent**: Use role descriptions to explain why owner permissions differ
4. **Regular Review**: Periodically review owner permissions to ensure they're still appropriate

## Migration Notes

- Existing roles without `ownerPermissions` will automatically fall back to role permissions
- No data migration needed - the system handles undefined `ownerPermissions` gracefully
- Owners set before this feature will continue to work (they'll get role permissions)

