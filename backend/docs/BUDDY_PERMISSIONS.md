# Buddy System Permissions

This document describes the permissions required for the Buddy Management feature.

## Permission List

### 1. `buddies.assign`
- **Description**: Permission to assign buddies to team members
- **Required for**: 
  - POST `/buddies/users/:id/buddy` - Creating new buddy assignments
- **Use Case**: Team leads, managers, or admins who need to set up backup assignments

### 2. `buddies.view.history`
- **Description**: Permission to view buddy assignment history
- **Required for**:
  - GET `/buddies/history?userId=` - View assignment history for a specific user
  - GET `/buddies/active?userId=` - Check active assignment for a user
  - GET `/buddies/all` - View all buddy assignments across the system
- **Use Case**: Users who need to see who has been assigned as buddies and when

### 3. `buddies.view.reports`
- **Description**: Permission to view buddy reports and analytics
- **Required for**:
  - GET `/buddies/report?userId=&fromDate=&toDate=` - Generate buddy reports
- **Use Case**: Managers and admins who need to analyze buddy assignment effectiveness and lead transfers

## Permission Hierarchy

- **Admin users**: Automatically have all permissions
- **Regular users**: Must be granted specific permissions through roles

## Frontend Navigation

The Buddy tab in the navigation will only appear if the user has at least one of:
- `buddies.assign`
- `buddies.view.history`
- `buddies.view.reports`

Within the Buddy Management page:
- **Assign Buddy tab**: Only visible if user has `buddies.assign`
- **Assignment History tab**: Only visible if user has `buddies.view.history`
- **Reports tab**: Only visible if user has `buddies.view.reports`

## Example Role Configuration

To grant a user full access to buddy management, add these permissions to their role:
```json
{
  "memberPermissions": [
    "buddies.assign",
    "buddies.view.history",
    "buddies.view.reports"
  ]
}
```

To grant read-only access (view history and reports but cannot assign):
```json
{
  "memberPermissions": [
    "buddies.view.history",
    "buddies.view.reports"
  ]
}
```

To grant only assignment permission (can assign but cannot view history/reports):
```json
{
  "memberPermissions": [
    "buddies.assign"
  ]
}
```

