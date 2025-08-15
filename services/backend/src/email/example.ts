/**
 * Email Service Usage Examples
 * 
 * This file demonstrates how to use the email service in your application.
 * These examples can be integrated into your existing services.
 */

import type { FastifyBaseLogger } from 'fastify';
import { EmailService } from './emailservice';

/**
 * Example: Send a welcome email to a new user
 */
export async function sendWelcomeEmailExample(logger: FastifyBaseLogger) {
  try {
    const result = await EmailService.sendWelcomeEmail({
      to: 'newuser@example.com',
      userName: 'John Doe',
      userEmail: 'newuser@example.com',
      loginUrl: 'https://app.deploystack.io/login',
      supportEmail: 'support@deploystack.io'
    }, logger);

    if (result.success) {
      logger.info({
        messageId: result.messageId,
        recipients: result.recipients,
        operation: 'welcome_email_example'
      }, '✅ Welcome email sent successfully!');
    } else {
      logger.error({
        error: result.error,
        recipients: result.recipients,
        operation: 'welcome_email_example'
      }, '❌ Failed to send welcome email');
    }

    return result;
  } catch (error) {
    logger.error({
      error,
      operation: 'welcome_email_example'
    }, '❌ Error sending welcome email');
    throw error;
  }
}

/**
 * Example: Send a password reset email
 */
export async function sendPasswordResetExample(logger: FastifyBaseLogger) {
  try {
    const result = await EmailService.sendPasswordResetEmail({
      to: 'user@example.com',
      userName: 'Jane Smith',
      resetUrl: 'https://app.deploystack.io/reset-password?token=abc123xyz',
      expirationTime: '24 hours',
      supportEmail: 'support@deploystack.io'
    }, logger);

    if (result.success) {
      logger.info({
        messageId: result.messageId,
        recipients: result.recipients,
        operation: 'password_reset_example'
      }, '✅ Password reset email sent successfully!');
    } else {
      logger.error({
        error: result.error,
        recipients: result.recipients,
        operation: 'password_reset_example'
      }, '❌ Failed to send password reset email');
    }

    return result;
  } catch (error) {
    logger.error({
      error,
      operation: 'password_reset_example'
    }, '❌ Error sending password reset email');
    throw error;
  }
}

/**
 * Example: Send a notification email
 */
export async function sendNotificationExample(logger: FastifyBaseLogger) {
  try {
    const result = await EmailService.sendNotificationEmail({
      to: 'user@example.com',
      title: 'Deployment Complete',
      message: 'Your application "my-awesome-app" has been successfully deployed to production.',
      actionUrl: 'https://app.deploystack.io/deployments/123',
      actionText: 'View Deployment Details',
      userName: 'Developer'
    }, logger);

    if (result.success) {
      logger.info({
        messageId: result.messageId,
        recipients: result.recipients,
        operation: 'notification_email_example'
      }, '✅ Notification email sent successfully!');
    } else {
      logger.error({
        error: result.error,
        recipients: result.recipients,
        operation: 'notification_email_example'
      }, '❌ Failed to send notification email');
    }

    return result;
  } catch (error) {
    logger.error({
      error,
      operation: 'notification_email_example'
    }, '❌ Error sending notification email');
    throw error;
  }
}

/**
 * Example: Send a custom email with attachments
 */
export async function sendCustomEmailExample(logger: FastifyBaseLogger) {
  try {
    const result = await EmailService.sendEmail({
      to: ['user1@example.com', 'user2@example.com'],
      cc: ['manager@example.com'],
      subject: 'Monthly Deployment Report',
      template: 'notification',
      variables: {
        title: 'Monthly Report Available',
        message: 'Your monthly deployment report is ready. Please find the detailed report attached.',
        actionUrl: 'https://app.deploystack.io/reports',
        actionText: 'View Online Report'
      },
      attachments: [
        {
          filename: 'deployment-report.txt',
          content: 'Sample report content...\nDeployments: 15\nSuccess Rate: 98%',
          contentType: 'text/plain'
        }
      ]
    }, logger);

    if (result.success) {
      logger.info({
        messageId: result.messageId,
        recipients: result.recipients,
        attachmentCount: 1,
        operation: 'custom_email_example'
      }, '✅ Custom email with attachments sent successfully!');
    } else {
      logger.error({
        error: result.error,
        recipients: result.recipients,
        operation: 'custom_email_example'
      }, '❌ Failed to send custom email');
    }

    return result;
  } catch (error) {
    logger.error({
      error,
      operation: 'custom_email_example'
    }, '❌ Error sending custom email');
    throw error;
  }
}

/**
 * Example: Test SMTP configuration
 */
export async function testSmtpConfigurationExample(logger: FastifyBaseLogger) {
  try {
    logger.info({
      operation: 'test_smtp_config_example'
    }, '🔍 Testing SMTP configuration...');
    
    // Check if SMTP is configured
    const status = await EmailService.getSmtpStatus(logger);
    if (!status.configured) {
      logger.error({
        error: status.error,
        operation: 'test_smtp_config_example'
      }, '❌ SMTP is not configured');
      return false;
    }
    
    logger.info({
      operation: 'test_smtp_config_example'
    }, '✅ SMTP configuration found');
    
    // Test the connection
    const connectionTest = await EmailService.testConnection(logger);
    if (connectionTest.success) {
      logger.info({
        operation: 'test_smtp_config_example'
      }, '✅ SMTP connection test successful!');
      return true;
    } else {
      logger.error({
        error: connectionTest.error,
        operation: 'test_smtp_config_example'
      }, '❌ SMTP connection test failed');
      return false;
    }
  } catch (error) {
    logger.error({
      error,
      operation: 'test_smtp_config_example'
    }, '❌ Error testing SMTP configuration');
    return false;
  }
}

/**
 * Example: Get available templates and validate them
 */
export async function listAndValidateTemplatesExample(logger: FastifyBaseLogger) {
  try {
    logger.info({
      operation: 'list_validate_templates_example'
    }, '📋 Available email templates:');
    
    const templates = EmailService.getAvailableTemplates(logger);
    logger.info({
      templates,
      templateCount: templates.length,
      operation: 'list_validate_templates_example'
    }, 'Templates found');
    
    // Validate each template with sample data
    for (const template of templates) {
      logger.debug({
        template,
        operation: 'validate_template_example'
      }, `🔍 Validating template: ${template}`);
      
      let sampleVariables = {};
      
      // Provide sample variables based on template type
      switch (template) {
        case 'welcome':
          sampleVariables = {
            userName: 'Test User',
            userEmail: 'test@example.com',
            loginUrl: 'https://app.deploystack.io/login'
          };
          break;
        case 'password-reset':
          sampleVariables = {
            userName: 'Test User',
            resetUrl: 'https://app.deploystack.io/reset',
            expirationTime: '24 hours'
          };
          break;
        case 'notification':
          sampleVariables = {
            title: 'Test Notification',
            message: 'This is a test message'
          };
          break;
        default:
          sampleVariables = {};
      }
      
      const validation = await EmailService.validateTemplate(template, sampleVariables);
      
      if (validation.valid) {
        logger.info({
          template,
          operation: 'validate_template_example'
        }, `✅ Template ${template} is valid`);
      } else {
        logger.warn({
          template,
          errors: validation.errors,
          missingVariables: validation.missingVariables,
          operation: 'validate_template_example'
        }, `❌ Template ${template} validation failed`);
      }
    }
  } catch (error) {
    logger.error({
      error,
      operation: 'list_validate_templates_example'
    }, '❌ Error listing/validating templates');
  }
}

/**
 * Example: Integration with user registration
 */
export async function userRegistrationIntegrationExample(userData: {
  email: string;
  name: string;
  id: string;
}, logger: FastifyBaseLogger) {
  try {
    logger.info({
      userId: userData.id,
      userName: userData.name,
      userEmail: userData.email,
      operation: 'user_registration_example'
    }, `👤 Processing registration for user: ${userData.name}`);
    
    // Simulate user creation
    logger.info({
      userId: userData.id,
      operation: 'user_registration_example'
    }, '✅ User account created successfully');
    
    // Send welcome email
    const emailResult = await EmailService.sendWelcomeEmail({
      to: userData.email,
      userName: userData.name,
      userEmail: userData.email,
      loginUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`,
      supportEmail: 'support@deploystack.io'
    }, logger);
    
    if (emailResult.success) {
      logger.info({
        userId: userData.id,
        messageId: emailResult.messageId,
        operation: 'user_registration_example'
      }, '✅ Welcome email sent to new user');
    } else {
      logger.warn({
        userId: userData.id,
        error: emailResult.error,
        operation: 'user_registration_example'
      }, '⚠️ User created but welcome email failed');
      // Don't fail the registration process if email fails
    }
    
    return {
      user: userData,
      emailSent: emailResult.success
    };
  } catch (error) {
    logger.error({
      error,
      userId: userData.id,
      operation: 'user_registration_example'
    }, '❌ Error in user registration integration');
    throw error;
  }
}

/**
 * Run all examples (for testing purposes)
 */
export async function runAllExamples(logger: FastifyBaseLogger) {
  logger.info({
    operation: 'run_all_examples'
  }, '🚀 Running Email Service Examples...');
  
  try {
    // Test SMTP configuration first
    const smtpWorking = await testSmtpConfigurationExample(logger);
    
    if (!smtpWorking) {
      logger.warn({
        operation: 'run_all_examples'
      }, '⚠️ SMTP is not configured. Please configure SMTP settings in global settings to test email sending.');
      logger.info({
        operation: 'run_all_examples'
      }, 'You can still run template validation...');
      
      // Only run template validation if SMTP is not configured
      await listAndValidateTemplatesExample(logger);
      return;
    }
    
    logger.info({
      operation: 'run_all_examples'
    }, '📧 Testing email sending...');
    
    // Test template validation
    await listAndValidateTemplatesExample(logger);
    
    // Test different email types (uncomment to actually send emails)
    /*
    await sendWelcomeEmailExample(logger);
    await sendPasswordResetExample(logger);
    await sendNotificationExample(logger);
    await sendCustomEmailExample(logger);
    
    // Test integration example
    await userRegistrationIntegrationExample({
      email: 'testuser@example.com',
      name: 'Test User',
      id: 'test-123'
    }, logger);
    */
    
    logger.info({
      operation: 'run_all_examples'
    }, '✅ All examples completed successfully!');
    
  } catch (error) {
    logger.error({
      error,
      operation: 'run_all_examples'
    }, '❌ Error running examples');
  }
}

// Export for use in other files
export default {
  sendWelcomeEmailExample,
  sendPasswordResetExample,
  sendNotificationExample,
  sendCustomEmailExample,
  testSmtpConfigurationExample,
  listAndValidateTemplatesExample,
  userRegistrationIntegrationExample,
  runAllExamples
};
