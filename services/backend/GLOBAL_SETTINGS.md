# Global Settings Management

This document describes the global key-value store system with group-based organization for managing application-wide configuration and credentials in DeployStack.

## Overview

The global settings system provides secure storage for application-wide configuration values organized into logical groups for better management and frontend display:

- **SMTP Mail Settings**: Host, port, username, password for email functionality
- **GitHub OAuth Configuration**: GitHub OAuth client ID and secret for authentication
- **API Keys**: External service credentials (OpenAI, AWS, etc.)
- **System Configuration**: Application-wide settings and feature flags
- **Integration Credentials**: Third-party service authentication tokens
- **Environment Variables**: Dynamic configuration that can be changed without code deployment

### Group-Based Organization

The system now uses **groups** to organize settings into logical categories that can be displayed as tabs in the frontend:

- **Group ID**: Technical identifier used for API queries (e.g., `smtp`)
- **Group Name**: Human-readable display name (e.g., `SMTP Mail Settings`)
- **Group Metadata**: Description, icon, and sort order for frontend display

### Auto-Initialization System

The system includes an **auto-initialization feature** that automatically creates missing groups and global settings when the server starts. Settings are defined in modular files within the `src/global-settings/` directory, and the system will:

- Scan for setting definition files on startup
- Create missing groups with metadata
- Check which settings exist in the database
- Create missing settings with default values (non-destructive)
- Link settings to their appropriate groups
- Preserve existing settings and their values
- Log initialization results for transparency

## Key Features

- **Group-Based Organization**: Settings organized into logical groups for frontend tabs
- **Hierarchical Keys**: Dot notation organization (e.g., `smtp.host`, `api.openai.key`)
- **Encryption Support**: Automatic encryption for sensitive values using AES-256-GCM
- **Group Metadata**: Display names, descriptions, icons, and sort order for groups
- **Admin-Only Access**: Only `global_admin` users can manage settings
- **Type Safety**: Zod schema validation for all inputs
- **Audit Trail**: Track setting changes with timestamps
- **Search Functionality**: Find settings by key patterns
- **Bulk Operations**: Create/update multiple settings at once
- **Health Monitoring**: Built-in encryption system health checks

## Security

### Encryption

Sensitive values are encrypted using industry-standard AES-256-GCM encryption:

- **Algorithm**: AES-256-GCM (Galois/Counter Mode)
- **Key Derivation**: Scrypt with fixed salt from `DEPLOYSTACK_ENCRYPTION_SECRET` environment variable
- **Authenticated Encryption**: Prevents tampering with encrypted data
- **Unique IVs**: Each encryption operation uses a unique initialization vector
- **Additional Authenticated Data**: Extra security layer to prevent manipulation

### Access Control

- **Role-Based Access**: Only users with `global_admin` role can access settings
- **Permission-Based**: Granular permissions for view, edit, and delete operations
- **Session Validation**: All requests require valid authentication

### Environment Variables

The system requires the `DEPLOYSTACK_ENCRYPTION_SECRET` environment variable:

```env
DEPLOYSTACK_ENCRYPTION_SECRET=your-very-secure-32-character-secret-key-here
```

**Important**: Use a strong, unique secret in production. This key is used to derive the encryption key for all sensitive settings.

## Database Schema

```sql
-- Groups table for organizing settings
CREATE TABLE globalSettingGroups (
  id TEXT PRIMARY KEY,                     -- Group identifier (e.g., 'smtp')
  name TEXT NOT NULL,                      -- Display name (e.g., 'SMTP Mail Settings')
  description TEXT,                        -- Group description
  icon TEXT,                               -- Optional icon (lucide) for frontend 
  sort_order INTEGER DEFAULT 0 NOT NULL,  -- Display order for tabs
  created_at INTEGER NOT NULL,             -- Creation timestamp
  updated_at INTEGER NOT NULL              -- Last update timestamp
);

-- Settings table with group reference
CREATE TABLE globalSettings (
  key TEXT PRIMARY KEY,                    -- Setting identifier (e.g., 'smtp.host')
  value TEXT NOT NULL,                     -- Setting value (encrypted if sensitive)
  description TEXT,                        -- Human-readable description
  is_encrypted BOOLEAN NOT NULL DEFAULT FALSE, -- Whether value is encrypted
  group_id TEXT REFERENCES globalSettingGroups(id), -- Group reference
  created_at INTEGER NOT NULL,             -- Creation timestamp
  updated_at INTEGER NOT NULL              -- Last update timestamp
);
```

## API Endpoints

### Authentication

All endpoints require authentication and appropriate permissions:

- **View Settings**: Requires `settings.view` permission
- **Create/Update Settings**: Requires `settings.edit` permission  
- **Delete Settings**: Requires `settings.delete` permission

### Group Management

#### Get All Groups with Settings

```http
GET /api/settings/groups
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "smtp",
      "name": "SMTP Mail Settings",
      "description": "Email server configuration for sending notifications",
      "icon": "mail",
      "sort_order": 1,
      "settings": [
        {
          "key": "smtp.host",
          "value": "smtp.gmail.com",
          "description": "SMTP server hostname",
          "is_encrypted": false,
          "created_at": "2025-01-06T20:00:00.000Z",
          "updated_at": "2025-01-06T20:00:00.000Z"
        }
      ],
      "created_at": "2025-01-06T20:00:00.000Z",
      "updated_at": "2025-01-06T20:00:00.000Z"
    }
  ]
}
```

#### Get Specific Group

```http
GET /api/settings/groups/:groupId
Authorization: Bearer <token>
```

#### Create Group

```http
POST /api/settings/groups
Authorization: Bearer <token>
Content-Type: application/json

{
  "id": "api-keys",
  "name": "API Keys",
  "description": "External service API keys and credentials",
  "icon": "key",
  "sort_order": 3
}
```

#### Update Group

```http
PUT /api/settings/groups/:groupId
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Group Name",
  "description": "Updated description",
  "sort_order": 2
}
```

### Settings Management

#### List All Settings

```http
GET /api/settings
Authorization: Bearer <token>
```

#### Get Settings by Group

```http
GET /api/settings/group/:groupId
Authorization: Bearer <token>
```

**Example:**

```http
GET /api/settings/group/smtp
```

#### Get Specific Setting

```http
GET /api/settings/:key
Authorization: Bearer <token>
```

#### Create New Setting

```http
POST /api/settings
Authorization: Bearer <token>
Content-Type: application/json

{
  "key": "smtp.password",
  "value": "secret123",
  "description": "SMTP server password",
  "encrypted": true,
  "group_id": "smtp"
}
```

#### Update Existing Setting

```http
PUT /api/settings/:key
Authorization: Bearer <token>
Content-Type: application/json

{
  "value": "new-secret-value",
  "description": "Updated SMTP password",
  "encrypted": true,
  "group_id": "smtp"
}
```

#### Delete Setting

```http
DELETE /api/settings/:key
Authorization: Bearer <token>
```

#### Search Settings

```http
POST /api/settings/search
Authorization: Bearer <token>
Content-Type: application/json

{
  "pattern": "smtp"
}
```

#### Bulk Create/Update Settings

```http
POST /api/settings/bulk
Authorization: Bearer <token>
Content-Type: application/json

{
  "settings": [
    {
      "key": "smtp.host",
      "value": "smtp.gmail.com",
      "group_id": "smtp"
    },
    {
      "key": "smtp.port",
      "value": "587",
      "group_id": "smtp"
    },
    {
      "key": "smtp.password",
      "value": "secret123",
      "encrypted": true,
      "group_id": "smtp"
    }
  ]
}
```

#### Health Check

```http
GET /api/settings/health
Authorization: Bearer <token>
```

## Usage Examples

### SMTP Configuration

```typescript
import { GlobalSettingsService } from '../services/globalSettingsService';

// Set SMTP configuration
await GlobalSettingsService.set('smtp.host', 'smtp.gmail.com', { 
  group_id: 'smtp',
  description: 'SMTP server hostname'
});

await GlobalSettingsService.set('smtp.port', '587', { 
  group_id: 'smtp',
  description: 'SMTP server port'
});

await GlobalSettingsService.set('smtp.username', 'user@gmail.com', { 
  group_id: 'smtp',
  description: 'SMTP authentication username'
});

await GlobalSettingsService.set('smtp.password', 'app-password', { 
  group_id: 'smtp',
  description: 'SMTP authentication password',
  encrypted: true
});

// Retrieve SMTP configuration by group
const smtpSettings = await GlobalSettingsService.getByGroup('smtp');
const smtpConfig = {
  host: smtpSettings.find(s => s.key === 'smtp.host')?.value,
  port: parseInt(smtpSettings.find(s => s.key === 'smtp.port')?.value || '587'),
  auth: {
    user: smtpSettings.find(s => s.key === 'smtp.username')?.value,
    pass: smtpSettings.find(s => s.key === 'smtp.password')?.value,
  }
};
```

### API Keys Management

```typescript
// Store encrypted API keys
await GlobalSettingsService.set('api.openai.key', 'sk-...', { 
  group_id: 'api-keys',
  description: 'OpenAI API key for AI integrations',
  encrypted: true
});

await GlobalSettingsService.set('api.aws.access_key', 'AKIA...', { 
  group_id: 'api-keys',
  description: 'AWS access key for cloud services',
  encrypted: true
});

// Retrieve API configuration by group
const apiSettings = await GlobalSettingsService.getByGroup('api-keys');
const openaiKey = apiSettings.find(s => s.key === 'api.openai.key')?.value;
```

## Auto-Initialization System

### Overview

The auto-initialization system automatically creates missing groups and global settings when the server starts. This ensures that all required groups and settings are available without manual configuration, while preserving existing values.

### File-Based Setting Definitions

Settings are defined in TypeScript files within the `src/global-settings/` directory:

```text
src/global-settings/
├── types.ts              # Type definitions
├── index.ts              # Auto-discovery service
├── smtp.ts               # SMTP configuration
├── github-oauth.ts       # GitHub OAuth settings
└── [custom].ts           # Your custom settings
```

### Setting Definition Format

Each setting file exports a `GlobalSettingsModule` with group metadata:

```typescript
// src/global-settings/smtp.ts
import type { GlobalSettingsModule } from './types';

export const smtpSettings: GlobalSettingsModule = {
  group: {
    id: 'smtp',
    name: 'SMTP Mail Settings',
    description: 'Email server configuration for sending notifications',
    icon: 'mail',
    sort_order: 1
  },
  settings: [
    {
      key: 'smtp.host',
      defaultValue: '',
      description: 'SMTP server hostname (e.g., smtp.gmail.com)',
      encrypted: false,
      required: true
    },
    {
      key: 'smtp.password',
      defaultValue: '',
      description: 'SMTP authentication password',
      encrypted: true,
      required: true
    }
    // ... more settings
  ]
};
```

### Startup Behavior

When the server starts:

1. **Discovery**: Scans `src/global-settings/` for `.ts` files
2. **Loading**: Dynamically imports each settings module
3. **Validation**: Ensures each module has the correct structure
4. **Group Creation**: Creates missing groups with metadata
5. **Database Check**: Checks which settings exist in the database
6. **Creation**: Creates missing settings with default values and group links
7. **Preservation**: Skips existing settings (non-destructive)
8. **Logging**: Reports initialization results

### Example Startup Output

```text
🔄 Loading global settings definitions...
📁 Found 2 setting files: smtp, github-oauth
✅ Loaded settings module: smtp (7 settings)
✅ Loaded settings module: github-oauth (5 settings)
🎉 Loaded 2 settings modules with 12 total settings
🔄 Creating 2 setting groups...
✅ Created group: smtp (SMTP Mail Settings)
✅ Created group: github-oauth (GitHub OAuth Configuration)
🔄 Initializing 12 global settings...
✅ Created setting: smtp.host
✅ Created setting: smtp.port
✅ Created setting: smtp.username
✅ Created setting: smtp.password
⏭️  Skipped existing setting: smtp.secure
✅ Created setting: github.oauth.client_id
✅ Created setting: github.oauth.client_secret
🎉 Global settings initialization complete: 6 created, 1 skipped
⚠️  Missing required settings: smtp.host, smtp.username, smtp.password
```

### Built-in Setting Groups

#### SMTP Settings (Group ID: `smtp`)

| Key | Default | Required | Encrypted | Description |
|-----|---------|----------|-----------|-------------|
| `smtp.host` | `''` | ✅ | ❌ | SMTP server hostname |
| `smtp.port` | `'587'` | ✅ | ❌ | SMTP server port |
| `smtp.username` | `''` | ✅ | ❌ | SMTP authentication username |
| `smtp.password` | `''` | ✅ | ✅ | SMTP authentication password |
| `smtp.secure` | `'true'` | ❌ | ❌ | Use SSL/TLS connection |
| `smtp.from_name` | `'DeployStack'` | ❌ | ❌ | Default sender name |
| `smtp.from_email` | `''` | ❌ | ❌ | Default sender email |

#### GitHub OAuth Settings (Group ID: `github-oauth`)

| Key | Default | Required | Encrypted | Description |
|-----|---------|----------|-----------|-------------|
| `github.oauth.client_id` | `''` | ❌ | ❌ | GitHub OAuth client ID |
| `github.oauth.client_secret` | `''` | ❌ | ✅ | GitHub OAuth client secret |
| `github.oauth.enabled` | `'false'` | ❌ | ❌ | Enable GitHub OAuth |
| `github.oauth.callback_url` | `'http://localhost:3000/api/auth/github/callback'` | ❌ | ❌ | OAuth callback URL |
| `github.oauth.scope` | `'user:email'` | ❌ | ❌ | OAuth requested scopes |

### Helper Methods

The system provides helper methods for retrieving complete configurations:

```typescript
import { GlobalSettingsInitService } from '../global-settings';

// Get complete SMTP configuration
const smtpConfig = await GlobalSettingsInitService.getSmtpConfiguration();
if (smtpConfig) {
  // Use smtpConfig.host, smtpConfig.port, etc.
}

// Get complete GitHub OAuth configuration
const githubConfig = await GlobalSettingsInitService.getGitHubOAuthConfiguration();
if (githubConfig && githubConfig.enabled) {
  // Use githubConfig.clientId, githubConfig.clientSecret, etc.
}

// Check if services are configured
const isSmtpReady = await GlobalSettingsInitService.isSmtpConfigured();
const isGitHubReady = await GlobalSettingsInitService.isGitHubOAuthConfigured();
```

### Adding New Setting Groups (Core)

To add a new core setting group (managed directly by the application):

1. **Create Setting File**: Add a new `.ts` file in `src/global-settings/`

```typescript
// src/global-settings/my-service.ts
import type { GlobalSettingsModule } from './types';

export const myServiceSettings: GlobalSettingsModule = {
  group: {
    id: 'my-service',
    name: 'My Service Configuration',
    description: 'Settings for My Service integration',
    icon: 'service',
    sort_order: 3
  },
  settings: [
    {
      key: 'my-service.api_key',
      defaultValue: '',
      description: 'API key for My Service',
      encrypted: true,
      required: true
    },
    {
      key: 'my-service.enabled',
      defaultValue: 'false',
      description: 'Enable My Service integration',
      encrypted: false,
      required: false
    }
  ]
};
```

2. **Restart Server**: The new group and settings will be automatically discovered and initialized

3. **Add Helper Method** (optional): Add a helper method to `GlobalSettingsInitService`

```typescript
// In src/global-settings/index.ts
static async getMyServiceConfiguration(): Promise<MyServiceConfig | null> {
  const settings = await GlobalSettingsService.getByGroup('my-service');
  
  const apiKey = settings.find(s => s.key === 'my-service.api_key')?.value;
  const enabled = settings.find(s => s.key === 'my-service.enabled')?.value;
  
  if (enabled !== 'true' || !apiKey) {
    return null;
  }
  
  return {
    apiKey,
    enabled: enabled === 'true'
  };
}
```

## Frontend Integration

The group-based system is designed for easy frontend integration:

### Dynamic Tab Creation

```typescript
// Frontend can easily create tabs from groups
const response = await fetch('/api/settings/groups');
const { data: groups } = await response.json();

groups.forEach(group => {
  createTab({
    id: group.id,           // For routing: /settings/smtp
    label: group.name,      // Display: "SMTP Mail Settings"
    icon: group.icon,       // UI icon
    description: group.description,
    settings: group.settings, // Tab content
    sortOrder: group.sort_order
  });
});
```

### Group Management

```typescript
// Get settings for a specific tab/group
const smtpSettings = await fetch('/api/settings/group/smtp');

// Update a setting within a group
await fetch('/api/settings/smtp.host', {
  method: 'PUT',
  body: JSON.stringify({
    value: 'new-smtp-host.com',
    group_id: 'smtp'
  })
});
```

### System Configuration

```typescript
// System-wide feature flags and configuration
await GlobalSettingsService.set('system.maintenance_mode', 'false', { 
  group_id: 'system',
  description: 'Enable/disable maintenance mode'
});

await GlobalSettingsService.set('system.max_upload_size', '10485760', { 
  group_id: 'system',
  description: 'Maximum file upload size in bytes (10MB)'
});

await GlobalSettingsService.set('system.debug_logging', 'false', { 
  group_id: 'system',
  description: 'Enable debug logging'
});

// Check system configuration
const maintenanceMode = (await GlobalSettingsService.get('system.maintenance_mode'))?.value === 'true';
const maxUploadSize = parseInt((await GlobalSettingsService.get('system.max_upload_size'))?.value || '5242880');
```

## Best Practices

### Key Naming Conventions

- Use dot notation for hierarchy: `category.subcategory.setting`
- Use lowercase with underscores for readability: `smtp.max_retry_count`
- Be descriptive but concise: `api.openai.key` not `api.openai.api_key`
- Group related settings: `database.host`, `database.port`, `database.name`

### Group Design

- **Logical Grouping**: Group related settings together (e.g., all SMTP settings)
- **Clear Names**: Use descriptive group names for frontend display
- **Consistent Icons**: Use consistent iconography across groups
- **Proper Ordering**: Set sort_order to control tab display sequence

### Setting Organization

- **Hierarchical Keys**: Use dot notation within groups: `group.subcategory.setting`
- **Group Consistency**: Keep all related settings in the same group
- **Clear Descriptions**: Provide helpful descriptions for administrators

### Security Guidelines

- **Always encrypt sensitive data**: Passwords, API keys, tokens, secrets
- **Use descriptive descriptions**: Help other administrators understand the purpose
- **Group sensitive settings**: Keep all sensitive settings for a service in one group
- **Regular audits**: Review settings periodically for unused or outdated values
- **Environment separation**: Use different encryption secrets for different environments

### Performance Considerations

- **Cache frequently accessed settings**: Consider caching non-sensitive, frequently used settings
- **Batch operations**: Use bulk endpoints when creating multiple related settings
- **Minimize database calls**: Retrieve settings by group when you need multiple related values

### Error Handling

```typescript
try {
  const setting = await GlobalSettingsService.get('api.openai.key');
  if (!setting) {
    throw new Error('OpenAI API key not configured');
  }
  // Use the setting
} catch (error) {
  console.error('Failed to retrieve setting:', error);
  // Handle the error appropriately
}
```

## Migration and Setup

### Initial Setup

1. **Environment Variable**: Set `DEPLOYSTACK_ENCRYPTION_SECRET` in your environment
2. **Database Migration**: Run `npm run db:generate` and restart the server
3. **Admin Access**: Ensure you have a user with `global_admin` role

### Migrating from Category-Based System

The new group-based system replaces the old category-based approach. The migration is handled automatically:

1. **Database Migration**: The `category` column is renamed to `group_id`
2. **Auto-Initialization**: Groups are created automatically from setting definitions
3. **Setting Linking**: Existing settings are linked to appropriate groups

## Plugin-Contributed Global Settings

In addition to core global settings, plugins can also define and register their own global settings and setting groups. These are managed through the same system and are subject to the same access controls (i.e., editable by `global_admin`).

Key points for plugin-contributed settings:

- **Declaration**: Plugins declare global settings via a `globalSettingsExtension` property in their main class.
- **Initialization**: The `PluginManager` processes these definitions at startup, creating new groups and settings if they don't already exist.
- **Precedence**: Core global settings always take precedence. If a plugin tries to define a setting with a key that already exists (either from core or another plugin), the plugin's definition for that specific key is ignored.
- **Documentation**: For details on how plugins can define global settings, refer to the [PLUGINS.MD](PLUGINS.MD) document.

## API Reference Summary

| Endpoint | Method | Permission | Description |
|----------|--------|------------|-------------|
| `/api/settings/groups` | GET | `settings.view` | List all groups with settings |
| `/api/settings/groups/:groupId` | GET | `settings.view` | Get specific group |
| `/api/settings/groups` | POST | `settings.edit` | Create new group |
| `/api/settings/groups/:groupId` | PUT | `settings.edit` | Update group |
| `/api/settings` | GET | `settings.view` | List all settings |
| `/api/settings/:key` | GET | `settings.view` | Get specific setting |
| `/api/settings` | POST | `settings.edit` | Create new setting |
| `/api/settings/:key` | PUT | `settings.edit` | Update setting |
| `/api/settings/:key` | DELETE | `settings.delete` | Delete setting |
| `/api/settings/group/:groupId` | GET | `settings.view` | Get settings by group |
| `/api/settings/search` | POST | `settings.view` | Search settings |
| `/api/settings/bulk` | POST | `settings.edit` | Bulk create/update |
| `/api/settings/health` | GET | `settings.view` | System health check |

---

For more information about the role-based access control system, see [ROLES.md](ROLES.md).
For security details, see [SECURITY.md](SECURITY.md).
