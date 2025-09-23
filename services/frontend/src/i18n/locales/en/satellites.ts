export default {
  title: 'Satellite Management',
  description: 'Manage and monitor all satellites in the system',

  // Status labels
  status: {
    active: 'Active',
    inactive: 'Inactive',
    maintenance: 'Maintenance',
    error: 'Error',
    used: 'Used',
    expired: 'Expired'
  },

  // Type labels
  type: {
    global: 'Global',
    team: 'Team'
  },

  // Table structure
  table: {
    loading: 'Loading satellites...',
    error: 'Error loading satellites: {error}',
    noData: 'No satellites found',

    columns: {
      name: 'Name',
      type: 'Type',
      status: 'Status',
      lastHeartbeat: 'Last Heartbeat',
      capabilities: 'Capabilities',
      actions: 'Actions'
    },

    search: {
      placeholder: 'Search satellites by name...'
    },

    actions: {
      updateStatus: 'Update Status'
    }
  },

  // Filters
  filters: {
    status: {
      placeholder: 'Filter by status',
      all: 'All Statuses'
    },
    type: {
      placeholder: 'Filter by type',
      all: 'All Types'
    }
  },

  // Actions
  actions: {
    refresh: 'Refresh',
    search: 'Search',
    setStatus: 'Set to {status}',
    pairing: 'Pairing',
    backToSatellites: 'Back to Satellites',
    createToken: 'Create Token',
    copyToken: 'Copy Token',
    downloadConfig: 'Download Config',
    revokeToken: 'Revoke Token'
  },

  // Messages
  messages: {
    fetchError: 'Failed to load satellites',
    statusUpdateSuccess: 'Satellite status updated successfully',
    statusUpdateError: 'Failed to update satellite status'
  },

  // Errors
  errors: {
    insufficientPermissions: 'You do not have permission to view satellites',
    permissionCheckFailed: 'Failed to check user permissions'
  },

  // Status update dialog
  statusUpdateDialog: {
    title: 'Update Satellite Status',
    description: 'Are you sure you want to change the status of "{satelliteName}" from {currentStatus} to {newStatus}?',
    cancel: 'Cancel',
    confirm: 'Update Status'
  },

  // Pagination
  pagination: {
    showing: 'Showing {start} to {end} of {total} satellites',
    page: 'Page {current} of {total}',
    previous: 'Previous',
    next: 'Next'
  },

  // Satellite Pairing
  pairing: {
    title: 'Pairing',
    description: 'Manage satellite registration tokens for secure pairing',
    
    // Loading and error states
    loading: 'Loading registration tokens...',
    error: 'Failed to load registration tokens: {error}',
    
    // Empty state
    emptyState: {
      title: 'No registration tokens',
      description: 'Create a token to start registering satellites securely'
    },
    
    // Token table
    tokenTable: {
      columns: {
        status: 'Status',
        type: 'Type',
        scope: 'Scope',
        createdBy: 'Created By',
        created: 'Created',
        expires: 'Expires'
      },
      
      scopes: {
        allTeams: 'All Teams',
        team: 'Team'
      },
      
      timeAgo: {
        days: '{count} day | {count} days ago',
        hours: '{count} hour | {count} hours ago',
        minutes: '{count} minute | {count} minutes ago'
      },
      
      timeRemaining: {
        expired: 'Expired',
        inDaysHours: 'in {days}d {hours}h',
        inHoursMinutes: 'in {hours}h {minutes}m',
        inMinutes: 'in {minutes}m'
      }
    },
    
    // Token creation modal
    createToken: {
      title: 'Create Registration Token',
      description: 'Generate a secure token for satellite registration. Tokens are single-use only.',
      
      // Steps
      steps: {
        config: 'Configuration',
        result: 'Token Created'
      },
      
      // Form fields
      form: {
        tokenScope: {
          label: 'Token Scope',
          global: {
            title: 'Global Satellite',
            description: 'Register satellites that serve all teams with resource isolation. Operated by DeployStack.'
          },
          team: {
            title: 'Team Satellite',
            description: 'Register satellites that serve a specific team exclusively. Contact support to enable.'
          }
        },
        
        teamSelect: {
          label: 'Target Team',
          placeholder: 'Select team'
        },
        
        expiration: {
          label: 'Token Expiration',
          unit: 'hours',
          recommended: 'Recommended: {hours} hours for {type} satellites. Maximum: {max} hours.'
        }
      },
      
      // Security notice
      securityNotice: {
        title: 'Security Notice:',
        description: 'Registration tokens are single-use and expire automatically. Keep tokens secure and only share them with authorized satellite operators.'
      },
      
      // No permissions
      noPermissions: {
        description: "You don't have permission to create registration tokens. Contact your administrator."
      },
      
      // Buttons
      buttons: {
        cancel: 'Cancel',
        create: 'Create Token',
        creating: 'Creating Token...',
        done: 'Done'
      }
    },
    
    // Token creation result
    tokenCreated: {
      title: 'Registration Token Created',
      description: 'Your registration token has been generated successfully. Copy the token or download the configuration file.',
      
      summary: {
        globalToken: 'Global Registration Token',
        teamToken: 'Team Registration Token',
        team: 'Team: {teamName}',
        expiresIn: 'Expires in: {time}',
        singleUse: 'Single use only - Token will be consumed upon satellite registration'
      },
      
      sections: {
        token: 'Registration Token',
        envConfig: 'Environment Configuration',
        nextSteps: 'Next Steps'
      },
      
      instructions: {
        step1: 'Copy the registration token or download the configuration file',
        step2: 'Set the environment variables in your satellite deployment',
        step3: 'Start your satellite - it will register automatically using the token',
        step4: 'The token will be consumed and become invalid after successful registration'
      }
    },
    
    // Token revocation
    revokeToken: {
      title: 'Revoke Registration Token',
      description: 'Are you sure you want to revoke this registration token? This action cannot be undone and the token will no longer be valid for satellite registration.',
      buttons: {
        cancel: 'Cancel',
        revoke: 'Revoke Token'
      }
    },
    
    // Toast messages
    toasts: {
      tokenCreated: {
        title: 'Registration token created',
        description: 'Token has been generated successfully'
      },
      tokenRevoked: {
        title: 'Token revoked',
        description: 'Registration token has been revoked'
      },
      tokenCopied: {
        title: 'Token copied to clipboard'
      },
      configDownloaded: {
        title: 'Configuration downloaded'
      },
      fetchError: {
        title: 'Failed to load tokens'
      },
      revokeError: {
        title: 'Failed to revoke token'
      },
      createError: {
        title: 'Token creation failed'
      }
    }
  }
}
