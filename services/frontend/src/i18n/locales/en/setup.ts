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
        description: 'Choose the type of database you want to use for DeployStack.',
        options: {
          sqlite: 'SQLite',
          postgres: 'PostgreSQL',
        },
      },
      connectionString: {
        label: 'Connection String',
        placeholder: 'Enter database connection string',
        description: 'Provide the connection string for your database.',
      },
    },
    errors: {
      title: 'Setup Error',
      validationRequired: 'This field is required for setup.',
      connectionStringRequired: 'Database connection string is required.',
      failedToConnectWithAddress: 'Failed to connect to the database with the provided address.',
    },
    alreadyConfigured: {
      title: 'Already Configured',
      description: 'Your DeployStack instance appears to be already configured. If you need to change settings, please consult the documentation or environment variables.',
      button: 'Go to Dashboard',
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
      postgresLabel: 'PostgreSQL',
      sqlitePathLabel: 'SQLite Database Path',
      sqlitePathPlaceholder: 'e.g., persistent_data/database.db',
      postgresConnectionLabel: 'PostgreSQL Connection String',
      postgresConnectionPlaceholder: 'postgresql://user:password@host:port/database',
    },
    adminUser: {
      title: 'Administrator Account',
      nameLabel: 'Admin Name',
      emailLabel: 'Admin Email',
      passwordLabel: 'Admin Password',
    },
  },
}
