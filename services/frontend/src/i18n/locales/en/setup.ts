// @/i18n/locales/en/setup.ts
// English translations specifically for the Setup page
export default {
  setup: {
    title: 'Setup DeployStack',
    description: 'Configure your DeployStack instance to get started.',
    databaseSelection: {
      title: 'Database Configuration',
      subtitle: 'Configure PostgreSQL for your DeployStack instance',
    },
    databaseTypes: {
      postgresql: {
        name: 'PostgreSQL',
        subtitle: 'Production Database',
        description: 'Industry-standard relational database for production deployments',
        features: {
          scalable: 'Highly scalable',
          reliable: 'Enterprise-grade reliability',
          fullFeatured: 'Full SQL support',
        },
      },
    },
    recommended: {
      production: 'Production',
    },
    environmentVars: {
      required: 'Required environment variables',
    },
    environmentWarning: {
      title: 'Environment Variables Required',
      description: 'Make sure you have added the following environment variables before proceeding with setup:',
    },
    form: {
      databaseType: {
        label: 'Database Type',
        placeholder: 'Select database type',
        description: 'DeployStack uses PostgreSQL for data storage.',
        options: {
          postgresql: 'PostgreSQL',
        },
      },
    },
    errors: {
      title: 'Setup Error',
      validationRequired: 'This field is required for setup.',
      failedToConnectWithAddress: 'Failed to connect to the database with the provided address.',
      setupFailed: 'Database setup failed. Please try again.',
      connectionFailed: 'Failed to connect to the backend server.',
      checkLogs: 'Please check the backend logs for more details.',
    },
    alreadyConfigured: {
      title: 'Already Configured',
      description: 'Your DeployStack instance appears to be already configured. If you need to change settings, please consult the documentation or environment variables.',
      button: 'Go to Login',
    },
    success: {
      title: 'Setup Successful',
      description: 'Setup was successful. Go to Register and create your first user.',
      buttonAcknowledge: 'Go to Login',
    },
    buttons: {
      submit: 'Setup Database',
      loading: 'Setting up...',
      testConnection: 'Test Connection',
    },
    // Legacy structure for backward compatibility
    database: {
      title: 'Database Configuration',
      typeLabel: 'Database Type',
      postgresqlLabel: 'PostgreSQL',
    },
    adminUser: {
      title: 'Administrator Account',
      nameLabel: 'Admin Name',
      emailLabel: 'Admin Email',
      passwordLabel: 'Admin Password',
    },
  },
}
