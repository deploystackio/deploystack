/**
 * Email Service Usage Examples
 * 
 * This file demonstrates how to use the email service in your application.
 * These examples can be integrated into your existing services.
 */

import { EmailService } from './emailService';

/**
 * Example: Send a welcome email to a new user
 */
export async function sendWelcomeEmailExample() {
  try {
    const result = await EmailService.sendWelcomeEmail({
      to: 'newuser@example.com',
      userName: 'John Doe',
      userEmail: 'newuser@example.com',
      loginUrl: 'https://app.deploystack.com/login',
      supportEmail: 'support@deploystack.com'
    });

    if (result.success) {
      console.log('✅ Welcome email sent successfully!');
      console.log('Message ID:', result.messageId);
      console.log('Recipients:', result.recipients);
    } else {
      console.error('❌ Failed to send welcome email:', result.error);
    }

    return result;
  } catch (error) {
    console.error('❌ Error sending welcome email:', error);
    throw error;
  }
}

/**
 * Example: Send a password reset email
 */
export async function sendPasswordResetExample() {
  try {
    const result = await EmailService.sendPasswordResetEmail({
      to: 'user@example.com',
      userName: 'Jane Smith',
      resetUrl: 'https://app.deploystack.com/reset-password?token=abc123xyz',
      expirationTime: '24 hours',
      supportEmail: 'support@deploystack.com'
    });

    if (result.success) {
      console.log('✅ Password reset email sent successfully!');
    } else {
      console.error('❌ Failed to send password reset email:', result.error);
    }

    return result;
  } catch (error) {
    console.error('❌ Error sending password reset email:', error);
    throw error;
  }
}

/**
 * Example: Send a notification email
 */
export async function sendNotificationExample() {
  try {
    const result = await EmailService.sendNotificationEmail({
      to: 'user@example.com',
      title: 'Deployment Complete',
      message: 'Your application "my-awesome-app" has been successfully deployed to production.',
      actionUrl: 'https://app.deploystack.com/deployments/123',
      actionText: 'View Deployment Details',
      userName: 'Developer'
    });

    if (result.success) {
      console.log('✅ Notification email sent successfully!');
    } else {
      console.error('❌ Failed to send notification email:', result.error);
    }

    return result;
  } catch (error) {
    console.error('❌ Error sending notification email:', error);
    throw error;
  }
}

/**
 * Example: Send a custom email with attachments
 */
export async function sendCustomEmailExample() {
  try {
    const result = await EmailService.sendEmail({
      to: ['user1@example.com', 'user2@example.com'],
      cc: ['manager@example.com'],
      subject: 'Monthly Deployment Report',
      template: 'notification',
      variables: {
        title: 'Monthly Report Available',
        message: 'Your monthly deployment report is ready. Please find the detailed report attached.',
        actionUrl: 'https://app.deploystack.com/reports',
        actionText: 'View Online Report'
      },
      attachments: [
        {
          filename: 'deployment-report.txt',
          content: 'Sample report content...\nDeployments: 15\nSuccess Rate: 98%',
          contentType: 'text/plain'
        }
      ]
    });

    if (result.success) {
      console.log('✅ Custom email with attachments sent successfully!');
    } else {
      console.error('❌ Failed to send custom email:', result.error);
    }

    return result;
  } catch (error) {
    console.error('❌ Error sending custom email:', error);
    throw error;
  }
}

/**
 * Example: Test SMTP configuration
 */
export async function testSmtpConfigurationExample() {
  try {
    console.log('🔍 Testing SMTP configuration...');
    
    // Check if SMTP is configured
    const status = await EmailService.getSmtpStatus();
    if (!status.configured) {
      console.error('❌ SMTP is not configured:', status.error);
      return false;
    }
    
    console.log('✅ SMTP configuration found');
    
    // Test the connection
    const connectionTest = await EmailService.testConnection();
    if (connectionTest.success) {
      console.log('✅ SMTP connection test successful!');
      return true;
    } else {
      console.error('❌ SMTP connection test failed:', connectionTest.error);
      return false;
    }
  } catch (error) {
    console.error('❌ Error testing SMTP configuration:', error);
    return false;
  }
}

/**
 * Example: Get available templates and validate them
 */
export async function listAndValidateTemplatesExample() {
  try {
    console.log('📋 Available email templates:');
    
    const templates = EmailService.getAvailableTemplates();
    console.log('Templates:', templates);
    
    // Validate each template with sample data
    for (const template of templates) {
      console.log(`\n🔍 Validating template: ${template}`);
      
      let sampleVariables = {};
      
      // Provide sample variables based on template type
      switch (template) {
        case 'welcome':
          sampleVariables = {
            userName: 'Test User',
            userEmail: 'test@example.com',
            loginUrl: 'https://app.deploystack.com/login'
          };
          break;
        case 'password-reset':
          sampleVariables = {
            userName: 'Test User',
            resetUrl: 'https://app.deploystack.com/reset',
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
        console.log(`✅ Template ${template} is valid`);
      } else {
        console.log(`❌ Template ${template} validation failed:`);
        console.log('Errors:', validation.errors);
        console.log('Missing variables:', validation.missingVariables);
      }
    }
  } catch (error) {
    console.error('❌ Error listing/validating templates:', error);
  }
}

/**
 * Example: Integration with user registration
 */
export async function userRegistrationIntegrationExample(userData: {
  email: string;
  name: string;
  id: string;
}) {
  try {
    console.log(`👤 Processing registration for user: ${userData.name}`);
    
    // Simulate user creation
    console.log('✅ User account created successfully');
    
    // Send welcome email
    const emailResult = await EmailService.sendWelcomeEmail({
      to: userData.email,
      userName: userData.name,
      userEmail: userData.email,
      loginUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`,
      supportEmail: 'support@deploystack.com'
    });
    
    if (emailResult.success) {
      console.log('✅ Welcome email sent to new user');
    } else {
      console.warn('⚠️ User created but welcome email failed:', emailResult.error);
      // Don't fail the registration process if email fails
    }
    
    return {
      user: userData,
      emailSent: emailResult.success
    };
  } catch (error) {
    console.error('❌ Error in user registration integration:', error);
    throw error;
  }
}

/**
 * Run all examples (for testing purposes)
 */
export async function runAllExamples() {
  console.log('🚀 Running Email Service Examples...\n');
  
  try {
    // Test SMTP configuration first
    const smtpWorking = await testSmtpConfigurationExample();
    
    if (!smtpWorking) {
      console.log('\n⚠️ SMTP is not configured. Please configure SMTP settings in global settings to test email sending.');
      console.log('You can still run template validation...\n');
      
      // Only run template validation if SMTP is not configured
      await listAndValidateTemplatesExample();
      return;
    }
    
    console.log('\n📧 Testing email sending...');
    
    // Test template validation
    await listAndValidateTemplatesExample();
    
    // Test different email types (uncomment to actually send emails)
    /*
    await sendWelcomeEmailExample();
    await sendPasswordResetExample();
    await sendNotificationExample();
    await sendCustomEmailExample();
    
    // Test integration example
    await userRegistrationIntegrationExample({
      email: 'testuser@example.com',
      name: 'Test User',
      id: 'test-123'
    });
    */
    
    console.log('\n✅ All examples completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Error running examples:', error);
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
