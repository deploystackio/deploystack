export default {
  consent: {
    title: 'Authorize Application',
    subtitle: 'Allow {clientName} to access your account?',
    signedInAs: 'Signed in as',
    permissionsTitle: 'Allowing will authorize {clientName} to:',
    buttons: {
      allow: 'Allow Access',
      deny: 'Deny Access',
      approving: 'Approving...',
      denying: 'Denying...'
    },
    security: {
      redirectNotice: 'This will redirect you back to the {clientName}.',
      revokeNotice: 'You can revoke this access at any time in your account settings.'
    },
    loading: {
      title: 'Loading consent details...',
      message: 'Please wait while we prepare the authorization request.'
    },
    errors: {
      title: 'Authorization Error',
      missingRequestId: 'Missing request ID parameter',
      requestNotFound: 'Authorization request not found or has expired',
      unauthorized: 'You must be logged in to authorize applications',
      invalidRequest: 'Invalid authorization request',
      networkError: 'Network error occurred. Please try again.',
      processingError: 'Failed to process authorization request',
      unknownError: 'An unknown error occurred',
      returnToDashboard: 'Return to Dashboard'
    },
    scopes: {
      'mcp:read': {
        name: 'MCP Server Access',
        description: 'Access your MCP server installations and configurations'
      },
      'account:read': {
        name: 'Account Information',
        description: 'Read your account information and settings'
      },
      'user:read': {
        name: 'User Profile',
        description: 'Read your user profile information'
      },
      'teams:read': {
        name: 'Team Access',
        description: 'Read your team memberships and team information'
      },
      'offline_access': {
        name: 'Offline Access',
        description: 'Maintain access when you\'re not actively using the application'
      }
    }
  }
}
