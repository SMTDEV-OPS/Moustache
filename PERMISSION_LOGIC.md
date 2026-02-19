# Permission Fetching Logic

## Overview
Permissions are fetched for a user during authentication via the `requireAuth` middleware. The system aggregates permissions from multiple sources: direct role assignments and roles inherited from employee groups.

## Flow Diagram

```
User Login
    ↓
JWT Token Verification
    ↓
Find User in Database
    ↓
┌─────────────────────────────────────────┐
│  Step 1: Collect Role IDs               │
└─────────────────────────────────────────┘
    ↓
    ├─→ Direct Role Assignments (UserRole)
    │   └─→ Find all UserRole records where userId = user._id
    │       └─→ Extract roleIds
    │
    ├─→ Roles from Employee Groups
    │   └─→ Find all EmployeeGroups where memberUserIds contains user._id
    │       └─→ Extract roleIds from each group
    │
    └─→ Legacy Fallback (if no roles found)
        └─→ Use user.roleId from User model or token
    ↓
┌─────────────────────────────────────────┐
│  Step 2: Aggregate Role IDs            │
└─────────────────────────────────────────┘
    ↓
    Combine: explicitRoleIds + groupRoleIds
    Remove duplicates
    ↓
┌─────────────────────────────────────────┐
│  Step 3: Fetch Roles and Permissions    │
└─────────────────────────────────────────┘
    ↓
    Find all Role documents by roleIds
    ↓
    For each Role:
        ├─→ Collect all permissions into a Set (removes duplicates)
        └─→ Check if role.name === "admin" (case-insensitive) OR isSystemRole === true
            └─→ If yes, set isAdmin = true
    ↓
┌─────────────────────────────────────────┐
│  Step 4: Set User Object                │
└─────────────────────────────────────────┘
    ↓
    req.user = {
        id: user.id,
        email: user.email,
        roleId: user.roleId,
        isAdmin: boolean,
        permissions: string[]  // All unique permissions from all roles
    }
```

## Code Location
**File:** `backend/src/middleware/auth.ts`  
**Function:** `requireAuth()` (lines 35-116)

## Step-by-Step Logic

### Step 1: Collect Role IDs from Multiple Sources

#### 1a. Direct Role Assignments
```typescript
const explicitAssignments = await UserRoleModel.find({
  userId: user._id,
}).lean();

const explicitRoleIds = explicitAssignments.map((a) => a.roleId);
```
- Looks in `UserRole` collection
- Finds all records where `userId` matches the current user
- Extracts `roleId` from each assignment

#### 1b. Roles from Employee Groups
```typescript
const groups = await EmployeeGroupModel.find({
  memberUserIds: user._id,
  isActive: true,
}).lean();

const groupRoleIds = groups.flatMap((g) => g.roleIds ?? []);
```
- Finds all `EmployeeGroup` records where:
  - `memberUserIds` contains the current user's ID
  - `isActive` is `true`
- Extracts all `roleIds` from those groups
- Flattens the array (groups can have multiple roles)

#### 1c. Legacy Fallback
```typescript
if (roleIds.length === 0) {
  const fallbackRoleId = user.roleId ?? decoded.roleId;
  if (fallbackRoleId) {
    roleIds = [fallbackRoleId as any];
  }
}
```
- Only used if no roles found from above sources
- Falls back to `user.roleId` from User model or JWT token
- This is for backward compatibility

### Step 2: Combine and Deduplicate Role IDs

```typescript
let roleIds = [...explicitRoleIds, ...groupRoleIds];
const uniqueIds = Array.from(new Set(roleIds.map((id) => id.toString())));
```
- Combines explicit assignments and group roles
- Removes duplicates using a Set
- Converts all IDs to strings for comparison

### Step 3: Fetch Roles and Aggregate Permissions

```typescript
const roles = await RoleModel.find({ _id: { $in: uniqueIds } }).lean();
const permsSet = new Set<string>();

for (const role of roles) {
  // Collect permissions
  for (const p of role.permissions ?? []) {
    permsSet.add(p);
  }
  
  // Check for admin status
  if (role.name?.toLowerCase() === "admin" || role.isSystemRole) {
    isAdmin = true;
  }
}

permissions = Array.from(permsSet);
```

**Key Points:**
- Fetches all Role documents at once
- Uses a `Set` to automatically remove duplicate permissions
- If user has multiple roles, permissions are **union** (combined, not intersection)
- Admin status is set if:
  - Role name is "admin" (case-insensitive), OR
  - Role has `isSystemRole: true`

### Step 4: Set Request User Object

```typescript
req.user = {
  id: user.id,
  email: user.email,
  roleId: user.roleId?.toString(),
  isAdmin,
  permissions,
};
```

## Permission Checking Functions

### `hasPermission(user, permission)`
- Returns `true` if user is admin
- Returns `true` if user has the exact permission
- Special case: `leads.manage` grants all `leads.*` permissions

### `hasAnyPermission(user, required[])`
- Returns `true` if user has ANY of the required permissions
- Useful for endpoints that accept multiple permission types

### `requirePermissions(required[])`
- Middleware that requires ALL specified permissions
- Returns 403 if any permission is missing

### `requireAnyPermission(required[])`
- Middleware that requires ANY of the specified permissions
- Returns 403 if none of the permissions are present

## Example Scenarios

### Scenario 1: User with Direct Role Assignment
```
User: john@example.com
├─ Direct Assignment: "Sales Agent" role
│  └─ Permissions: ["leads.view.own", "leads.create"]
└─ Result: ["leads.view.own", "leads.create"]
```

### Scenario 2: User in Employee Group
```
User: jane@example.com
├─ Member of: "Sales Team" group
│  └─ Group has: "Sales Manager" role
│     └─ Permissions: ["leads.view.all", "leads.manage"]
└─ Result: ["leads.view.all", "leads.manage"]
```

### Scenario 3: User with Both Direct and Group Roles
```
User: bob@example.com
├─ Direct Assignment: "Agent" role
│  └─ Permissions: ["leads.view.own"]
└─ Member of: "Support Team" group
   └─ Group has: "Support" role
      └─ Permissions: ["leads.view.team", "leads.update"]
└─ Result: ["leads.view.own", "leads.view.team", "leads.update"]
   (All permissions combined, duplicates removed)
```

### Scenario 4: Admin User
```
User: admin@example.com
├─ Direct Assignment: "Admin" role
│  └─ Permissions: ["users.manage", "leads.manage", ...]
│  └─ isAdmin: true (because role.name === "admin")
└─ Result: 
   - permissions: All permissions from role
   - isAdmin: true
   - All permission checks return true (admin bypass)
```

## Important Notes

1. **Permission Union**: If a user has multiple roles, they get ALL permissions from ALL roles combined (union, not intersection).

2. **Admin Override**: If `isAdmin === true`, all permission checks return `true` regardless of actual permissions.

3. **Group Roles**: When a role is mapped to an employee group, ALL members of that group automatically get that role's permissions.

4. **Active Groups Only**: Only active groups (`isActive: true`) contribute roles to users.

5. **Permission Deduplication**: Duplicate permissions from multiple roles are automatically removed using a Set.

6. **Legacy Support**: The system still supports the old `user.roleId` field for backward compatibility, but it's only used as a fallback.

7. **Super Permission**: `leads.manage` acts as a super-permission that grants all `leads.*` permissions.

## Database Collections Involved

1. **User** (`UserModel`): Basic user info, legacy `roleId` field
2. **UserRole** (`UserRoleModel`): Direct role assignments (userId → roleId)
3. **EmployeeGroup** (`EmployeeGroupModel`): Groups with members and mapped roles
4. **Role** (`RoleModel`): Role definitions with permissions array

## Frontend Usage

After login, permissions are fetched via `/auth/me` endpoint which uses the same `requireAuth` middleware. The frontend receives:

```typescript
{
  user: {
    id: string,
    email: string,
    roleId?: string,
    isAdmin: boolean,
    permissions: string[]
  }
}
```

These permissions are then used to:
- Show/hide UI elements
- Enable/disable features
- Control access to different tabs and views

