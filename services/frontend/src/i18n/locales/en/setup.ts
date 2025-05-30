export default {
  title: 'Database Setup',
  description: 'Configure your database to get started with DeployStack',
  alreadyConfigured: {
    title: 'Setup Complete',
    description: 'Database has already been configured and initialized.',
    button: 'Continue to Login',
  },
  form: {
    databaseType: {
      label: 'Database Type',
      placeholder: 'Select database type',
      description: 'Choose SQLite for quick setup or PostgreSQL for production use.',
      options: {
        sqlite: 'SQLite',
        postgres: 'PostgreSQL',
      },
    },
    connectionString: {
      label: 'Connection String',
      placeholder: 'postgresql://username:password@host:port/database',
      description: 'Enter your PostgreSQL connection string.',
    },
  },
  buttons: {
    submit: 'Setup Database',
    loading: 'Setting up...',
  },
  errors: {
    title: 'Setup Failed',
    connectionFailed: 'Failed to connect to backend. Please ensure the server is running.',
    failedToConnectWithAddress: 'Failed to connect to backend. Please ensure the server is running (remote address {address}).',
    setupFailed: 'Failed to setup database. Please try again.',
    validationRequired: 'Please select a database type',
    connectionStringRequired: 'Connection string is required for PostgreSQL',
  },
}
