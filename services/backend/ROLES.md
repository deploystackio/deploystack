# Role-Based Access Control System

This document describes the role-based access control (RBAC) system implemented in the DeployStack backend.

## Overview

The RBAC system provides fine-grained access control through roles and permissions. It supports:

- **Global Roles**: System-wide roles that control access to administrative functions
- **Permission-Based Access**: Granular permissions for specific actions
- **Extensible Design**: Easy to add new roles and permissions
- **Secure Defaults**: Safe fallbacks and protection against privilege escalation

## Default Roles

### Global Administrator (`global_admin`)

- **Description**: Full system access with user management capabilities
- **Permissions**:
  - `users.list` - List all users
  - `users.view` - View user details
  - `users.edit` - Edit user information
  - `users.delete` - Delete users
  - `users.create` - Create new users
  - `roles.manage` - Manage roles and permissions
  - `system.admin` - Administrative system access
  - `teams.create` - Create new teams
  - `teams.view` - View team details
  - `teams.edit` - Edit team settings
  - `teams.delete` - Delete teams
  - `teams.manage` - Full team management
  - `team.members.view` - View team members
  - `team.members.manage` - Manage team member roles

### Global User (`global_user`)

- **Description**: Standard user with basic profile access
- **Permissions**:
  - `profile.view` - View own profile
  - `profile.edit` - Edit own profile
  - `teams.create` - Create new teams (up to 3)
  - `teams.view` - View team details
  - `teams.edit` - Edit own team settings
  - `teams.delete` - Delete own teams
  - `team.members.view` - View team members

### Team Administrator (`team_admin`)

- **Description**: Full management access within a specific team
- **Permissions**:
  - `teams.view` - View team details
  - `teams.edit` - Edit team settings
  - `teams.delete` - Delete team (if owner)
  - `teams.manage` - Full team management
  - `team.members.view` - View team members
  - `team.members.manage` - Manage team member roles

### Team User (`team_user`)

- **Description**: Basic team member with limited access
- **Permissions**:
  - `teams.view` - View team details
  - `team.members.view` - View team members

## Team System

DeployStack includes a comprehensive team management system that allows users to organize their work into teams. Each user automatically gets their own team upon registration and can create up to 3 teams total.

### Team Features

- **Automatic Team Creation**: Every new user gets a default team created with their username
- **Team Ownership**: Each team has an owner who has full administrative control
- **Single User Teams**: Currently, teams support only one user per team
- **Team Limits**: Users can create up to 3 teams maximum
- **Unique Slugs**: Teams have URL-friendly slugs with automatic conflict resolution

### Team Database Schema

#### Teams Table

```sql
CREATE TABLE teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  owner_id TEXT NOT NULL REFERENCES authUser(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

#### Team Memberships Table

```sql
CREATE TABLE teamMemberships (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES authUser(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- 'team_admin' or 'team_user'
  joined_at INTEGER NOT NULL,
  UNIQUE(team_id, user_id)
);
```

### Team Registration Flow

When a user registers:

1. User account is created with appropriate global role
2. A default team is automatically created using the user's username
3. The user is added as `team_admin` of their new team
4. If username conflicts exist, slug gets incremented (e.g., `john-doe-2`)

### Team Management

#### Team Creation

- Users can create up to 3 teams
- Team names are converted to URL-friendly slugs
- Automatic conflict resolution for duplicate slugs
- Team owner becomes `team_admin` automatically

#### Team Roles

- **Team Admin**: Full control over team settings and management
- **Team User**: Basic team member (for future expansion)

#### Team Permissions

| Permission | Description |
|------------|-------------|
| `teams.create` | Create new teams (up to limit) |
| `teams.view` | View team details |
| `teams.edit` | Edit team settings |
| `teams.delete` | Delete team |
| `teams.manage` | Full team management |
| `team.members.view` | View team members |
| `team.members.manage` | Manage team member roles |

### Team API Endpoints

#### Get User's Teams

```http
GET /api/users/me/teams
Authorization: Required (authenticated user)
```

#### Create Team

```http
POST /api/teams
Authorization: Required (teams.create permission)
Content-Type: application/json

{
  "name": "My New Team",
  "description": "Team description"
}
```

#### Get Team by ID

```http
GET /api/teams/:id
Authorization: Required (teams.view permission)
```

#### Update Team

```http
PUT /api/teams/:id
Authorization: Required (teams.edit permission)
Content-Type: application/json

{
  "name": "Updated Team Name",
  "description": "Updated description"
}
```

#### Delete Team

```http
DELETE /api/teams/:id
Authorization: Required (teams.delete permission)
```

#### Get Team Members

```http
GET /api/teams/:id/members
Authorization: Required (team.members.view permission)
```

### Team Service Methods

The `TeamService` class provides comprehensive team management:

```typescript
// Create team
const team = await TeamService.createTeam({
  name: 'My Team',
  owner_id: userId,
  description: 'Team description'
});

// Get user's teams
const teams = await TeamService.getUserTeams(userId);

// Check team limits
const canCreate = await TeamService.canUserCreateTeam(userId);

// Team membership checks
const isAdmin = await TeamService.isTeamAdmin(teamId, userId);
const isOwner = await TeamService.isTeamOwner(teamId, userId);
```

## Database Schema

### Roles Table

```sql
CREATE TABLE roles (
  id TEXT PRIMARY KEY,                    -- Role identifier (e.g., 'global_admin')
  name TEXT NOT NULL UNIQUE,              -- Display name (e.g., 'Global Administrator')
  description TEXT,                       -- Role description
  permissions TEXT NOT NULL,              -- JSON array of permissions
  is_system_role BOOLEAN DEFAULT FALSE,   -- Prevents deletion of core roles
  created_at INTEGER NOT NULL,            -- Creation timestamp
  updated_at INTEGER NOT NULL             -- Last update timestamp
);
```

### User Role Assignment

The `authUser` table includes a `role_id` column that references the `roles` table:

```sql
ALTER TABLE authUser ADD COLUMN role_id TEXT DEFAULT 'global_user' REFERENCES roles(id);
```

## API Endpoints

### Role Management

#### List Roles

```http
GET /api/roles
Authorization: Required (roles.manage permission)
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "global_admin",
      "name": "Global Administrator",
      "description": "Full system access with user management capabilities",
      "permissions": ["users.list", "users.view", "users.edit", "users.delete", "users.create", "roles.manage", "system.admin"],
      "is_system_role": true,
      "created_at": "2025-01-30T15:00:00.000Z",
      "updated_at": "2025-01-30T15:00:00.000Z"
    }
  ]
}
```

#### Get Role by ID

```http
GET /api/roles/:id
Authorization: Required (roles.manage permission)
```

#### Create Role

```http
POST /api/roles
Authorization: Required (roles.manage permission)
Content-Type: application/json

{
  "id": "moderator",
  "name": "Moderator",
  "description": "Content moderation capabilities",
  "permissions": ["users.view", "content.moderate"]
}
```

#### Update Role

```http
PUT /api/roles/:id
Authorization: Required (roles.manage permission)
Content-Type: application/json

{
  "name": "Updated Role Name",
  "description": "Updated description",
  "permissions": ["updated.permission"]
}
```

**Note:** System roles (`is_system_role: true`) cannot be updated or deleted.

#### Delete Role

```http
DELETE /api/roles/:id
Authorization: Required (roles.manage permission)
```

**Restrictions:**

- Cannot delete system roles
- Cannot delete roles that are assigned to users

#### Get Available Permissions

```http
GET /api/roles/permissions
Authorization: Required (roles.manage permission)
```

### User Management

#### List Users

```http
GET /api/users
Authorization: Required (users.list permission)
```

#### Get User by ID

```http
GET /api/users/:id
Authorization: Required (own profile or system.admin permission)
```

#### Update User

```http
PUT /api/users/:id
Authorization: Required (own profile or system.admin permission)
Content-Type: application/json

{
  "username": "newusername",
  "email": "newemail@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "role_id": "global_user"
}
```

**Restrictions:**

- Users cannot change their own role (only admins can)
- Email and username must be unique

#### Delete User

```http
DELETE /api/users/:id
Authorization: Required (users.delete permission)
```

**Restrictions:**

- Cannot delete your own account
- Cannot delete the last global administrator

#### Assign Role to User

```http
PUT /api/users/:id/role
Authorization: Required (users.edit permission)
Content-Type: application/json

{
  "role_id": "global_admin"
}
```

**Restrictions:**

- Cannot change your own role

#### Get Current User Profile

```http
GET /api/users/me
Authorization: Required (authenticated user)
```

#### Get User Statistics

```http
GET /api/users/stats
Authorization: Required (users.list permission)
```

#### Get Users by Role

```http
GET /api/users/role/:roleId
Authorization: Required (users.list permission)
```

## Permission System

### Available Permissions

| Permission | Description |
|------------|-------------|
| `users.list` | List all users in the system |
| `users.view` | View detailed user information |
| `users.edit` | Edit user information and assign roles |
| `users.delete` | Delete user accounts |
| `users.create` | Create new user accounts |
| `roles.manage` | Create, update, and delete roles |
| `system.admin` | Administrative system access |
| `profile.view` | View own profile information |
| `profile.edit` | Edit own profile information |

### Permission Checking

The system provides several ways to check permissions:

#### Middleware Functions

```typescript
import { requirePermission, requireRole, requireGlobalAdmin } from '../middleware/roleMiddleware';

// Require specific permission
fastify.get('/admin-only', {
  preHandler: requirePermission('system.admin')
}, handler);

// Require specific role
fastify.get('/admin-role', {
  preHandler: requireRole('global_admin')
}, handler);

// Require global admin (shorthand)
fastify.get('/global-admin', {
  preHandler: requireGlobalAdmin()
}, handler);
```

#### Utility Functions

```typescript
import { checkUserPermission, getUserRole } from '../middleware/roleMiddleware';

// Check permission programmatically
const hasPermission = await checkUserPermission(userId, 'users.edit');

// Get user's role information
const userRole = await getUserRole(userId);
```

## User Registration Flow

### First User

When the first user registers in the system:

1. They are automatically assigned the `global_admin` role
2. This ensures there's always at least one administrator

### Subsequent Users

All subsequent users are assigned the `global_user` role by default.

### Registration Code Example

```typescript
// Check if this is the first user
const allUsers = await db.select().from(authUserTable).limit(1);
const isFirstUser = allUsers.length === 0;
const defaultRole = isFirstUser ? 'global_admin' : 'global_user';

// Create user with appropriate role
await db.insert(authUserTable).values({
  // ... other user data
  role_id: defaultRole
});
```

## Security Considerations

### Role Protection

- **System Roles**: Cannot be modified or deleted
- **Last Admin Protection**: Cannot delete the last global administrator
- **Self-Role Protection**: Users cannot change their own roles
- **Self-Delete Protection**: Users cannot delete their own accounts

### Permission Validation

- All permissions are validated against a whitelist
- Invalid permissions are rejected during role creation/update
- Database constraints ensure referential integrity

### Session Security

- Role information is fetched fresh for each permission check
- No role caching to prevent stale permission issues
- Lucia v3 handles secure session management

## Adding New Roles

### 1. Define Permissions

First, add any new permissions to the available permissions list:

```typescript
// In services/backend/src/routes/roles/schemas.ts
export const AVAILABLE_PERMISSIONS = [
  // ... existing permissions
  'content.moderate',
  'reports.view',
  'analytics.access',
] as const;
```

### 2. Create Role via API

Use the role creation API to add new roles:

```http
POST /api/roles
{
  "id": "content_moderator",
  "name": "Content Moderator",
  "description": "Manages user-generated content",
  "permissions": ["users.view", "content.moderate", "reports.view"]
}
```

### 3. Update Default Permissions (Optional)

If you want to include the role in default setups:

```typescript
// In services/backend/src/services/roleService.ts
static getDefaultPermissions() {
  return {
    global_admin: [/* ... */],
    global_user: [/* ... */],
    content_moderator: ['users.view', 'content.moderate', 'reports.view'],
  };
}
```

## Migration and Setup

### Database Migration

The role system is set up through migration `0003_huge_prism.sql` (generated using `npm run db:generate`):

1. Creates the `roles` table
2. Adds `role_id` column to `authUser` table
3. Seeds default roles (`global_admin`, `global_user`)
4. Assigns existing users to `global_user`
5. Promotes the first user to `global_admin`

### Manual Setup

If you need to manually set up roles:

```sql
-- Insert default roles
INSERT INTO roles (id, name, description, permissions, is_system_role, created_at, updated_at) VALUES 
('global_admin', 'Global Administrator', 'Full system access', '["users.list","users.view","users.edit","users.delete","users.create","roles.manage","system.admin"]', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('global_user', 'Global User', 'Standard user access', '["profile.view","profile.edit"]', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- Assign roles to users
UPDATE authUser SET role_id = 'global_user' WHERE role_id IS NULL;
UPDATE authUser SET role_id = 'global_admin' WHERE id = (SELECT id FROM authUser ORDER BY id ASC LIMIT 1);
```

## Troubleshooting

### Common Issues

#### Permission Denied Errors

- Verify the user has the required permission
- Check if the user's role includes the necessary permission
- Ensure the role exists and is properly assigned

#### Role Assignment Failures

- Verify the target role exists
- Check if you're trying to assign a role to yourself (not allowed)
- Ensure you have `users.edit` permission

#### Migration Issues

- Ensure the database is properly initialized
- Check that previous migrations have been applied
- Verify foreign key constraints are working

### Debug Commands

```typescript
// Check user's current role and permissions
const userRole = await roleService.getUserRole(userId);
console.log('User role:', userRole);

// Check specific permission
const hasPermission = await roleService.userHasPermission(userId, 'users.edit');
console.log('Has permission:', hasPermission);

// List all roles
const allRoles = await roleService.getAllRoles();
console.log('All roles:', allRoles);
```

## Future Enhancements

### Planned Features

- **Hierarchical Roles**: Parent-child role relationships
- **Temporary Permissions**: Time-limited access grants
- **Permission Groups**: Logical grouping of related permissions
- **Audit Logging**: Track role and permission changes
- **Role Templates**: Predefined role configurations

### Extension Points

The system is designed to be extensible:

- Add new permissions by updating the `AVAILABLE_PERMISSIONS` array
- Create custom middleware for complex permission logic
- Implement role-based UI components in the frontend
- Add role-specific business logic in services

## Best Practices

### Role Design

- Keep roles focused and specific
- Use descriptive names and descriptions
- Group related permissions logically
- Avoid overly broad permissions

### Permission Naming

- Use dot notation for hierarchy (`users.edit`, `content.moderate`)
- Be specific about the action (`view`, `edit`, `delete`, `create`)
- Use consistent naming patterns

### Security

- Always check permissions at the API level
- Don't rely solely on frontend permission checks
- Regularly audit role assignments
- Monitor for privilege escalation attempts

### Performance

- Permission checks are lightweight but avoid excessive calls
- Consider caching user roles for high-frequency operations
- Use middleware for route-level protection
- Batch permission checks when possible
