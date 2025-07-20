export default {
  title: 'MCP Server Installations',
  description: 'Manage your team\'s MCP server installations',

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
    noData: 'No MCP servers installed yet'
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
      selectServer: 'Select a server...',
      searchPlaceholder: 'Search servers by name, description, or author...',
      noServersFound: 'No servers found matching your search',
      noServersAvailable: 'No MCP servers are currently available',
      requiredEnvVars: 'Required Environment Variables',
      details: 'Details',
      install: 'Install'
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
    removeError: 'Failed to remove installation'
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
    loading: 'Loading server details...',
    errorLoading: 'Error loading server: {error}',
    serverInformation: 'Server Information',
    serverDetails: 'Detailed information about this MCP server',

    fields: {
      name: 'Name',
      description: 'Description',
      longDescription: 'Long Description',
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
  }
}
