import type { GlobalSettingsModule } from './types';

export const globalSettings: GlobalSettingsModule = {
  group: {
    id: 'global',
    name: 'Global Settings',
    description: 'General application configuration settings',
    icon: 'settings',
    sort_order: 0
  },
  settings: [
    {
      key: 'global.page_url',
      name: 'Frontend URL',
      defaultValue: 'http://localhost:5173',
      type: 'string',
      description: 'Base URL for the application frontend.',
      encrypted: false,
      required: true
    },
    {
      key: 'global.backend_url',
      name: 'Backend URL',
      defaultValue: 'http://localhost:3000',
      type: 'string',
      description: 'Base URL for the application backend API.',
      encrypted: false,
      required: true
    },
    {
      key: 'global.enable_login',
      name: 'Enable Login',
      defaultValue: true,
      type: 'boolean',
      description: 'Allow users to log in using any authentication method (email, GitHub, etc.).',
      encrypted: false,
      required: false
    },
    {
      key: 'global.enable_email_registration',
      name: 'Enable Email Registration',
      defaultValue: true,
      type: 'boolean',
      description: 'Allow new users to register using their email address.',
      encrypted: false,
      required: false
    },
    {
      key: 'global.enable_swagger_docs',
      name: 'Enable Swagger Docs',
      defaultValue: true,
      type: 'boolean',
      description: 'Expose the Swagger API documentation endpoint at /documentation.',
      encrypted: false,
      required: false
    },
    {
      key: 'global.show_version',
      name: 'Show Backend Version',
      defaultValue: true,
      type: 'boolean',
      description: 'Display backend version in the root API response. When disabled, version information is hidden from visitors.',
      encrypted: false,
      required: false
    },
    {
      key: 'global.team_member_limit',
      name: 'Team Member Limit',
      defaultValue: 3,
      type: 'number',
      description: 'Maximum number of members allowed in non-default teams. Default teams are always limited to 1 member (the owner).',
      encrypted: false,
      required: false
    },
    {
      key: 'global.team_creation_limit',
      name: 'Team Creation Limit',
      defaultValue: 3,
      type: 'number',
      description: 'Maximum number of teams a user can create, including both default and custom teams.',
      encrypted: false,
      required: false
    },
    {
      key: 'global.send_welcome_email',
      name: 'Send Welcome Email',
      defaultValue: false,
      type: 'boolean',
      description: 'Send a welcome email when users verify their email or log in via OAuth (GitHub, etc.).',
      encrypted: false,
      required: false
    },
    {
      key: 'global.show_user_walkthrough',
      name: 'Show User Walkthrough',
      defaultValue: false,
      type: 'boolean',
      description: 'Display onboarding walkthrough for users who have not completed or cancelled it.',
      encrypted: false,
      required: false
    },
    {
      key: 'global.default_non_http_mcp_limit',
      name: 'Default Non-HTTP MCP Limit',
      defaultValue: 1,
      type: 'number',
      description: 'Maximum number of non-HTTP (stdio) MCP servers per team. Applied when a new team is created. HTTP and SSE servers are not affected.',
      encrypted: false,
      required: false
    }
  ]
};
