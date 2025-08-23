export default {
  title: 'MCP Server Catalog',
  description: 'Manage global MCP servers available to all users',
  addButton: 'Add MCP Server',

  table: {
    loading: 'Loading MCP servers...',
    error: 'Error loading MCP servers: {error}',
    noData: 'No MCP servers available',
    noDescription: 'No description provided',
    noCategory: 'No category assigned',
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
      actions: 'Actions',
      properties: 'Properties',
      details: 'Details'
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
      claudeConfig: 'Claude Desktop Config',
      configurationSchema: 'Configuration Schema',
      basic: 'Basic Info',
      configuring: 'Step in progress',
      repository: 'Repository',
      technical: 'Technical',
      capabilities: 'Capabilities',
      review: 'Review'
    },

    errors: {
      githubFetch: 'Failed to fetch repository information'
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

    claudeConfig: {
      title: 'Claude Desktop Configuration',
      description: 'Paste your Claude Desktop configuration JSON. This should contain exactly one MCP server configuration.',
      label: 'Claude Desktop Configuration',
      placeholder: 'Paste your Claude Desktop configuration JSON here...',
      formatButton: 'Format JSON',
      validConfiguration: 'Valid Configuration',
      invalidConfiguration: 'Invalid Configuration',
      preview: {
        title: 'Configuration Preview',
        serverName: 'Server Name',
        command: 'Command',
        environmentVariables: 'Environment Variables'
      },
      examples: {
        title: 'Example Configurations',
        brightData: {
          title: 'Bright Data MCP Server',
          description: 'Web scraping and data collection'
        },
        filesystem: {
          title: 'Filesystem Server',
          description: 'File system access and management'
        },
        postgres: {
          title: 'PostgreSQL Server',
          description: 'Database connectivity and queries'
        },
        copyExample: 'Copy example'
      },
      validation: {
        required: 'Configuration is required',
        invalidJson: 'Invalid JSON format',
        missingMcpServers: 'Configuration must contain "mcpServers" object',
        noServers: 'At least one MCP server must be defined in "mcpServers"',
        multipleServers: 'Only one MCP server is allowed per configuration',
        missingCommand: 'Server must have a "command" field',
        missingArgs: 'Server must have an "args" array',
        invalidEnv: 'Server "env" must be an object if provided'
      }
    },

    configurationSchema: {
      title: 'Configuration Schema',
      description: 'Categorize arguments and environment variables into Template, Team, or User configurations.',
      arguments: {
        title: 'Arguments Configuration',
        description: 'Configure command-line arguments for this MCP server',
        addButton: 'Add Argument',
        emptyState: {
          title: 'No arguments configured',
          description: 'Command-line arguments control how your MCP server is launched.'
        }
      },
      environment: {
        title: 'Environment Variables Configuration',
        description: 'Configure environment variables for this MCP server',
        addButton: 'Add Environment Variable',
        emptyState: {
          title: 'No environment variables configured',
          description: 'Environment variables provide configuration and credentials to your MCP server.'
        }
      },
      table: {
        columns: {
          name: 'Name',
          properties: 'Properties',
          details: 'Details',
          actions: 'Actions'
        },
        properties: {
          type: 'Type:',
          required: 'Required:',
          locked: 'Locked',
          visibleToUsers: 'Visible to Users:',
          yes: 'Yes'
        },
        actions: {
          openMenu: 'Open menu',
          edit: 'Edit',
          delete: 'Delete'
        }
      },
      categories: {
        template: 'Template (Static)',
        team: 'Team Configurable',
        user: 'User Configurable'
      },
      dataTypes: {
        string: 'String',
        number: 'Number',
        boolean: 'Boolean'
      },
      modal: {
        add: {
          argument: 'Add Argument',
          environment: 'Add Environment Variable'
        },
        edit: {
          argument: 'Edit Argument',
          environment: 'Edit Environment Variable'
        },
        description: 'Configure how this {type} should be managed across your organization.',
        types: {
          argument: 'argument',
          environment: 'environment variable'
        },
        fields: {
          name: {
            label: 'Name',
            placeholders: {
              argument: 'arg_name',
              environment: 'ENV_VAR_NAME'
            }
          },
          value: {
            label: 'Value',
            placeholder: 'Example: --verbose or package-name'
          },
          category: {
            label: 'Category',
            placeholder: 'Select category...'
          },
          dataType: {
            label: 'Data Type',
            placeholder: 'Select type...'
          },
          description: {
            label: 'Description',
            placeholder: 'Describe what this configuration does...'
          },
          options: {
            required: 'Required',
            locked: 'Locked',
            defaultTeamLocked: 'Default Team Locked',
            visibleToUsers: 'Visible to Users'
          }
        },
        actions: {
          cancel: 'Cancel',
          add: 'Add',
          update: 'Update'
        },
        validation: {
          nameRequired: 'Name is required',
          nameExists: 'Name already exists for this type',
          valueRequired: 'Value is required for template arguments'
        }
      }
    },

    navigation: {
      next: 'Next',
      previous: 'Previous',
      submit: 'Create Server',
      update: 'Update Server',
      creating: 'Creating...',
      updating: 'Updating...',
      cancel: 'Cancel',
      fetching: 'Fetching...'
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
      },
      featured: {
        label: 'Featured Server',
        description: 'Featured servers are highlighted in the catalog and appear at the top of search results. This helps users discover high-quality or recommended MCP servers.'
      },
      autoInstall: {
        label: 'Auto Install for New Default Teams',
        description: 'When enabled, this server will be automatically installed in the default team for all new users who register for DeployStack. This helps provide new users with immediate access to useful MCP servers.'
      },
      transportType: {
        label: 'Transport Type',
        placeholder: 'Select transport type',
        description: 'Choose how this MCP server communicates. Select "Extract from Claude Desktop Configuration" to automatically detect the transport type from your configuration, or manually select a transport type.',
        editDescription: 'Select the transport type for this MCP server. The transport type determines how the server communicates with clients.',
        options: {
          auto: 'Extract from Claude Desktop Configuration',
          stdio: 'stdio (Standard Input/Output)',
          http: 'http (HTTP Transport)',
          sse: 'sse (Server-Sent Events)'
        }
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
      subtitle: 'Edit the Claude Desktop configuration for this MCP server.',
      description: 'Define runtime and installation requirements',
      language: {
        label: 'Programming Language',
        placeholder: 'Select programming language',
        description: 'Primary programming language used for this MCP server',
        options: {
          typescript: 'TypeScript',
          javascript: 'JavaScript',
          python: 'Python',
          go: 'Go',
          csharp: 'C#',
          cpp: 'C++'
        }
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
      },
      transportType: {
        label: 'Transport Type',
        placeholder: 'Select transport type',
        description: 'Choose how this MCP server communicates with clients',
        editDescription: 'Select the transport type for this MCP server. The transport type determines how the server communicates with clients.',
        options: {
          auto: 'Auto (Extract from Configuration)',
          stdio: 'stdio (Standard Input/Output)',
          http: 'http (HTTP Transport)',
          sse: 'sse (Server-Sent Events)'
        }
      },
      claudeConfig: {
        label: 'Claude Desktop Configuration',
        placeholder: 'Paste Claude Desktop configuration JSON here...',
        formatButton: 'Format JSON',
        validConfiguration: 'Valid Configuration',
        invalidConfiguration: 'Invalid Configuration',
        helpText: 'Provide the Claude Desktop configuration for this MCP server in JSON format',
        showExampleButton: 'Show example Config',
        preview: {
          title: 'Configuration Preview',
          serverName: 'Server Name',
          command: 'Command',
          environmentVariables: 'Environment Variables',
          arguments: 'Arguments',
          description: 'Preview of the extracted configuration values'
        },
        examples: {
          title: 'Example Configuration',
          description: 'Click the button to copy this example to your clipboard'
        },
        autoDescription: 'Environment variable extracted from Claude Desktop configuration',
        validation: {
          required: 'Configuration is required',
          invalidJson: 'Invalid JSON format',
          missingMcpServers: 'Configuration must have "mcpServers" property',
          noServers: 'At least one server must be defined',
          multipleServers: 'Only one server can be defined for editing',
          missingCommand: 'Server must have a "command" property',
          missingArgs: 'Server must have an "args" array',
          invalidEnv: 'Server "env" must be an object'
        }
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
        editVariable: 'Edit Variable',
        noVariables: 'No environment variables defined',
        noVariablesDescription: 'Click "Add Variable" to get started.',
        requiredBadge: 'Required',
        addDescription: 'Add a new environment variable that this MCP server requires.',
        editDescription: 'Edit the environment variable details.',
        name: {
          label: 'Variable Name',
          placeholder: 'VARIABLE_NAME'
        },
        variableDescription: {
          label: 'Description',
          placeholder: 'What this variable is used for'
        },
        type: {
          label: 'Type',
          placeholder: 'Select variable type',
          options: {
            text: 'Text',
            password: 'Password',
            number: 'Number',
            url: 'URL',
            email: 'Email'
          }
        },
        placeholder: {
          label: 'Placeholder',
          placeholder: 'Example value or hint for users'
        },
        required: {
          label: 'Required',
          description: 'Is this variable required?'
        },
        validation: {
          label: 'Validation Pattern (Optional)',
          placeholder: 'Regular expression for validation',
          description: 'Optional regex pattern to validate the environment variable value.',
          nameRequired: 'Name is required',
          nameFormat: 'Name must be uppercase letters, numbers, and underscores only',
          nameDuplicate: 'Environment variable with this name already exists'
        },
        submitAdd: 'Add Variable',
        submitEdit: 'Save Changes'
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
      descriptions: {
        basic: 'Review the basic server information and metadata',
        repository: 'Repository and source code information',
        technical: 'Technical specifications and installation requirements',
        capabilities: 'MCP capabilities and configuration options'
      },
      fields: {
        serverName: 'Server Name',
        description: 'Description',
        detailedDescription: 'Detailed Description',
        category: 'Category',
        featuredServer: 'Featured Server',
        autoInstall: 'Auto Install for New Default Teams',
        author: 'Author',
        contact: 'Contact',
        organization: 'Organization',
        license: 'License',
        tags: 'Tags',
        githubRepository: 'GitHub Repository',
        gitBranch: 'Git Branch',
        homepage: 'Homepage',
        language: 'Language',
        runtime: 'Runtime',
        minimumVersion: 'Minimum Version',
        claudeDesktopConfiguration: 'Claude Desktop Configuration',
        dependencies: 'Dependencies',
        transportType: 'Transport Type',
        tools: 'Tools',
        resources: 'Resources',
        prompts: 'Prompts',
        environmentVariables: 'Environment Variables'
      },
      values: {
        notSpecified: 'Not specified',
        required: 'Required',
        optional: 'Optional'
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
    title: 'Edit MCP Server - {name}',
    titleLoading: 'Loading MCP Server...',
    backToCatalog: 'Back to View',
    deleteButton: 'Delete Server',
    loading: 'Loading server details...',
    errorLoading: 'Error loading server: {error}',
    serverInformation: 'Server Information',
    serverDetails: 'Detailed information about this MCP server',

    actions: {
      manageServer: 'Manage Server',
      editServer: 'Edit MCP Server',
      deleteServer: 'Delete MCP Server'
    },

    fields: {
      name: 'Server Name',
      description: 'Description',
      longDescription: 'Detailed Description',
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
      transportType: 'Transport Type',
      defaultConfig: 'Default Configuration',
      dependencies: 'Dependencies',
      systemInfo: 'System Information',
      capabilities: 'Capabilities'
    },

    values: {
      featured: 'Featured',
      notProvided: 'Not provided',
      yes: 'Yes',
      no: 'No',
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
      slug: 'Slug:',
      transportType: {
        notSpecified: 'Not specified',
        stdio: 'stdio',
        http: 'http',
        sse: 'sse',
        stdioDescription: '(Standard Input/Output)',
        httpDescription: '(HTTP Transport)',
        sseDescription: '(Server-Sent Events)'
      }
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
    },
    errorActions: {
      tryAgain: 'Try Again',
      backToCatalog: 'Back to Catalog',
      loading: 'Loading...'
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
