# Member and Owner Permissions Separation

## Overview

Roles now have separate permission sets:
- **`memberPermissions`**: Permissions granted to users who are members of employee groups mapped to the role
- **`ownerPermissions`**: Permissions granted to users who are owners (SPOCs) of the role

This allows for fine-grained control over what group members can do versus what role owners can do.

## Backend Changes

### Role Model (`backend/src/models/role.ts`)

- Added `memberPermissions: string[]` - Required field for group member permissions
- Added `ownerPermissions: string[]` - Required field for role owner permissions
- Kept `permissions?: string[]` - Legacy field for backward compatibility

### Auth Middleware (`backend/src/middleware/auth.ts`)

**For Group Members:**
- Users get `memberPermissions` from roles assigned via employee groups
- Falls back to legacy `permissions` field if `memberPermissions` is not set

**For Role Owners:**
- Users get `ownerPermissions` from roles where they are listed as owners
- No fallback - owners must have explicit `ownerPermissions` set

### API Routes (`backend/src/routes/roles.ts`)

- `POST /roles` - Requires both `memberPermissions` and `ownerPermissions` arrays (min 1 item each)
- `PUT /roles/:id` - Allows updating `memberPermissions` and `ownerPermissions` separately
- Both fields are required when creating a role

### Team Lead Access (`backend/src/routes/leads.ts`)

- Role owners can see team leads if their `ownerPermissions` include `leads.view.team` or `leads.manage`
- Falls back to legacy `permissions` field for backward compatibility

## Frontend Changes

### Types (`postcard-guest-compass-main/src/services/roles.ts`)

- Updated `Role` interface to include `memberPermissions` and `ownerPermissions`
- Updated `CreateRolePayload` and `UpdateRolePayload` to require both permission arrays

### Role Definition Component (`postcard-guest-compass-main/src/components/RoleDefinition.tsx`)

**Form Sections:**
1. **Member Permissions** - Required field for group members
2. **Owner Permissions** - Required field for role owners
3. **Owners (SPOCs)** - Optional selection of users who will be role owners

**Display:**
- Role cards show both member and owner permissions separately
- Member permissions displayed with secondary badges
- Owner permissions displayed with outline badges

### User Role Management (`postcard-guest-compass-main/src/components/UserRoleManagement.tsx`)

- Displays both member and owner permissions when viewing role details
- Shows which permissions apply to group members vs. role owners

### Employee Groups Management (`postcard-guest-compass-main/src/components/EmployeeGroupsManagement.tsx`)

- Displays `memberPermissions` (with fallback to legacy `permissions`) when showing roles mapped to groups

## Migration Notes

### Existing Roles

- Existing roles with only `permissions` field will continue to work
- Backend falls back to `permissions` when `memberPermissions` is not set
- **Recommendation**: Update existing roles to explicitly set both `memberPermissions` and `ownerPermissions`

### Creating New Roles

- Both `memberPermissions` and `ownerPermissions` are now required
- Cannot create a role without specifying both permission sets
- This ensures clear separation between member and owner capabilities

## Usage Example

```typescript
// Creating a role with separate member and owner permissions
const role = {
  name: "Sales Team",
  memberPermissions: [
    "leads.view.own",
    "leads.edit.own",
    "tasks.view.own"
  ],
  ownerPermissions: [
    "leads.view.own",
    "leads.view.team",  // Owners can see team leads
    "leads.edit.team",  // Owners can edit team leads
    "tasks.view.team"    // Owners can see team tasks
  ],
  ownerUserIds: ["user1", "user2"]  // SPOCs
};
```

In this example:
- **Group members** get: `leads.view.own`, `leads.edit.own`, `tasks.view.own`
- **Role owners** get: `leads.view.own`, `leads.view.team`, `leads.edit.team`, `tasks.view.team`

## Benefits

1. **Clear Separation**: Member and owner permissions are explicitly defined
2. **Flexible Control**: Owners can have different (often more) permissions than members
3. **Security**: No ambiguity about what permissions apply to whom
4. **Backward Compatible**: Legacy `permissions` field still works for existing roles

