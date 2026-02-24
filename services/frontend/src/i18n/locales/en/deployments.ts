export default {
  deployments: {
    title: 'Deployments',
    listTitle: 'Deployed MCP Servers',
    listDescription: 'Manage MCP servers deployed from GitHub repositories',

    actions: {
      deployNew: 'Deploy New Server',
      viewDetails: 'View Details',
      configure: 'Configure',
    },

    emptyState: {
      title: 'No Deployed Servers',
      description: 'Deploy MCP servers directly from your GitHub repositories',
      action: 'Deploy Your First Server',
    },

    wizard: {
      title: 'Deploy MCP Server from GitHub',
      description: 'Connect your GitHub account, select a repository, and deploy an MCP server to your team',

      steps: {
        connectGitHub: 'Connect GitHub',
        selectRepository: 'Select Repository',
        selectSatellite: 'Select Satellite',
        configureEnvironment: 'Configure & Deploy',
        validate: 'Validate',
        streaming: 'Deploy',
        success: 'Complete',
        deployProgress: 'Deploy',
      },

      stepDescriptions: {
        connectGitHub: 'Authenticate with GitHub',
        selectRepository: 'Choose repository and branch',
        selectSatellite: 'Choose where to deploy',
        configureEnvironment: 'Set environment variables',
        validate: 'Validating repository',
        streaming: 'Streaming deployment logs',
        success: 'Deployment successful',
      },

      connectGitHub: {
        title: 'Connect GitHub',
        description: 'Connect your GitHub account to deploy MCP servers from your repositories',
        button: 'Connect with GitHub',
        connecting: 'Connecting...',
        connected: 'GitHub connected successfully!',
        checking: 'Checking GitHub connection...',
        notice: 'We\'ll redirect you to GitHub to authorize access to your repositories',
      },

      selectRepository: {
        title: 'Select Repository',
        repositoryLabel: 'Repository',
        repositoryPlaceholder: 'Select a repository...',
        searchPlaceholder: 'Search repositories...',
        loading: 'Loading repositories...',
        error: 'Failed to load repositories',
        tryAgain: 'Try again',
        branchLabel: 'Branch',
        branchPlaceholder: 'main',
        defaultBranch: 'Default branch',
        private: 'Private',
      },

      configureEnvironment: {
        title: 'Configure Environment',
        repositoryLabel: 'Repository',
        branchLabel: 'Branch',

        envVars: {
          title: 'Environment Variables',
          description: 'These variables will be available to all team members using this MCP server',
          keyPlaceholder: 'key',
          valuePlaceholder: 'value',
          type: 'Type',
          add: '+ Add Variable',
          remove: 'Remove',
        },

        templateArgs: {
          title: 'Arguments',
          description: 'Additional arguments to pass to the MCP server (e.g., --verbose, --debug)',
          placeholder: '--verbose',
          type: 'Type',
          add: '+ Add Argument',
          remove: 'Remove',
        },

        commandPreview: {
          title: 'Command Preview',
          comment: '# Satellite will run:',
          withArgs: '# With args:',
        },
      },

      validating: {
        title: 'Validating GitHub Repository',
        description: 'This will take 2-5 seconds',
        steps: {
          connectingGithub: 'Connecting to GitHub API...',
          readingPackageJson: 'Reading package.json...',
          validatingMcpSdk: 'Validating MCP SDK dependency...',
          creatingInstallation: 'Creating installation...',
        },
        error: {
          title: 'Validation Failed',
          stepLabel: 'Error at step',
          tryAgain: 'Try Again',
        },
        success: {
          title: 'Repository Validated Successfully',
          description: 'Review the details below before proceeding to configure your deployment',
          overallStatus: 'Overall Status',
          statusSuccess: 'Success',
          statusFailed: 'Failed',
          packageName: 'Package Name',
          version: 'Version',
          runtime: 'Runtime',
          mcpSdk: 'MCP SDK',
          buildScript: 'Build Script',
          startScript: 'Start Script',
          repositoryDetails: 'Repository Details',
          buildCommands: 'Build Commands',
          name: 'Name',
          noBuildScripts: 'No build or start scripts detected',
        },
      },

      streaming: {
        title: 'Deployment in Progress',
        status: 'Status',
        waitingForLogs: 'Waiting for logs...',
      },

      deployProgress: {
        status: 'Deployment Status',
        repository: 'Repository',
        branch: 'Branch',
        commitSha: 'Commit SHA',
        editServer: 'MCP Server',
        deploying: 'Deploying...',
        online: 'Online',
        logs: 'Deployment Logs',
        viewInstallation: 'View Installation',
      },

      deployment: {
        error: {
          title: 'Deployment Failed',
          tryAgain: 'Try Again',
        },
      },

      success: {
        title: 'Deployment Successful!',
        detailsTitle: 'Deployment Details',
        repository: 'Repository',
        branch: 'Branch',
        commitSha: 'Commit SHA',
        status: 'Status',
        online: 'Online',
        description: 'The MCP server is now available to all team members.',
        viewInstallation: 'View Installation',
        deployAnother: 'Deploy Another',
      },

      buttons: {
        back: 'Back',
        next: 'Next',
        deploy: 'Deploy Server',
        deploying: 'Deploying...',
        cancel: 'Cancel',
        continue: 'Continue',
        checkRepository: 'Check Repository',
        checkingRepository: 'Checking...',
      },
    },

    card: {
      repository: 'Repository',
      branch: 'Branch',
      commit: 'Commit',
      deployedAt: 'Deployed',
      status: {
        online: 'online',
        offline: 'offline',
        provisioning: 'provisioning',
      },
    },

    notifications: {
      deploySuccess: 'Deployment started successfully',
      deployError: 'Failed to deploy server',
      connectionError: 'Failed to check GitHub connection',
      repositoriesError: 'Failed to load repositories',
    },
  },
}
