export default {
  globalSettings: {
    title: 'Global Settings',
    description: 'Manage global application settings',
    loading: 'Loading settings...',
    errors: {
      loadSettings: 'Error loading settings',
      saveSettings: 'Failed to save settings',
      configNotSet: 'VITE_DEPLOYSTACK_BACKEND_URL is not configured.',
      savingConfigNotSet: 'VITE_DEPLOYSTACK_BACKEND_URL is not configured for saving settings.',
      fetchFailed: 'Failed to fetch setting groups',
      saveFailed: 'Failed to save settings due to an API error.',
      unknownError: 'An unknown error occurred'
    },
    alerts: {
      successTitle: "Success!",
      saveSuccess: "Your settings have been saved successfully.",
      noChanges: "No changes detected. Settings are up to date."
    },
    form: {
      saveChanges: 'Save Changes',
      encryptedValue: 'This value is encrypted.',
      noSettings: 'No settings in this group.',
      groupNotFound: 'Group not found or settings unavailable.',
      selectCategory: 'Select a category from the sidebar to view its settings.',
      noGroups: 'No setting groups found.'
    }
  },
  githubApp: {
    fields: {
      appId: {
        label: 'GitHub App ID',
        placeholder: '123456',
        description: 'Find this in your GitHub App settings page.'
      },
      privateKey: {
        label: 'Private Key (Base64)',
        placeholder: 'LS0tLS1CRUdJTi...',
        description: 'Base64-encoded private key from your GitHub App. This value is encrypted when stored.'
      },
      installationId: {
        label: 'Installation ID',
        placeholder: '12345678',
        description: 'Found in the GitHub App installation URL.'
      },
      enabled: {
        label: 'Enable GitHub App Integration',
        description: 'Enable or disable GitHub App integration for MCP catalog functionality.'
      }
    },
    connectionTest: {
      title: 'Connection Test',
      description: 'Test your GitHub App configuration by fetching repository information.',
      button: {
        test: 'Test Connection',
        testing: 'Testing...'
      },
      status: {
        success: 'Connection Successful',
        failed: 'Connection Failed'
      },
      requirements: {
        title: 'Required for testing:',
        appId: 'App ID',
        privateKey: 'Private Key (Base64)',
        installationId: 'Installation ID'
      }
    },
    form: {
      unsavedChanges: 'Unsaved changes',
      saving: 'Saving...',
      saveChanges: 'Save Changes'
    }
  },
  smtp: {
    fields: {
      enabled: {
        label: 'Enable Email Functionality',
        description: 'Enable or disable all email sending functionality (password reset, email verification, notifications)'
      },
      host: {
        label: 'SMTP Host',
        placeholder: 'smtp.gmail.com',
        description: 'SMTP server hostname (e.g., smtp.gmail.com, smtp.outlook.com)'
      },
      port: {
        label: 'SMTP Port',
        placeholder: '587',
        description: 'SMTP server port (587 for TLS, 465 for SSL, 25 for unencrypted)'
      },
      username: {
        label: 'Username',
        placeholder: 'your-email-here',
        description: 'SMTP authentication username (usually your email address)'
      },
      password: {
        label: 'Password',
        placeholder: 'Enter your password or app password',
        description: 'SMTP authentication password. This value is encrypted when stored.'
      },
      secure: {
        label: 'Use SSL/TLS',
        description: 'Enable secure connection (SSL/TLS) for SMTP communication'
      },
      fromName: {
        label: 'From Name',
        placeholder: 'DeployStack',
        description: 'Default sender name for outgoing emails (optional)'
      },
      fromEmail: {
        label: 'From Email',
        placeholder: 'noreply-here',
        description: 'Default sender email address (optional, uses username if not set)'
      }
    },
    emailTest: {
      title: 'Send Test Email',
      description: 'Send a test email to verify your SMTP configuration is working correctly.',
      emailAddress: {
        label: 'Test Email Address',
        placeholder: 'test-here',
        description: 'Enter the email address where you want to send the test email',
        invalid: 'Please enter a valid email address'
      },
      button: {
        test: 'Send Test Email',
        testing: 'Sending...'
      },
      status: {
        success: 'Test Email Sent Successfully',
        failed: 'Test Email Failed'
      },
      requirements: {
        title: 'Required for testing:',
        enabled: 'Email functionality enabled',
        host: 'SMTP Host',
        port: 'SMTP Port',
        username: 'Username',
        password: 'Password',
        testEmail: 'Valid test email address'
      }
    },
    form: {
      unsavedChanges: 'Unsaved changes',
      saving: 'Saving...',
      saveChanges: 'Save Changes'
    }
  }
}
