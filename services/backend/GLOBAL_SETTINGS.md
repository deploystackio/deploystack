# Global Settings Management

This document describes the global key-value store system for managing application-wide configuration and credentials in DeployStack.

## Overview

The global settings system provides secure storage for application-wide configuration values such as:

- **SMTP Server Credentials**: Host, port, username, password for email functionality
- **API Keys**: External service credentials (OpenAI, AWS, etc.)
- **System Configuration**: Application-wide settings and feature flags
- **Integration Credentials**: Third-party service authentication tokens
- **Environment Variables**: Dynamic configuration that can be changed without code deployment

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
