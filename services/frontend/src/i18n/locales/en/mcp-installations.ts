export default {
  title: 'MCP Server Installations',
  description: 'Manage your team\'s MCP server installations',

  teamContext: {
    noTeamSelected: 'Please select a team from the sidebar to view MCP server installations.',
    switchingTeams: 'Switching teams...'
  },

  emptyState: {
    title: 'No MCP servers installed',
    description: 'Get started by installing your first MCP server from our catalog'
  },

  featured: {
    title: 'Featured Catalog',
    description: 'Discover our curated selection of high-quality MCP servers',
    loading: 'Loading featured servers...',
    noServers: 'No featured servers available at the moment',
    categories: 'Categories',
    noCategories: 'No categories found',
    emptyState: {
      title: 'No Featured Servers',
      description: 'Featured MCP servers need to be configured by an administrator.',
    },
  },

  featuredList: {
    title: 'Featured MCP Servers',
    browseCatalog: 'Browse Catalog',
  },

  catalog: {
    title: 'Server Catalog',
    description: 'Browse all available MCP servers',
    servers: 'servers',
    noCategories: 'No categories found',
    emptyState: {
      title: 'No Servers in Category',
      description: 'This category does not have any MCP servers yet.',
    },
  },

  status: {
    active: 'Active',
    error: 'Error',
    installing: 'Installing',
    stopped: 'Stopped',
    deprecated: 'Deprecated',
    maintenance: 'Maintenance',
    ready: 'Ready',
    cloud: 'Cloud',
    unknown: 'Unknown'
  },

  table: {
    loading: 'Loading installations...',
    noData: 'No MCP servers installed yet',
    columns: {
      installationMethod: 'Installation Method',
      category: 'Category',
      runtime: 'Runtime',
      installed: 'Installed',
      repository: 'Repository'
    },
    values: {
      github: 'GitHub',
      noRepository: 'No repository',
      lastUsed: 'Last used',
      available: 'Available'
    }
  },

  actions: {
    install: 'Install MCP Server',
    installAnother: 'Install Another Server',
    view: 'View Details',
    configure: 'Configure',
    remove: 'Remove Installation',
    openMenu: 'Open menu'
  },

  buttons: {
    cancel: 'Cancel',
    installing: 'Installing...'
  },

  installation: {
    modal: {
      title: 'Install MCP Server',
      description: 'Install a new MCP server for your team'
    },
    form: {
      installationName: {
        label: 'Installation Name',
        placeholder: 'Enter a name for this installation'
      }
    }
  },

  wizard: {
    title: 'Install MCP Server',
    description: 'Follow the steps below to install a new MCP server for your team',
    installing: 'Installing...',
    install: 'Install Server',
    authorizing: 'Authorizing...',
    authorizeAndInstall: 'Authorize & Install',

    steps: {
      selectServer: 'Select Server',
      configureEnvironment: 'Configure Environment',
      selectPlatform: 'Select Platform'
    },

    server: {
      title: 'Select MCP Server',
      description: 'Choose an MCP server from our catalog to install',
      selectLabel: 'MCP Server',
      searchLabel: 'Search MCP Servers',
      categoryLabel: 'Category Filter',
      selectServer: 'Select a server...',
      searchPlaceholder: 'Search servers by name, description, or author...',
      searchButton: 'Search',
      searching: 'Searching...',
      noServersFound: 'No servers found matching your search',
      noServersAvailable: 'No MCP servers are currently available',
      emptyStateMessage: 'Enter a search term and click Search to find MCP servers...',
      contributionBanner: {
        missingServer: 'Missing an MCP server?',
        addToCatalog: 'Add it to our catalog by submitting it to our',
        awesomeRepo: 'awesome-mcp-server repository',
        contribute: 'Contribute Server'
      },
      tooManyResults: 'Too many results ({total} found). Please refine your search term to see results.',
      maxResultsReached: 'Showing first {shown} of {total} results. Use more specific search terms to narrow results.',
      allCategories: 'All Categories',
      loadingCategories: 'Loading categories...',
      categoriesError: 'Failed to load categories',
      errorTitle: 'Error loading servers',
      browseFeatured: 'Browse Featured',
      viewAllServers: 'View All Servers',
      requiredEnvVars: 'Required Environment Variables',
      details: 'Details',
      install: 'Install',
      name: 'Server Name',
      author: 'Author',
      category: 'Category',
      language: 'Language',
      unknownAuthor: 'Unknown Author',
      unknownLanguage: 'Not Specified'
    },

    environment: {
      title: 'Configure Environment Variables',
      description: 'Set up the required environment variables for your MCP server',
      configureFor: 'Configure environment variables for {name}',
      noVariables: 'No Configuration Required',
      noVariablesDescription: 'This MCP server doesn\'t require any environment variables',
      requiredVariables: 'Required Variables',
      optionalVariables: 'Optional Variables',
      requiredFieldsEmpty: 'Please fill in all required environment variables',
      missingRequiredFields: 'Missing required fields',
      helpText: 'Environment variables are used to configure your MCP server. Required variables must be filled in before you can proceed.'
    },

    platform: {
      title: 'Select Installation Platform',
      description: 'Choose where you want to install and run your MCP server',
      helpText: 'Select where you want to install and run your MCP server',
      features: 'Features',
      selected: 'You have selected {name} as your installation platform',
      recommendedChoice: 'This is the recommended choice for most users.',
      comingSoonNotice: 'Additional platform options will be available in future releases.',

      global: {
        name: 'Global Satellite',
        description: 'Run the MCP server on our managed global satellite infrastructure',
        features: {
          instant: 'Instant access with zero setup',
          managed: 'Fully managed and maintained'
        }
      },

      team: {
        name: 'Team Satellite',
        description: 'Deploy a private satellite behind your corporate network',
        features: {
          secure: 'Secure behind your firewall',
          private: 'Private team infrastructure'
        }
      }
    },

    satellite: {
      title: 'Select Satellite',
      description: 'Choose which satellite will run your MCP server',
      globalSatellites: 'Global Satellites',
      teamSatellites: 'Team Satellites',
      global: 'Global',
      team: 'Team',
      capabilities: 'Capabilities',
      lastHeartbeat: 'Last seen',
      neverSeen: 'Never',
      errorFetching: 'Failed to load satellites',
      noSatellites: 'No satellites available for your team'
    },

  success: {
    installed: 'Successfully installed {name}'
  }
  },

  notifications: {
    installSuccess: 'MCP server installed successfully',
    installError: 'Failed to install MCP server: {error}',
    removeSuccess: 'Installation removed successfully',
    removeError: 'Failed to remove installation',
    uninstallSuccess: 'MCP server uninstalled successfully'
  },

  reauth: {
    button: 'Re-authenticate',
    popup_title: 'Re-authenticating',
    opening: 'Opening authentication window',
    opening_description: 'Please authorize DeployStack to access your account',
    success: 'Re-authentication successful',
    success_description: '{name} has been re-authenticated and is reconnecting',
    error: 'Re-authentication failed',
    error_description: 'Failed to re-authenticate. Please try again.',
    popup_blocked: 'Popup was blocked',
    popup_blocked_description: 'Please allow popups for this site and try again.'
  },

  removal: {
    modal: {
      title: 'Remove MCP Server Installation',
      description: 'Are you sure you want to remove "{name}" from your team? This will permanently delete the installation and all its configuration.',
      warning: 'This action cannot be undone.',
      confirmButton: 'Remove Installation',
      cancelButton: 'Cancel',
      removing: 'Removing...'
    },
    notifications: {
      success: 'Installation removed from team successfully',
      permissionError: 'You don\'t have permission to remove installations in this team',
      notFoundError: 'Installation not found or doesn\'t belong to your team',
      genericError: 'Failed to remove installation: {error}'
    }
  },

  view: {
    title: 'MCP Server: {name}',
    titleLoading: 'Loading MCP Server...',
    backToServers: 'Back to MCP Servers',
    installServer: 'Install MCP Server',
    loading: 'Loading server details...',
    errorLoading: 'Error loading server: {error}',
    serverInformation: 'Server Information',
    serverDetails: 'Detailed information about this MCP server',

    fields: {
      name: 'Name',
      repository: 'Repository',
      description: 'Description',
      longDescription: 'Long Description',
      category: 'Category',
      author: 'Author Information',
      technical: 'Technical Specifications',
      links: 'Repository Links',
      status: 'Status & Classification',
      tags: 'Tags',
      installation: 'Installation Methods',
      tools: 'Available Tools',
      resources: 'Available Resources',
      prompts: 'Available Prompts',
      environmentVariables: 'Environment Variables',
      templateEnvironmentVariables: 'Template Environment Variables',
      teamEnvironmentVariables: 'Team Environment Variables', 
      userEnvironmentVariables: 'User Environment Variables',
      transportType: 'Transport Type',
      dependencies: 'Dependencies',
      systemInfo: 'System Information'
    },

    values: {
      featured: 'Featured',
      notProvided: 'Not provided',
      authorName: 'Name:',
      authorContact: 'Contact:',
      organization: 'Organization:',
      language: 'Language:',
      runtime: 'Runtime:',
      minVersion: 'Minimum Version:',
      license: 'License:',
      repository: 'Repository',
      homepage: 'Homepage',
      noLinks: 'No links available',
      status: 'Status:',
      visibility: 'Visibility:',
      created: 'Created:',
      updated: 'Updated:',
      lastSync: 'Last Sync:',
      serverId: 'Server ID:',
      slug: 'Slug:',
      locked: 'Locked',
      secret: 'Secret',
      type: 'Type',
      staticTemplateValue: 'Static template value',
      lockedByGlobalAdmin: 'Locked by global admin',
      teamConfigurable: 'Team configurable',
      lockedByTeamAdmin: 'Locked by team admin',
      userConfigurable: 'User configurable',
      hiddenFromUsers: 'Hidden from users'
    }
  },

  teamConfiguration: {
    title: 'Team Configuration',
    description: 'Configure shared team settings for arguments and environment variables that all team members will inherit.',
    loading: 'Loading server configuration...',

    sections: {
      teamArgs: {
        title: 'Team Arguments',
        description: 'Command line arguments shared across the team',
        counter: {
          single: 'argument',
          plural: 'arguments'
        }
      },
      teamEnv: {
        title: 'Team Environment Variables',
        description: 'Environment variables shared across the team',
        counter: {
          single: 'variable',
          plural: 'variables'
        }
      },
      userConfig: {
        title: 'User Configuration',
        description: 'Configuration that will be set by individual users after installation',
        counter: {
          single: 'configuration',
          plural: 'configurations'
        }
      },
      userArgs: {
        title: 'User Arguments',
        description: 'Command line arguments that individual users will configure'
      },
      userEnv: {
        title: 'User Environment Variables',
        description: 'These variables will be configured by individual users after installation. Each team member will set their own values for these variables.',
        infoNote: 'Information only:',
        individualConfig: 'These variables will be configured by individual users after installation.',
        perMemberConfig: 'Each team member will set their own values for these variables.',
        userConfigured: 'User configured'
      },
      teamQueryParams: {
        title: 'Team Query Parameters',
        description: 'URL query parameters shared across the team',
        counter: {
          single: 'query parameter',
          plural: 'query parameters'
        }
      }
    },

    table: {
      headers: {
        argument: 'Argument',
        variable: 'Variable',
        properties: 'Properties',
        details: 'Details',
        value: 'Value',
        actions: 'Actions'
      },
      values: {
        required: 'Required',
        type: 'Type',
        placeholder: 'Placeholder',
        notSet: 'Not set',
        hiddenFromUsers: 'Hidden from users',
        argumentNumber: 'Argument {number}'
      },
      labels: {
        required: 'Required:',
        type: 'Type:',
        description: 'Description:',
        value: 'Value:',
        hiddenFromUsers: 'Hidden from users:',
        defaultType: 'string'
      },
      actions: {
        openMenu: 'Open menu for {item}',
        editValue: 'Edit Value',
        editDisabled: 'Edit disabled',
        editDisabledTooltip: 'Only team administrators can edit team configuration'
      }
    },

    editModal: {
      titleArg: 'Edit Team Argument {number}',
      titleEnv: 'Edit Team Environment Variable: {name}',
      description: 'Configure the team-level value that all team members will inherit.',

      form: {
        labels: {
          argument: 'Argument:',
          variable: 'Variable:',
          teamValue: 'Team Value'
        },
        placeholders: {
          enterValue: 'Enter team value...'
        },
        buttons: {
          cancel: 'Cancel',
          save: 'Save',
          saving: 'Saving...'
        },
        actions: {
          showValue: 'Show value',
          hideValue: 'Hide value'
        }
      },

      validation: {
        required: 'This field is required'
      },

      errors: {
        noTeamFound: 'No team found',
        noTeamAvailable: 'No team available',
        updateFailed: 'Failed to update configuration. Please try again.'
      },

      success: {
        updated: 'Updated {item}',
        description: 'Team configuration has been updated successfully'
      }
    },

    emptyState: {
      title: 'No Team Configuration',
      description: 'This MCP server doesn\'t have any team-configurable arguments or environment variables.'
    },

    userEnvDetails: {
      required: '(Required)',
      optional: '(Optional)',
      typeLabel: 'Type:',
      placeholderLabel: 'Placeholder:'
    }
  },

  userConfiguration: {
    title: 'User Configuration',
    description: 'Configure your personal settings for this MCP server installation.',
    loading: 'Loading user configuration...',

    status: {
      configured: 'Configuration Active',
      description: 'Your personal configuration is set up and ready to use.'
    },

    noDevices: {
      title: 'No Devices Connected',
      description: 'You cannot configure environment variables because no device is connected yet. After using the DeployStack CLI gateway login command, a device will be automatically created.'
    },

    actions: {
      createConfiguration: 'Create Configuration'
    },

    sections: {
      userArgs: {
        title: 'User Arguments',
        description: 'Command line arguments for your personal configuration',
        userConfigured: 'Configured'
      },
      userEnv: {
        title: 'User Environment Variables',
        description: 'Personal environment variables for your MCP server configuration',
        userConfigured: 'Configured'
      },
      userHeaders: {
        title: 'User Headers',
        description: 'Personal HTTP headers for your MCP server configuration',
        userConfigured: 'Configured'
      },
      userQueryParams: {
        title: 'User Query Parameters',
        description: 'Personal URL query parameters for your MCP server configuration',
        userConfigured: 'Configured'
      }
    },

    deviceTable: {
      title: 'Device Configuration',
      deviceName: 'Device Name',
      value: 'Value', 
      actions: 'Actions',
      changeValue: 'Change Value'
    },

    table: {
      columns: {
        name: 'Name',
        type: 'Type',
        required: 'Required',
        value: 'Value',
        actions: 'Actions'
      },
      labels: {
        required: 'Required:',
        type: 'Type:',
        description: 'Description:',
        value: 'Value:',
        status: 'Status:',
        defaultType: 'string'
      },
      values: {
        configuredIndividually: 'Configured individually by users',
        argumentNumber: 'Argument {number}',
        required: 'Required',
        notSet: 'Not set'
      },
      actions: {
        edit: 'Edit',
        editValue: 'Edit Value'
      }
    },

    noConfig: {
      title: 'No Personal Configuration',
      description: 'Create your personal configuration to customize this MCP server for your needs.'
    },

    editModal: {
      title: 'Edit {item} for {device}',
      titleArg: 'Edit Argument {number}',
      titleEnv: 'Edit Environment Variable: {name}',
      description: 'Configure your personal value for this setting.',

      form: {
        labels: {
          argument: 'Argument:',
          variable: 'Variable:',
          header: 'Header:',
          queryParam: 'Query Parameter:',
          userValue: 'Your Value'
        },
        placeholders: {
          enterValue: 'Enter your value...'
        },
        buttons: {
          cancel: 'Cancel',
          save: 'Save Changes',
          saving: 'Saving...'
        },
        actions: {
          showValue: 'Show value',
          hideValue: 'Hide value'
        }
      },

      validation: {
        required: 'This field is required'
      },

      errors: {
        updateFailed: 'Failed to update configuration. Please try again.'
      },

      messages: {
        saveSuccess: 'Configuration saved',
        saveSuccessDescription: 'Updated {item} for {device}',
        saveError: 'Failed to save configuration',
        saveErrorDescription: 'Please try again or contact support'
      },

      success: {
        updated: 'Updated {item}',
        description: 'Your configuration has been updated successfully'
      }
    },

    createModal: {
      title: 'Create Personal Configuration',
      description: 'Set up your personal configuration for this MCP server.',

      form: {
        labels: {
          deviceName: 'Device Name',
          device: 'Select Device'
        },
        placeholders: {
          deviceName: 'e.g., MacBook Pro, Work Laptop, Desktop PC',
          selectDevice: 'Choose a device...',
          loadingDevices: 'Loading devices...'
        },
        buttons: {
          cancel: 'Cancel',
          create: 'Create Configuration',
          creating: 'Creating...'
        },
        help: {
          deviceName: 'Give this device a recognizable name to distinguish it from your other devices.',
          device: 'Select the device you want to create this configuration for.'
        }
      },

      validation: {
        deviceNameRequired: 'Device name is required',
        deviceRequired: 'Please select a device'
      },

      errors: {
        createFailed: 'Failed to create configuration. Please try again.'
      },

      success: {
        created: 'Personal configuration created successfully',
        description: 'You can now customize your MCP server settings.'
      }
    },

    emptyState: {
      title: 'No User Configuration',
      description: 'This MCP server doesn\'t have any user-configurable arguments or environment variables.'
    }
  },

  details: {
    config: {
      noConfig: {
        title: 'No Configuration Required',
        description: 'This MCP server does not require any configuration parameters.'
      }
    },

    tools: {
      title: 'Tools',
      description: 'Tools discovered from this MCP server installation',
      noTools: {
        title: 'No Tools Discovered',
        description: 'No tools have been discovered yet for this MCP server installation. Tools are discovered automatically when the satellite starts the MCP server.'
      },
      table: {
        search: 'Search tools...',
        columns: {
          enabled: 'Enabled',
          toolName: 'Tool Name',
          description: 'Description',
          status: 'Status',
          tokenCount: 'Token Count',
          distribution: '% of Total'
        },
        values: {
          noDescription: 'No description provided',
          enabled: 'Enabled',
          disabled: 'Disabled'
        }
      },
      detail: {
        description: 'Description',
        inputSchema: 'Input Schema'
      },
      bulkActions: {
        enable: 'Enable',
        disable: 'Disable'
      },
      toggle: {
        success: 'Tool "{toolName}" {action}',
        enabled: 'enabled',
        disabled: 'disabled',
        errorTitle: 'Failed to update tool',
        error: 'An error occurred while updating the tool status'
      },
      bulkToggle: {
        allSuccess: '{count} tool(s) {action} successfully',
        partialSuccess: '{succeeded} tool(s) {action} successfully, {failed} failed',
        errorTitle: 'Bulk Toggle Failed'
      },
      selection: {
        rowsSelected: '{selected} of {total} row(s) selected.'
      },
      summary: {
        totalTools: 'Total Tools',
        totalTokens: 'Total Tokens',
        discoveredAt: 'Discovered'
      },
      error: {
        title: 'Error Loading Tools',
        description: 'Failed to load MCP tools: {error}'
      }
    },

    installationDetails: {
      title: 'Installation Details',
      description: 'Information about your MCP server installation',
      fields: {
        installationName: 'Installation Name',
        server: 'Server',
        description: 'Description',
        installationType: 'Installation Type',
        installationStatus: 'Installation Status',
        technicalDetails: 'Technical Details',
        links: 'Links',
        author: 'Author',
        tags: 'Tags',
        installationInfo: 'Installation Info',
        language: 'Language:',
        runtime: 'Runtime:',
        status: 'Status:',
        repository: 'Repository',
        homepage: 'Homepage',
        installed: 'Installed:',
        updated: 'Updated:',
        lastUsed: 'Last Used:',
        installationId: 'Installation ID:'
      },
      values: {
        noDescription: 'No description provided',
        global: 'global',
        team: 'team'
      }
    },

    environmentVariables: {
      title: 'Environment Variables',
      description: 'Configuration variables for this installation',
      table: {
        name: 'Variable Name',
        properties: 'Properties',
        details: 'Details',
        value: 'Current Value',
        actions: 'Actions',
        required: 'Required',
        type: 'Type',
        placeholder: 'Placeholder',
        notSet: 'Not Set',
        openMenu: 'Open menu for',
        editValue: 'Edit Value',
        editDisabled: 'Edit disabled',
        editDisabledTooltip: 'Only team administrators can edit environment variables'
      },
      edit: {
        title: 'Edit {name}',
        description: 'Update the value for this environment variable',
        variableName: 'Variable Name',
        newValue: 'New Value',
        valuePlaceholder: 'Enter new value...',
        validation: 'Validation Rules',
        showValue: 'Show value',
        hideValue: 'Hide value',
        validationRules: {
          required: 'This field is required'
        }
      },
      noVariables: {
        title: 'No Environment Variables',
        description: 'This installation doesn\'t have any custom environment variables configured.'
      },
      info: 'These environment variables were configured during installation and are used by your MCP server.',
      updated: 'Environment variable updated successfully',
      updateSuccess: 'Environment variable "{name}" updated successfully'
    },

    dangerZone: {
      title: 'Danger Zone',
      description: 'Irreversible and destructive actions for this installation',
      uninstall: {
        label: 'Uninstall MCP Server',
        description: 'Permanently remove this MCP server installation from your team. This action cannot be undone.',
        warning: 'Uninstalling will permanently remove this MCP server from your team workspace. All team configurations and settings will be lost and cannot be recovered.',
        button: 'Uninstall Server',
        disabledTooltip: 'Only team administrators can uninstall MCP servers',
        modal: {
          title: 'Uninstall MCP Server',
          description: 'Are you sure you want to uninstall "{name}"? This will permanently remove the installation and all its configuration from your team.',
          warning: 'This action cannot be undone. All configuration and environment variables will be lost.',
          confirm: 'Uninstall Server',
          cancel: 'Cancel',
          uninstalling: 'Uninstalling...'
        }
      }
    },

    requests: {
      title: 'Tool Requests',
      description: 'View tool execution history for this MCP server',
      loading: 'Loading requests...',
      table: {
        columns: {
          time: 'Time',
          user: 'User',
          tool: 'Tool',
          duration: 'Duration',
          status: 'Status',
          actions: 'Actions'
        },
        values: {
          success: 'Success',
          failed: 'Failed',
          viewDetails: 'View Details'
        }
      },
      filter: {
        all: 'All Requests',
        success: 'Successful',
        failed: 'Failed'
      },
      connection: {
        live: 'Live',
        disconnected: 'Disconnected',
        reconnecting: 'Reconnecting...'
      },
      emptyState: {
        title: 'No Requests Yet',
        description: 'Tool execution requests will appear here when tools are called.'
      },
      detail: {
        title: 'Request Details',
        toolName: 'Tool Name',
        user: 'User',
        parameters: 'Parameters',
        response: 'Response',
        responseTime: 'Response Time',
        status: 'Status',
        error: 'Error Message',
        timestamp: 'Timestamp',
        close: 'Close',
        copyParams: 'Copy Parameters',
        copyResponse: 'Copy Response',
        copied: 'Copied!'
      },
      error: {
        title: 'Error Loading Requests',
        description: 'Failed to load tool requests: {error}'
      },
      viewMode: {
        switchedToLive: 'Switched to Live view',
        liveDescription: 'Real-time updates enabled',
        switchedToApi: 'Switched to API view',
        apiDescription: 'Using REST endpoint'
      }
    }
  }
}
