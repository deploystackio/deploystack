export default {
  title: 'MCP Server Catalog',
  description: 'Manage global MCP servers available to all users',
  addButton: 'Add MCP Server',

  table: {
    loading: 'Loading MCP servers...',
    error: 'Error loading MCP servers: {error}',
    noData: 'No MCP servers available',
    noDescription: 'No description provided',
    openMenu: 'Open menu',
    search: {
      placeholder: 'Search servers by name, description, or tags...'
    },
    columns: {
      name: 'Name',
      description: 'Description',
      language: 'Language',
      runtime: 'Runtime',
      category: 'Category',
      status: 'Status',
      featured: 'Featured',
      created: 'Created',
      actions: 'Actions'
    },
    actions: {
      edit: 'Edit',
      delete: 'Delete',
      view: 'View Details',
      manage: 'Manage',
      feature: 'Feature',
      unfeature: 'Unfeature'
    }
  },

  deleteDialog: {
    title: 'Delete MCP Server',
    description: 'Are you sure you want to delete "{serverName}"? This action cannot be undone.',
    cancel: 'Cancel',
    confirm: 'Delete'
  },

  form: {
    title: 'Add MCP Server',
    subtitle: 'Create a new global MCP server for the catalog',

    steps: {
      github: 'GitHub Repository',
      basic: 'Basic Info',
      repository: 'Repository',
      technical: 'Technical',
      capabilities: 'Capabilities',
      review: 'Review'
    },

    github: {
      title: 'GitHub Repository',
      description: 'Connect a GitHub repository to automatically populate server information',
      url: {
        label: 'GitHub Repository URL',
        placeholder: 'https://github.com/username/repository',
        help: 'Enter the URL of the GitHub repository containing the MCP server'
      },
      branch: {
        label: 'Git Branch',
        placeholder: 'main',
        help: 'Specify the branch to analyze (default: main)'
      },
      preview: {
        title: 'Repository Information',
        description: 'Information automatically fetched from GitHub',
        basic: 'Basic Information',
        stats: 'Repository Stats',
        tags: 'Topics',
        installation: 'Installation Methods'
      },
      success: 'Repository information has been automatically populated in the form fields below.'
    },

    navigation: {
      next: 'Next',
      previous: 'Previous',
      submit: 'Create Server',
      update: 'Update Server',
      creating: 'Creating...',
      updating: 'Updating...',
      cancel: 'Cancel'
    },

    basic: {
      title: 'Basic Information',
      subtitle: 'Provide basic details about the MCP server',
      name: {
        label: 'Server Name',
        placeholder: 'Enter server name (e.g., "Playwright MCP")',
        description: 'A descriptive name for the MCP server'
      },
      description: {
        label: 'Short Description',
        placeholder: 'Brief description of what this server does',
        description: 'A concise summary of the server\'s functionality'
      },
      longDescription: {
        label: 'Detailed Description',
        placeholder: 'Detailed explanation of features and capabilities',
        description: 'Comprehensive description including usage examples'
      },
      category: {
        label: 'Category',
        placeholder: 'Select a category',
        description: 'Choose the most appropriate category for this server'
      },
      author: {
        label: 'Author Name',
        placeholder: 'Author or organization name',
        description: 'Name of the person or organization who created this server'
      },
      contact: {
        label: 'Author Contact',
        placeholder: 'Email or GitHub username',
        description: 'Contact information for the author'
      },
      organization: {
        label: 'Organization',
        placeholder: 'Company or organization name',
        description: 'Organization associated with this server (optional)'
      },
      license: {
        label: 'License',
        placeholder: 'e.g., MIT, Apache-2.0',
        description: 'Software license for this server'
      },
      tags: {
        label: 'Tags',
        placeholder: 'Add tags (press Enter to add)',
        description: 'Keywords to help users discover this server'
      }
    },

    repository: {
      title: 'Repository Information',
      subtitle: 'Configure source code repository details',
      githubUrl: {
        label: 'GitHub Repository URL',
        placeholder: 'https://github.com/username/repository',
        description: 'URL to the GitHub repository containing the MCP server code'
      },
      branch: {
        label: 'Git Branch',
        placeholder: 'main',
        description: 'Target branch for deployment (default: main)'
      },
      homepage: {
        label: 'Homepage URL',
        placeholder: 'https://example.com',
        description: 'Official website or documentation URL (optional)'
      }
    },

    technical: {
      title: 'Technical Specifications',
      subtitle: 'Define runtime and installation requirements',
      language: {
        label: 'Programming Language',
        placeholder: 'Select language',
        description: 'Primary programming language used'
      },
      runtime: {
        label: 'Runtime Environment',
        placeholder: 'Select runtime',
        description: 'Required runtime environment'
      },
      minVersion: {
        label: 'Minimum Runtime Version',
        placeholder: 'e.g., 18.0.0, 3.11',
        description: 'Minimum version of the runtime required'
      },
      installationMethods: {
        label: 'Installation Methods',
        description: 'How users can install and run this server',
        addMethod: 'Add Installation Method',
        type: {
          label: 'Type',
          placeholder: 'Select installation type'
        },
        command: {
          label: 'Command',
          placeholder: 'Installation or run command'
        }
      },
      dependencies: {
        label: 'Dependencies',
        placeholder: 'List any external dependencies',
        description: 'External libraries or services required'
      }
    },

    capabilities: {
      title: 'MCP Capabilities',
      subtitle: 'Define the tools, resources, and prompts provided',
      tools: {
        label: 'Tools',
        description: 'MCP tools provided by this server',
        addTool: 'Add Tool',
        name: {
          label: 'Tool Name',
          placeholder: 'tool_name'
        },
        toolDescription: {
          label: 'Description',
          placeholder: 'What this tool does'
        }
      },
      resources: {
        label: 'Resources',
        description: 'Data sources and resources available',
        addResource: 'Add Resource',
        type: {
          label: 'Resource Type',
          placeholder: 'e.g., file, database, api'
        },
        resourceDescription: {
          label: 'Description',
          placeholder: 'What this resource provides'
        }
      },
      prompts: {
        label: 'Prompts',
        description: 'Pre-configured prompts and templates',
        addPrompt: 'Add Prompt',
        name: {
          label: 'Prompt Name',
          placeholder: 'prompt_name'
        },
        promptDescription: {
          label: 'Description',
          placeholder: 'What this prompt does'
        }
      },
      environmentVariables: {
        label: 'Environment Variables',
        description: 'Required or optional environment variables',
        addVariable: 'Add Variable',
        name: {
          label: 'Variable Name',
          placeholder: 'VARIABLE_NAME'
        },
        variableDescription: {
          label: 'Description',
          placeholder: 'What this variable is used for'
        },
        required: {
          label: 'Required',
          description: 'Is this variable required?'
        }
      },
      defaultConfig: {
        label: 'Default Configuration',
        placeholder: 'Default configuration in JSON format',
        description: 'Default configuration settings for the server'
      }
    },

    review: {
      title: 'Review and Submit',
      subtitle: 'Review all information before creating the server',
      sections: {
        basic: 'Basic Information',
        repository: 'Repository',
        technical: 'Technical',
        capabilities: 'Capabilities'
      },
      submit: {
        title: 'Create MCP Server',
        description: 'This will create a new global MCP server in the catalog'
      }
    }
  },

  status: {
    active: 'Active',
    deprecated: 'Deprecated',
    maintenance: 'Maintenance'
  },

  languages: {
    typescript: 'TypeScript',
    javascript: 'JavaScript',
    python: 'Python',
    go: 'Go',
    rust: 'Rust',
    java: 'Java',
    csharp: 'C#',
    other: 'Other'
  },

  runtimes: {
    node: 'Node.js',
    python: 'Python',
    docker: 'Docker',
    go: 'Go',
    rust: 'Rust',
    java: 'Java',
    dotnet: '.NET',
    other: 'Other'
  },

  installationTypes: {
    npm: 'npm',
    pip: 'pip',
    docker: 'Docker',
    git: 'Git Clone',
    binary: 'Binary Download',
    other: 'Other'
  },

  messages: {
    createSuccess: 'MCP server created successfully',
    createError: 'Failed to create MCP server: {error}',
    updateSuccess: 'MCP server updated successfully',
    updateError: 'Failed to update MCP server: {error}',
    deleteSuccess: 'MCP server deleted successfully',
    deleteError: 'Failed to delete MCP server: {error}',
    deleteConfirm: 'Are you sure you want to delete "{name}"? This action cannot be undone.',
    featureSuccess: 'Server featured successfully',
    unfeatureSuccess: 'Server unfeatured successfully'
  },

  edit: {
    title: 'MCP Server Details - {name}',
    titleLoading: 'Loading MCP Server...',
    backToCatalog: 'Back to Catalog',
    deleteButton: 'Delete Server',
    loading: 'Loading server details...',
    errorLoading: 'Error loading server: {error}',
    serverInformation: 'Server Information',
    serverDetails: 'Detailed information about this MCP server',

    fields: {
      name: 'Server Name',
      description: 'Description',
      longDescription: 'Detailed Description',
      author: 'Author Information',
      technical: 'Technical Specifications',
      links: 'Repository Links',
      status: 'Status & Classification',
      tags: 'Tags',
      installation: 'Installation Methods',
      tools: 'Available Tools',
      resources: 'Available Resources',
      prompts: 'Available Prompts',
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
      minVersion: 'Min Version:',
      license: 'License:',
      repository: 'Repository',
      homepage: 'Homepage',
      noLinks: 'No links provided',
      status: 'Status:',
      visibility: 'Visibility:',
      created: 'Created:',
      updated: 'Updated:',
      lastSync: 'Last Sync:',
      serverId: 'Server ID:',
      slug: 'Slug:'
    },

    deleteDialog: {
      title: 'Delete MCP Server',
      warning: 'Are you sure you want to delete this MCP server?',
      serverName: 'Server name',
      consequences: 'This action will permanently remove:',
      consequencesList: {
        server: 'The server from the global catalog',
        configurations: 'All associated configurations',
        history: 'Installation and usage history'
      },
      cancel: 'Cancel',
      confirm: 'Delete Server',
      deleting: 'Deleting...'
    }
  },

  validation: {
    nameRequired: 'Server name is required',
    descriptionRequired: 'Description is required',
    languageRequired: 'Programming language is required',
    runtimeRequired: 'Runtime environment is required',
    githubUrlInvalid: 'Please enter a valid GitHub repository URL',
    homepageUrlInvalid: 'Please enter a valid URL',
    jsonInvalid: 'Please enter valid JSON'
  },

  pagination: {
    showing: 'Showing {start} to {end} of {total} servers',
    noItems: 'No servers to display',
    itemsPerPage: 'Items per page:',
    pageInfo: 'Page {current} of {total}',
    previous: 'Previous',
    next: 'Next'
  }
}
