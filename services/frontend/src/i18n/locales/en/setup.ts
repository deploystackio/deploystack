// @/i18n/locales/en/setup.ts
// English translations specifically for the Setup page
export default {
  setup: {
    title: 'Setup DeployStack',
    description: 'Configure your DeployStack instance to get started.',
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
    },
    alreadyConfigured: {
      title: 'Already Configured',
      description: 'Your DeployStack instance appears to be already configured. If you need to change settings, please consult the documentation or environment variables.',
      button: 'Go to Dashboard',
    },
    success: {
      title: 'Setup Successful',
      description: 'Setup was successful. Go to Login and create your first user.',
      buttonAcknowledge: 'Go to Login',
    },
    buttons: {
      submit: 'Save Configuration',
      loading: 'Saving Configuration...',
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
