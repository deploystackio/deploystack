# Email Integration Documentation

This document describes the email system integration in DeployStack, including the email service, template system, and usage examples.

## Overview

The email system provides a comprehensive solution for sending templated emails using:

- **Nodemailer**: For SMTP email delivery
- **Pug Templates**: For beautiful, maintainable email templates
- **Global Settings Integration**: Automatic SMTP configuration from global settings
- **Zod Validation**: Type-safe email parameter validation
- **Template Caching**: Performance optimization for template rendering

## Architecture

```text
src/email/
├── emailService.ts       # Main email service with SMTP integration
├── templateRenderer.ts   # Pug template compilation and rendering
├── types.ts             # TypeScript interfaces and Zod schemas
├── index.ts             # Module exports
└── templates/
    ├── layouts/
    │   ├── base.pug     # Main email layout
    │   ├── header.pug   # Email header component
    │   └── footer.pug   # Email footer component
    ├── welcome.pug      # Welcome email template
    ├── password-reset.pug # Password reset template
    └── notification.pug # General notification template
```

## SMTP Configuration

The email system automatically integrates with your existing SMTP global settings. Ensure the following settings are configured in the global settings:

| Setting | Required | Description |
|---------|----------|-------------|
| `smtp.host` | ✅ | SMTP server hostname (e.g., smtp.gmail.com) |
| `smtp.port` | ✅ | SMTP server port (587 for TLS, 465 for SSL) |
| `smtp.username` | ✅ | SMTP authentication username |
| `smtp.password` | ✅ | SMTP authentication password (encrypted) |
| `smtp.secure` | ❌ | Use SSL/TLS connection (default: true) |
| `smtp.from_name` | ❌ | Default sender name (default: DeployStack) |
| `smtp.from_email` | ❌ | Default sender email (default: username) |

## Basic Usage

### Import the Email Service

```typescript
import { EmailService } from '../email';
// or
import EmailService from '../email';
```

### Send a Basic Email

```typescript
const result = await EmailService.sendEmail({
  to: 'user@example.com',
  subject: 'Welcome to DeployStack',
  template: 'welcome',
  variables: {
    userName: 'John Doe',
    userEmail: 'user@example.com',
    loginUrl: 'https://app.deploystack.com/login',
    supportEmail: 'support@deploystack.com'
  }
});

if (result.success) {
  console.log('Email sent successfully:', result.messageId);
} else {
  console.error('Failed to send email:', result.error);
}
```

### Send to Multiple Recipients

```typescript
const result = await EmailService.sendEmail({
  to: ['user1@example.com', 'user2@example.com'],
  subject: 'System Maintenance Notice',
  template: 'notification',
  variables: {
    title: 'Scheduled Maintenance',
    message: 'We will be performing system maintenance on Sunday at 2 AM UTC.',
    actionUrl: 'https://status.deploystack.com',
    actionText: 'View Status Page'
  }
});
```

## Type-Safe Helper Methods

The email service provides type-safe helper methods for common email types:

### Welcome Email

```typescript
const result = await EmailService.sendWelcomeEmail({
  to: 'newuser@example.com',
  userName: 'Jane Smith',
  userEmail: 'newuser@example.com',
  loginUrl: 'https://app.deploystack.com/login',
  supportEmail: 'support@deploystack.com' // optional
});
```

### Password Reset Email

```typescript
const result = await EmailService.sendPasswordResetEmail({
  to: 'user@example.com',
  userName: 'John Doe',
  resetUrl: 'https://app.deploystack.com/reset-password?token=abc123',
  expirationTime: '24 hours',
  supportEmail: 'support@deploystack.com' // optional
});
```

### Notification Email

```typescript
const result = await EmailService.sendNotificationEmail({
  to: 'user@example.com',
  title: 'Deployment Complete',
  message: 'Your application has been successfully deployed to production.',
  actionUrl: 'https://app.deploystack.com/deployments/123',
  actionText: 'View Deployment',
  userName: 'John Doe' // optional
});
```

## Advanced Usage

### Custom From Address

```typescript
const result = await EmailService.sendEmail({
  to: 'user@example.com',
  subject: 'Custom Sender Example',
  template: 'notification',
  from: {
    name: 'DeployStack Notifications',
    email: 'notifications@deploystack.com'
  },
  variables: {
    title: 'Custom Message',
    message: 'This email is sent from a custom sender.'
  }
});
```

### Email with Attachments

```typescript
const result = await EmailService.sendEmail({
  to: 'user@example.com',
  subject: 'Report Attached',
  template: 'notification',
  variables: {
    title: 'Monthly Report',
    message: 'Please find your monthly deployment report attached.'
  },
  attachments: [
    {
      filename: 'report.pdf',
      content: reportBuffer,
      contentType: 'application/pdf'
    }
  ]
});
```

### CC and BCC Recipients

```typescript
const result = await EmailService.sendEmail({
  to: 'primary@example.com',
  cc: ['manager@example.com'],
  bcc: ['audit@example.com'],
  subject: 'Important Update',
  template: 'notification',
  variables: {
    title: 'System Update',
    message: 'Important system update notification.'
  }
});
```

## Template System

### Available Templates

| Template | Description | Required Variables |
|----------|-------------|-------------------|
| `welcome` | Welcome email for new users | `userName`, `userEmail`, `loginUrl` |
| `password-reset` | Password reset instructions | `userName`, `resetUrl`, `expirationTime` |
| `notification` | General notification template | `title`, `message` |

### Template Variables

All templates have access to these common variables:

- `currentYear`: Current year (automatically injected)
- `appName`: Application name (default: 'DeployStack')
- `supportEmail`: Support email address (if provided)

### Creating Custom Templates

1. **Create a new Pug template** in `src/email/templates/`:

```pug
//- custom-template.pug
//- @description Custom email template
//- @variables customVar1, customVar2
extends layouts/base.pug

block content
  h1 Custom Email
  
  p Hello #{customVar1}!
  
  p= customVar2
  
  .text-center
    a.button(href="https://example.com") Take Action
```

2. **Add TypeScript types** in `src/email/types.ts`:

```typescript
export interface CustomEmailVariables {
  customVar1: string;
  customVar2: string;
}

// Add to TemplateVariableMap
export interface TemplateVariableMap {
  welcome: WelcomeEmailVariables;
  'password-reset': PasswordResetEmailVariables;
  notification: NotificationEmailVariables;
  'custom-template': CustomEmailVariables; // Add this line
}
```

3. **Use the custom template**:

```typescript
const result = await EmailService.sendEmail({
  to: 'user@example.com',
  subject: 'Custom Email',
  template: 'custom-template',
  variables: {
    customVar1: 'John',
    customVar2: 'This is a custom message.'
  }
});
```

## Template Layout System

### Base Layout

The base layout (`layouts/base.pug`) provides:

- Responsive HTML email structure
- Cross-client CSS compatibility
- Header and footer inclusion
- Mobile-friendly design
- Professional styling

### Header Component

The header (`layouts/header.pug`) displays:

- Application name/logo
- Consistent branding
- Professional appearance

### Footer Component

The footer (`layouts/footer.pug`) includes:

- Copyright information
- Contact information
- Unsubscribe/support links
- Legal disclaimers

### Customizing Layouts

To customize the layout, modify the files in `src/email/templates/layouts/`:

```pug
//- layouts/header.pug
.header
  img(src="https://your-domain.com/logo.png" alt="Your Logo" style="height: 40px;")
  h1= appName || 'Your App Name'
```

## Utility Methods

### Test SMTP Connection

```typescript
const status = await EmailService.testConnection();
if (status.success) {
  console.log('SMTP connection successful');
} else {
  console.error('SMTP connection failed:', status.error);
}
```

### Check SMTP Configuration

```typescript
const status = await EmailService.getSmtpStatus();
if (status.configured) {
  console.log('SMTP is configured');
} else {
  console.error('SMTP not configured:', status.error);
}
```

### Refresh Configuration

```typescript
// Call this after updating SMTP settings
await EmailService.refreshConfiguration();
```

### Get Available Templates

```typescript
const templates = EmailService.getAvailableTemplates();
console.log('Available templates:', templates);
// Output: ['welcome', 'password-reset', 'notification']
```

### Validate Template

```typescript
const validation = await EmailService.validateTemplate('welcome', {
  userName: 'John',
  userEmail: 'john@example.com',
  loginUrl: 'https://app.com/login'
});

if (validation.valid) {
  console.log('Template is valid');
} else {
  console.error('Template validation failed:', validation.errors);
}
```

## Error Handling

The email service provides comprehensive error handling:

```typescript
const result = await EmailService.sendEmail({
  to: 'invalid-email',
  subject: 'Test',
  template: 'welcome',
  variables: { userName: 'Test' }
});

if (!result.success) {
  switch (result.error) {
    case 'SMTP configuration is not available or invalid':
      // Handle SMTP configuration issues
      break;
    case 'Template \'welcome\' not found':
      // Handle missing template
      break;
    default:
      // Handle other errors
      console.error('Email failed:', result.error);
  }
}
```

## Performance Considerations

### Template Caching

Templates are automatically cached after first compilation:

```typescript
// First call compiles and caches the template
await EmailService.sendEmail({ template: 'welcome', ... });

// Subsequent calls use cached template (faster)
await EmailService.sendEmail({ template: 'welcome', ... });
```

### Clear Cache (Development)

```typescript
import { TemplateRenderer } from '../email';

// Clear template cache during development
TemplateRenderer.clearCache();
```

### Connection Pooling

The email service uses connection pooling for better performance:

- Maximum 5 concurrent connections
- Maximum 100 messages per connection
- Rate limiting: 5 emails per 20 seconds

## Security Best Practices

### Input Validation

All email parameters are validated using Zod schemas:

```typescript
// This will throw a validation error
await EmailService.sendEmail({
  to: 'invalid-email-format',  // ❌ Invalid email
  subject: '',                 // ❌ Empty subject
  template: '',               // ❌ Empty template
  variables: {}
});
```

### Template Security

- Templates are compiled server-side (no client-side execution)
- Variable injection is escaped by default
- No arbitrary code execution in templates

### SMTP Security

- Passwords are encrypted in global settings
- Secure connections (TLS/SSL) are supported
- Connection pooling with rate limiting

## Integration Examples

### User Registration

```typescript
// In your user registration service
import { EmailService } from '../email';

export class UserService {
  static async registerUser(userData: UserRegistrationData) {
    // Create user account
    const user = await this.createUser(userData);
    
    // Send welcome email
    const emailResult = await EmailService.sendWelcomeEmail({
      to: user.email,
      userName: user.name,
      userEmail: user.email,
      loginUrl: `${process.env.FRONTEND_URL}/login`,
      supportEmail: 'support@deploystack.com'
    });
    
    if (!emailResult.success) {
      console.error('Failed to send welcome email:', emailResult.error);
      // Don't fail registration if email fails
    }
    
    return user;
  }
}
```

### Password Reset Flow

```typescript
// In your auth service
import { EmailService } from '../email';

export class AuthService {
  static async requestPasswordReset(email: string) {
    const user = await this.findUserByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }
    
    // Generate reset token
    const resetToken = await this.generateResetToken(user.id);
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    // Send reset email
    const emailResult = await EmailService.sendPasswordResetEmail({
      to: user.email,
      userName: user.name,
      resetUrl,
      expirationTime: '24 hours',
      supportEmail: 'support@deploystack.com'
    });
    
    if (!emailResult.success) {
      throw new Error('Failed to send password reset email');
    }
    
    return { message: 'Password reset email sent' };
  }
}
```

### Deployment Notifications

```typescript
// In your deployment service
import { EmailService } from '../email';

export class DeploymentService {
  static async notifyDeploymentComplete(deploymentId: string) {
    const deployment = await this.getDeployment(deploymentId);
    const user = await this.getUser(deployment.userId);
    
    const emailResult = await EmailService.sendNotificationEmail({
      to: user.email,
      title: 'Deployment Complete',
      message: `Your deployment "${deployment.name}" has been successfully completed.`,
      actionUrl: `${process.env.FRONTEND_URL}/deployments/${deploymentId}`,
      actionText: 'View Deployment',
      userName: user.name
    });
    
    if (!emailResult.success) {
      console.error('Failed to send deployment notification:', emailResult.error);
    }
  }
}
```

## Troubleshooting

### Common Issues

1. **SMTP Configuration Not Found**

   ```text
   Error: SMTP configuration is not complete. Please configure SMTP settings in global settings.
   ```

   **Solution**: Configure SMTP settings in the global settings interface.

2. **Template Not Found**

   ```text
   Error: Template 'welcome' not found at /path/to/templates/welcome.pug
   ```

   **Solution**: Ensure the template file exists in the templates directory.

3. **Invalid Email Address**

   ```text
   Error: Invalid email address
   ```

   **Solution**: Validate email addresses before sending.

4. **SMTP Connection Failed**

   ```text
   Error: Connection timeout
   ```

   **Solution**: Check SMTP server settings and network connectivity.

### Debug Mode

Enable debug logging for email operations:

```typescript
// Set environment variable
process.env.DEBUG_EMAIL = 'true';

// Or log email results
const result = await EmailService.sendEmail({...});
console.log('Email result:', result);
```

### Testing SMTP Configuration

```typescript
// Test SMTP connection before sending emails
const connectionTest = await EmailService.testConnection();
if (!connectionTest.success) {
  console.error('SMTP test failed:', connectionTest.error);
  return;
}

// Proceed with sending emails
const emailResult = await EmailService.sendEmail({...});
```

## Best Practices

1. **Always handle email failures gracefully** - Don't let email failures break your main application flow
2. **Use type-safe helper methods** when possible for better developer experience
3. **Test email templates** in different email clients for compatibility
4. **Monitor email delivery** and set up alerts for failures
5. **Use meaningful subject lines** and clear call-to-action buttons
6. **Respect user preferences** for email notifications
7. **Keep templates simple** and mobile-friendly
8. **Cache templates** in production for better performance

## API Reference

### EmailService Methods

| Method | Description | Returns |
|--------|-------------|---------|
| `sendEmail(options)` | Send an email using a template | `Promise<EmailSendResult>` |
| `sendWelcomeEmail(options)` | Send a welcome email | `Promise<EmailSendResult>` |
| `sendPasswordResetEmail(options)` | Send a password reset email | `Promise<EmailSendResult>` |
| `sendNotificationEmail(options)` | Send a notification email | `Promise<EmailSendResult>` |
| `testConnection()` | Test SMTP connection | `Promise<{success: boolean, error?: string}>` |
| `getSmtpStatus()` | Check SMTP configuration status | `Promise<{configured: boolean, error?: string}>` |
| `refreshConfiguration()` | Reload SMTP configuration | `Promise<void>` |
| `getAvailableTemplates()` | Get list of available templates | `string[]` |
| `validateTemplate(template, variables)` | Validate template and variables | `Promise<TemplateValidationResult>` |

### TemplateRenderer Methods

| Method | Description | Returns |
|--------|-------------|---------|
| `render(options)` | Render a template with variables | `Promise<string>` |
| `validateTemplate(template, variables)` | Validate template | `Promise<TemplateValidationResult>` |
| `getAvailableTemplates()` | Get available templates | `string[]` |
| `clearCache()` | Clear template cache | `void` |
| `getTemplateMetadata(template)` | Get template metadata | `{description?: string, requiredVariables?: string[]}` |

---

For more information about global settings configuration, see [GLOBAL_SETTINGS.md](GLOBAL_SETTINGS.md).
