# Complete Permission Flow - Simple Picture

## Overview

There are **two types of users** who get permissions from a role:
1. **Group Members** - Users in employee groups that have the role mapped
2. **Role Owners (SPOCs)** - Users designated as owners of the role

## The Complete Picture

```
┌─────────────────────────────────────────────────────────────┐
│                    ROLE DEFINITION                          │
│  Name: "Sales Manager"                                      │
│  Permissions: ["leads.view.all", "leads.manage", ...]       │
│  Owner Permissions: ["leads.view.team", "leads.update"]    │
│  Owners (SPOCs): [john@example.com, mary@example.com]      │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Mapped to
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              EMPLOYEE GROUP                                 │
│  Name: "Sales Team"                                         │
│  Members: [jane@example.com, bob@example.com]              │
│  Roles: ["Sales Manager"] ← Role mapped here               │
└─────────────────────────────────────────────────────────────┘
```

## Permission Assignment Flow

### Path 1: Group Members Get Permissions

```
User: jane@example.com
  │
  ├─→ Is member of: "Sales Team" group
  │
  ├─→ Group has role mapped: "Sales Manager"
  │
  └─→ Gets ALL role permissions: ["leads.view.all", "leads.manage", ...]
```

**Result**: Jane gets **full role permissions** because she's a group member.

### Path 2: Role Owners Get Permissions

```
User: john@example.com
  │
  ├─→ Is owner (SPOC) of: "Sales Manager" role
  │
  ├─→ Role has ownerPermissions defined: ["leads.view.team", "leads.update"]
  │
  └─→ Gets OWNER permissions: ["leads.view.team", "leads.update"]
```

**Result**: John gets **owner permissions** (limited) because he's a role owner.

## Key Differences

| Aspect | Group Members | Role Owners (SPOCs) |
|--------|--------------|---------------------|
| **How they get the role** | Via employee group membership | Via role ownership assignment |
| **Which permissions** | Full `role.permissions` | `role.ownerPermissions` (if set) OR `role.permissions` (fallback) |
| **Can see team leads** | Only if they have `leads.view.team` permission | Yes, if role has `leads.view.team` or `leads.manage` |
| **Team lead scope** | Their own leads (if `leads.view.own`) | Leads of all group members (if `leads.view.team`) |

## Complete Example

### Setup

```
Role: "Sales Manager"
├─ Permissions: ["leads.view.all", "leads.manage", "leads.assign", "users.manage"]
├─ Owner Permissions: ["leads.view.team", "leads.update"]
├─ Owners: [john@example.com]
└─ Mapped to Group: "Sales Team"
   └─ Members: [jane@example.com, bob@example.com]
```

### What Each User Gets

#### Jane (Group Member)
```
Source: Member of "Sales Team" group → Group has "Sales Manager" role
Permissions: ["leads.view.all", "leads.manage", "leads.assign", "users.manage"]
Can see: All leads (has leads.view.all)
Can do: Everything a Sales Manager can do
```

#### Bob (Group Member)
```
Source: Member of "Sales Team" group → Group has "Sales Manager" role
Permissions: ["leads.view.all", "leads.manage", "leads.assign", "users.manage"]
Can see: All leads (has leads.view.all)
Can do: Everything a Sales Manager can do
```

#### John (Role Owner/SPOC)
```
Source: Owner of "Sales Manager" role
Permissions: ["leads.view.team", "leads.update"]  ← Owner permissions
Can see: 
  - Team leads (leads assigned to jane & bob) - because has leads.view.team
  - Can update those leads - because has leads.update
Cannot do:
  - View all leads (no leads.view.all)
  - Manage users (no users.manage)
  - Assign leads (no leads.assign)
```

## Permission Aggregation Logic

When a user logs in, the system:

1. **Finds all roles from groups** (where user is a member)
   - Gets full `role.permissions` for each role

2. **Finds all roles where user is owner**
   - Gets `role.ownerPermissions` if defined and not empty
   - Otherwise gets `role.permissions` (fallback)

3. **Combines all permissions** (removes duplicates)
   - Union of all permissions from all sources

4. **Sets user object**
   - `permissions`: Combined array of all permissions
   - `isAdmin`: true if any role is admin

## Visual Flow Diagram

```
User Login
    │
    ├─→ Check: Is user member of any groups?
    │   │
    │   └─→ YES → Get roles mapped to those groups
    │       └─→ Add role.permissions to user permissions
    │
    ├─→ Check: Is user owner of any roles?
    │   │
    │   └─→ YES → Get those roles
    │       │
    │       ├─→ Does role have ownerPermissions?
    │       │   │
    │       │   ├─→ YES → Add ownerPermissions to user permissions
    │       │   └─→ NO → Add role.permissions to user permissions (fallback)
    │
    └─→ Combine all permissions (remove duplicates)
        └─→ Set req.user.permissions
```

## Real-World Scenario

### Scenario: Sales Team with Manager

**Setup:**
- Role: "Sales Agent" with permissions `["leads.view.own", "leads.create"]`
- Role: "Sales Manager" with permissions `["leads.view.all", "leads.manage"]`
  - Owner Permissions: `["leads.view.team", "leads.update"]`
- Group: "Sales Team" mapped to "Sales Agent" role
- Group: "Sales Team" mapped to "Sales Manager" role
- Members: Alice, Bob
- Owner: John (owner of "Sales Manager" role)

**Results:**

**Alice (Group Member):**
- Gets: `["leads.view.own", "leads.create", "leads.view.all", "leads.manage"]`
- Can: View own leads, create leads, view all leads, manage leads

**Bob (Group Member):**
- Gets: `["leads.view.own", "leads.create", "leads.view.all", "leads.manage"]`
- Can: View own leads, create leads, view all leads, manage leads

**John (Role Owner):**
- Gets: `["leads.view.team", "leads.update"]` (from ownerPermissions)
- Can: View team leads (Alice & Bob's leads), update those leads
- Cannot: View all leads, create leads, manage all leads

## Important Notes

1. **Group members always get full role permissions** - They inherit everything from `role.permissions`

2. **Owners get ownerPermissions if set** - Otherwise they get full role permissions as fallback

3. **Permissions are combined** - If a user is both a group member AND a role owner, they get permissions from both sources

4. **Team lead access is special** - Role owners can see team leads (leads assigned to group members) if the role has `leads.view.team` or `leads.manage` permission, regardless of their specific ownerPermissions

5. **Admin override** - If any role is "Admin" or has `isSystemRole: true`, user becomes admin and gets all permissions

## Summary Table

| User Type | Permission Source | What They Get |
|-----------|------------------|---------------|
| **Group Member** | `role.permissions` | Full role permissions |
| **Role Owner** | `role.ownerPermissions` (if set) OR `role.permissions` (fallback) | Limited or full permissions |
| **Both** | Both sources combined | All permissions from both sources |

