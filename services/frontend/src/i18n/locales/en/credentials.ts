export default {
  credentials: {
    title: 'Cloud Credentials',
    description: 'Manage your team\'s cloud provider credentials securely',
    addButton: 'Add Credential',
    search: {
      placeholder: 'Search credentials',
      button: 'Search',
      noResults: 'No credentials found',
      results: 'Found {count} credential{count, plural, one {} other {s}} for "{query}"'
    },
    table: {
      columns: {
        name: 'Name',
        provider: 'Provider',
        comment: 'Comment',
        createdAt: 'Created',
        actions: 'Actions'
      },
      loading: 'Loading credentials...',
      error: 'Failed to load credentials: {error}',
      noResults: 'No credentials found for this team'
    },
    form: {
      title: {
        add: 'Add Cloud Credential',
        edit: 'Edit Cloud Credential'
      },
      fields: {
        provider: {
          label: 'Cloud Provider',
          placeholder: 'Select a cloud provider',
          required: 'Please select a cloud provider'
        },
        name: {
          label: 'Credential Name',
          placeholder: 'Enter a name for this credential set',
          required: 'Credential name is required',
          maxLength: 'Name must be 100 characters or less'
        },
        comment: {
          label: 'Comment (Optional)',
          placeholder: 'Add a description or note about this credential',
          maxLength: 'Comment must be 500 characters or less'
        }
      },
      validation: {
        required: 'This field is required',
        minLength: '{field} must be at least {min} characters',
        maxLength: '{field} must be {max} characters or less',
        pattern: '{field} format is invalid'
      },
      buttons: {
        cancel: 'Cancel',
        save: 'Save Credential',
        saving: 'Saving...'
      },
      messages: {
        success: {
          create: 'Credential "{name}" created successfully',
          update: 'Credential "{name}" updated successfully'
        },
        error: {
          create: 'Failed to create credential',
          update: 'Failed to update credential',
          validation: 'Please fix the validation errors',
          duplicate: 'A credential with this name already exists for this provider'
        }
      }
    },
    actions: {
      edit: 'Edit',
      delete: 'Delete',
      view: 'View Details',
      editCredential: 'Edit Credential',
      editName: 'Edit Name',
      updateSecrets: 'Update Secrets'
    },
    delete: {
      title: 'Delete Credential',
      message: 'Are you sure you want to delete the credential "{name}"? This action cannot be undone.',
      confirm: 'Delete',
      cancel: 'Cancel',
      success: 'Credential "{name}" deleted successfully',
      error: 'Failed to delete credential'
    },
    providers: {
      aws: 'Amazon Web Services',
      render: 'Render.com',
      loading: 'Loading providers...',
      error: 'Failed to load cloud providers'
    },
    fields: {
      secret: 'Secret field (value hidden)',
      hasValue: 'Configured',
      noValue: 'Not configured',
      placeholder: '••••••••'
    },
    permissions: {
      noAccess: 'You don\'t have permission to view credentials for this team',
      readOnly: 'You have read-only access to credentials',
      adminRequired: 'Team admin permissions required to manage credentials'
    },
    empty: {
      title: 'No credentials yet',
      description: 'Get started by adding your first cloud provider credential'
    },
    detail: {
      title: 'Credential Details',
      backToCredentials: 'Back to Credentials',
      loading: 'Loading credential...',
      error: 'Failed to load credential: {error}',
      notFound: 'Credential not found',
      credentialInformation: 'Credential Information',
      providerInformation: 'Provider Information',
      fieldInformation: 'Field Information',
      auditInformation: 'Audit Information',
      fields: {
        name: 'Name',
        provider: 'Provider',
        comment: 'Comment',
        createdAt: 'Created',
        updatedAt: 'Last Updated',
        createdBy: 'Created By',
        credentialId: 'Credential ID',
        providerDescription: 'Provider Description',
        fieldType: 'Field Type',
        fieldRequired: 'Required',
        fieldSecret: 'Secret',
        hasValue: 'Has Value'
      },
      values: {
        noComment: 'No comment provided',
        notProvided: 'Not provided',
        yes: 'Yes',
        no: 'No',
        text: 'Text',
        password: 'Password',
        textarea: 'Text Area',
        configured: 'Configured',
        notConfigured: 'Not configured'
      },
      permissions: {
        teamUserNote: 'As a team user, you can view basic credential information but cannot see field details.',
        teamAdminNote: 'As a team admin, you can view all credential details including field information.'
      }
    }
  }
}
