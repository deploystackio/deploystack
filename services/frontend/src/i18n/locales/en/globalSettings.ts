export default {
  globalSettings: {
    title: 'Global Settings',
    description: 'Manage global application settings',
    alerts: {
      successTitle: "Success!",
      saveSuccess: "Your settings have been saved successfully.",
      noChanges: "No changes detected. Settings are up to date."
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
  }
}
