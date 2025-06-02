# Global Settings Management

This document describes the global key-value store system for managing application-wide configuration and credentials in DeployStack.

## Overview

The global settings system provides secure storage for application-wide configuration values such as:

- **SMTP Server Credentials**: Host, port, username, password for email functionality
- **OAuth Credentials**: GitHub OAuth client ID and secret for authentication
- **API Keys**: External service credentials (OpenAI, AWS, etc.)
- **System Configuration**: Application-wide settings and feature flags
- **Integration Credentials**: Third-party service authentication tokens
- **Environment Variables**: Dynamic configuration that can be changed without code deployment

### Auto-Initialization System

The system includes an **auto-initialization feature** that automatically creates missing global settings when the server starts. Settings are defined in modular files within the `src/global-settings/` directory, and the system will:

- Scan for setting definition files on startup
- Check which settings exist in the database
- Create missing settings with default values (non-destructive)
- Preserve existing settings and their values
- Log initialization results for transparency

## Key Features

- **Hierarchical Keys**: Dot notation organization (e.g., `smtp.host`, `api.openai.key`)
- **Encryption Support**: Automatic encryption for sensitive values using AES-256-GCM
- **Categorization**: Group related settings together for better organization
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
CREATE TABLE globalSettings (
  key TEXT PRIMARY KEY,                    -- Setting identifier (e.g., 'smtp.host')
  value TEXT NOT NULL,                     -- Setting value (encrypted if sensitive)
  description TEXT,                        -- Human-readable description
  is_encrypted BOOLEAN NOT NULL DEFAULT FALSE, -- Whether value is encrypted
  category TEXT,                           -- Grouping category (e.g., 'smtp', 'api')
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

### List All Settings

```http
GET /api/settings
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "key": "smtp.host",
      "value": "smtp.gmail.com",
      "description": "SMTP server hostname",
      "is_encrypted": false,
      "category": "smtp",
      "created_at": "2025-01-06T20:00:00.000Z",
      "updated_at": "2025-01-06T20:00:00.000Z"
    }
  ]
}
```

### Get Specific Setting

```http
GET /api/settings/:key
Authorization: Bearer <token>
```

**Example:**

```http
GET /api/settings/smtp.host
```

### Create New Setting

```http
POST /api/settings
Authorization: Bearer <token>
Content-Type: application/json

{
  "key": "smtp.password",
  "value": "secret123",
  "description": "SMTP server password",
  "encrypted": true,
  "category": "smtp"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "key": "smtp.password",
    "value": "secret123",
    "description": "SMTP server password",
    "is_encrypted": true,
    "category": "smtp",
    "created_at": "2025-01-06T20:00:00.000Z",
    "updated_at": "2025-01-06T20:00:00.000Z"
  },
  "message": "Global setting created successfully"
}
```

### Update Existing Setting

```http
PUT /api/settings/:key
Authorization: Bearer <token>
Content-Type: application/json

{
  "value": "new-secret-value",
  "description": "Updated SMTP password",
  "encrypted": true
}
```

### Delete Setting

```http
DELETE /api/settings/:key
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "message": "Global setting deleted successfully"
}
```

### Get Settings by Category

```http
GET /api/settings/category/:category
Authorization: Bearer <token>
```

**Example:**

```http
GET /api/settings/category/smtp
```

### Get All Categories

```http
GET /api/settings/categories
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "data": ["smtp", "api", "system"]
}
```

### Search Settings

```http
POST /api/settings/search
Authorization: Bearer <token>
Content-Type: application/json

{
  "pattern": "smtp"
}
```

### Bulk Create/Update Settings

```http
POST /api/settings/bulk
Authorization: Bearer <token>
Content-Type: application/json

{
  "settings": [
    {
      "key": "smtp.host",
      "value": "smtp.gmail.com",
      "category": "smtp"
    },
    {
      "key": "smtp.port",
      "value": "587",
      "category": "smtp"
    },
    {
      "key": "smtp.password",
      "value": "secret123",
      "encrypted": true,
      "category": "smtp"
    }
  ]
}
```

### Health Check

```http
GET /api/settings/health
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "encryption_working": true,
    "timestamp": "2025-01-06T20:00:00.000Z"
  },
  "message": "Global settings system is healthy"
}
```

## Usage Examples

### SMTP Configuration

```typescript
import { GlobalSettingsService } from '../services/globalSettingsService';

// Set SMTP configuration
await GlobalSettingsService.set('smtp.host', 'smtp.gmail.com', { 
  category: 'smtp',
  description: 'SMTP server hostname'
});

await GlobalSettingsService.set('smtp.port', '587', { 
  category: 'smtp',
  description: 'SMTP server port'
});

await GlobalSettingsService.set('smtp.username', 'user@gmail.com', { 
  category: 'smtp',
  description: 'SMTP authentication username'
});

await GlobalSettingsService.set('smtp.password', 'app-password', { 
  category: 'smtp',
  description: 'SMTP authentication password',
  encrypted: true
});

// Retrieve SMTP configuration
const smtpSettings = await GlobalSettingsService.getByCategory('smtp');
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
  category: 'api',
  description: 'OpenAI API key for AI integrations',
  encrypted: true
});

await GlobalSettingsService.set('api.aws.access_key', 'AKIA...', { 
  category: 'api',
  description: 'AWS access key for cloud services',
  encrypted: true
});

await GlobalSettingsService.set('api.aws.secret_key', 'secret...', { 
  category: 'api',
  description: 'AWS secret key for cloud services',
  encrypted: true
});

// Retrieve API configuration
const openaiKey = await GlobalSettingsService.get('api.openai.key');
const awsConfig = {
  accessKeyId: (await GlobalSettingsService.get('api.aws.access_key'))?.value,
  secretAccessKey: (await GlobalSettingsService.get('api.aws.secret_key'))?.value,
};
```

### System Configuration

```typescript
// System-wide feature flags and configuration
await GlobalSettingsService.set('system.maintenance_mode', 'false', { 
  category: 'system',
  description: 'Enable/disable maintenance mode'
});

await GlobalSettingsService.set('system.max_upload_size', '10485760', { 
  category: 'system',
  description: 'Maximum file upload size in bytes (10MB)'
});

await GlobalSettingsService.set('system.debug_logging', 'false', { 
  category: 'system',
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

### Security Guidelines

- **Always encrypt sensitive data**: Passwords, API keys, tokens, secrets
- **Use descriptive descriptions**: Help other administrators understand the purpose
- **Categorize settings**: Group related settings for better organization
- **Regular audits**: Review settings periodically for unused or outdated values
- **Environment separation**: Use different encryption secrets for different environments

### Performance Considerations

- **Cache frequently accessed settings**: Consider caching non-sensitive, frequently used settings
- **Batch operations**: Use bulk endpoints when creating multiple related settings
- **Minimize database calls**: Retrieve settings by category when you need multiple related values

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

### Migrating Existing Configuration

If you have existing configuration in environment variables or config files:

```typescript
// Example migration script
const existingConfig = {
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
};

// Migrate to global settings
for (const [envKey, value] of Object.entries(existingConfig)) {
  if (value) {
    const settingKey = envKey.toLowerCase().replace(/_/g, '.');
    const isSecret = envKey.includes('PASS') || envKey.includes('KEY') || envKey.includes('SECRET');
    
    await GlobalSettingsService.set(settingKey, value, {
      encrypted: isSecret,
      category: settingKey.split('.')[0],
      description: `Migrated from ${envKey} environment variable`
    });
  }
}
```

## Troubleshooting

### Common Issues

#### Encryption Errors

**Problem**: `Decryption failed` errors when retrieving settings

**Solutions**:

- Verify `DEPLOYSTACK_ENCRYPTION_SECRET` environment variable is set correctly
- Ensure the same encryption secret is used across all instances
- Check the health endpoint: `GET /api/settings/health`

#### Permission Denied

**Problem**: `403 Forbidden` when accessing settings endpoints

**Solutions**:

- Verify user has `global_admin` role
- Check user permissions include `settings.view`, `settings.edit`, or `settings.delete`
- Ensure authentication token is valid

#### Setting Not Found

**Problem**: Settings return `null` or `404 Not Found`

**Solutions**:

- Verify the setting key exists and is spelled correctly
- Check if the setting was accidentally deleted
- Use search endpoint to find similar keys

### Debug Commands

```bash
# Check encryption health
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/settings/health

# List all settings
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/settings

# Search for settings
curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer <token>" \
  -d '{"pattern":"smtp"}' http://localhost:3000/api/settings/search
```

## Auto-Initialization System

### Overview

The auto-initialization system automatically creates missing global settings when the server starts. This ensures that all required settings are available without manual configuration, while preserving existing values.

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

Each setting file exports a `GlobalSettingsModule`:

```typescript
// src/global-settings/smtp.ts
import type { GlobalSettingsModule } from './types';

export const smtpSettings: GlobalSettingsModule = {
  category: 'smtp',
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
4. **Database Check**: Checks which settings exist in the database
5. **Creation**: Creates missing settings with default values
6. **Preservation**: Skips existing settings (non-destructive)
7. **Logging**: Reports initialization results

### Example Startup Output

```text
🔄 Loading global settings definitions...
📁 Found 2 setting files: smtp, github-oauth
✅ Loaded settings module: smtp (7 settings)
✅ Loaded settings module: github-oauth (5 settings)
🎉 Loaded 2 settings modules with 12 total settings
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

### Built-in Setting Categories

#### SMTP Settings

| Key | Default | Required | Encrypted | Description |
|-----|---------|----------|-----------|-------------|
| `smtp.host` | `''` | ✅ | ❌ | SMTP server hostname |
| `smtp.port` | `'587'` | ✅ | ❌ | SMTP server port |
| `smtp.username` | `''` | ✅ | ❌ | SMTP authentication username |
| `smtp.password` | `''` | ✅ | ✅ | SMTP authentication password |
| `smtp.secure` | `'true'` | ❌ | ❌ | Use SSL/TLS connection |
| `smtp.from_name` | `'DeployStack'` | ❌ | ❌ | Default sender name |
| `smtp.from_email` | `''` | ❌ | ❌ | Default sender email |

#### GitHub OAuth Settings

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

### Adding New Setting Categories

To add a new setting category:

1. **Create Setting File**: Add a new `.ts` file in `src/global-settings/`

```typescript
// src/global-settings/my-service.ts
import type { GlobalSettingsModule } from './types';

export const myServiceSettings: GlobalSettingsModule = {
  category: 'my-service',
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

2. **Restart Server**: The new settings will be automatically discovered and initialized

3. **Add Helper Method** (optional): Add a helper method to `GlobalSettingsInitService`

```typescript
// In src/global-settings/index.ts
static async getMyServiceConfiguration(): Promise<MyServiceConfig | null> {
  const settings = await Promise.all([
    GlobalSettingsService.get('my-service.api_key'),
    GlobalSettingsService.get('my-service.enabled')
  ]);
  
  const [apiKey, enabled] = settings;
  
  if (enabled?.value !== 'true' || !apiKey?.value) {
    return null;
  }
  
  return {
    apiKey: apiKey.value,
    enabled: enabled.value === 'true'
  };
}
```

### Validation and Health Checks

The system provides validation for required settings:

```typescript
// Check all required settings
const validation = await GlobalSettingsInitService.validateRequiredSettings();

if (!validation.valid) {
  console.log('Missing required settings:', validation.missing);
  
  // Check by category
  for (const [category, info] of Object.entries(validation.categories)) {
    if (info.missing > 0) {
      console.log(`${category}: ${info.missing}/${info.total} missing`);
      console.log('Missing keys:', info.missingKeys);
    }
  }
}
```

### Best Practices for Setting Definitions

- **Use Clear Keys**: Follow the `category.subcategory.setting` pattern
- **Provide Descriptions**: Include helpful descriptions for administrators
- **Mark Sensitive Data**: Set `encrypted: true` for passwords, API keys, secrets
- **Set Appropriate Defaults**: Use sensible default values when possible
- **Mark Required Settings**: Set `required: true` for essential settings
- **Group Related Settings**: Use consistent category names

### Non-Destructive Behavior

The auto-initialization system is **completely non-destructive**:

- ✅ **Preserves existing settings**: Never overwrites existing values
- ✅ **Only creates missing settings**: Skips settings that already exist
- ✅ **Maintains user configurations**: Respects administrator changes
- ✅ **Safe to run repeatedly**: Can be run multiple times without issues
- ✅ **Logs all actions**: Transparent about what was created vs. skipped

## Future Enhancements

### Planned Features

- **Setting Templates**: Predefined setting groups for common configurations
- **Environment Overrides**: Allow environment variables to override specific settings
- **Setting Validation**: Custom validation rules for setting values
- **Change History**: Track all changes to settings with full audit trail
- **Setting Dependencies**: Define relationships between settings
- **Backup/Restore**: Export and import setting configurations
- **Setting Notifications**: Alert when critical settings are changed

### Integration Points

- **Email Service**: Automatic SMTP configuration from settings
- **Cloud Providers**: Dynamic API credential management
- **Feature Flags**: Runtime feature toggling
- **Monitoring**: Integration with health check systems
- **CI/CD**: Automated setting deployment and validation

## API Reference Summary

| Endpoint | Method | Permission | Description |
|----------|--------|------------|-------------|
| `/api/settings` | GET | `settings.view` | List all settings |
| `/api/settings/:key` | GET | `settings.view` | Get specific setting |
| `/api/settings` | POST | `settings.edit` | Create new setting |
| `/api/settings/:key` | PUT | `settings.edit` | Update setting |
| `/api/settings/:key` | DELETE | `settings.delete` | Delete setting |
| `/api/settings/category/:category` | GET | `settings.view` | Get settings by category |
| `/api/settings/categories` | GET | `settings.view` | List all categories |
| `/api/settings/search` | POST | `settings.view` | Search settings |
| `/api/settings/bulk` | POST | `settings.edit` | Bulk create/update |
| `/api/settings/health` | GET | `settings.view` | System health check |

---

For more information about the role-based access control system, see [ROLES.md](ROLES.md).
For security details, see [SECURITY.md](SECURITY.md).
