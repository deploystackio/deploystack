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
      tooManyResults: 'Too many results ({total} found). Please refine your search term to see results.',
      maxResultsReached: 'Showing first {shown} of {total} results. Use more specific search terms to narrow results.',
      allCategories: 'All Categories',
      loadingCategories: 'Loading categories...',
      categoriesError: 'Failed to load categories',
      errorTitle: 'Error loading servers',
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
      features: 'Features',
      selected: 'You have selected {name} as your installation platform',
      recommendedChoice: 'This is the recommended choice for most users.',
      comingSoonNotice: 'Additional platform options will be available in future releases.',

      local: {
        name: 'Local Installation',
        description: 'Install and run the MCP server directly on your local machine',
        features: {
          direct: 'Direct access to local resources',
          fast: 'Fastest performance',
          secure: 'Complete control over data'
        }
      },

      docker: {
        name: 'Docker Container',
        description: 'Run the MCP server in an isolated Docker container',
        features: {
          isolated: 'Isolated environment',
          portable: 'Easy to deploy anywhere',
          scalable: 'Horizontally scalable'
        }
      },

      cloud: {
        name: 'Cloud Deployment',
        description: 'Deploy the MCP server to a cloud platform',
        features: {
          managed: 'Fully managed infrastructure',
          scalable: 'Auto-scaling capabilities',
          redundant: 'High availability'
        }
      }
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
      defaultConfig: 'Default Configuration',
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
      slug: 'Slug:'
    }
  },

  details: {
    installationDetails: {
      title: 'Installation Details',
      description: 'Information about your MCP server installation',
      fields: {
        installationName: 'Installation Name',
        server: 'Server',
        description: 'Description',
        installationType: 'Installation Type',
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
        local: 'local',
        cloud: 'cloud'
      }
    },
    
    environmentVariables: {
      title: 'Environment Variables',
      description: 'Configuration variables for this installation',
      noVariables: {
        title: 'No Environment Variables',
        description: 'This installation doesn\'t have any custom environment variables configured.'
      },
      info: 'These environment variables were configured during installation and are used by your MCP server.'
    },

    dangerZone: {
      title: 'Danger Zone',
      description: 'Irreversible and destructive actions for this installation',
      uninstall: {
        label: 'Uninstall MCP Server',
        description: 'Permanently remove this MCP server installation from your team. This action cannot be undone.',
        button: 'Uninstall Server',
        modal: {
          title: 'Uninstall MCP Server',
          description: 'Are you sure you want to uninstall "{name}"? This will permanently remove the installation and all its configuration from your team.',
          warning: 'This action cannot be undone. All configuration and environment variables will be lost.',
          confirm: 'Uninstall Server',
          cancel: 'Cancel',
          uninstalling: 'Uninstalling...'
        }
      }
    }
  }
}
