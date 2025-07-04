// @/i18n/locales/en/setup.ts
// English translations specifically for the Setup page
export default {
  setup: {
    title: 'Setup DeployStack',
    description: 'Configure your DeployStack instance to get started.',
    databaseSelection: {
      title: 'Choose Your Database',
      subtitle: 'Select the database that best fits your needs',
    },
    databaseTypes: {
      sqlite: {
        name: 'SQLite',
        subtitle: 'Local Development',
        description: 'File-based database perfect for development and small deployments',
        features: {
          noSetup: 'No setup required',
          immediate: 'Works immediately',
          development: 'Perfect for getting started',
        },
      },
      turso: {
        name: 'Turso',
        subtitle: 'Distributed SQLite',
        description: 'Multi-region SQLite with global replication',
        features: {
          multiRegion: 'Multi-region replication',
          lowLatency: 'Low latency worldwide',
          advanced: 'Advanced SQLite features',
        },
      },
    },
    recommended: {
      development: 'Development',
      production: 'Production',
      advanced: 'Advanced',
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
        description: 'DeployStack uses SQLite for data storage.',
        options: {
          sqlite: 'SQLite',
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
      sqliteLabel: 'SQLite',
      sqlitePathLabel: 'SQLite Database Path',
      sqlitePathPlaceholder: 'e.g., persistent_data/database.db',
    },
    adminUser: {
      title: 'Administrator Account',
      nameLabel: 'Admin Name',
      emailLabel: 'Admin Email',
      passwordLabel: 'Admin Password',
    },
  },
}
