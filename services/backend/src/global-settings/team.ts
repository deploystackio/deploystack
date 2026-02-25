import type { GlobalSettingsModule } from './types';

export const teamSettings: GlobalSettingsModule = {
  group: {
    id: 'team',
    name: 'Team Settings',
    description: 'Team management and limit configuration',
    icon: 'users',
    sort_order: 2
  },
  settings: [
    {
      key: 'team.default_member_limit',
      name: 'Default Team Member Limit',
      defaultValue: 3,
      type: 'number',
      description: 'Maximum number of members allowed in non-default teams. Applied when a new team is created. Default teams are always limited to 1 member (the owner).',
      encrypted: false,
      required: false
    },
    {
      key: 'team.allow_remote_mcp',
      name: 'Allow Remote MCP Servers',
      defaultValue: false,
      type: 'boolean',
      description: 'Allow teams to install MCP servers from remote sources not in the DeployStack catalog',
      encrypted: false,
      required: false
    },
    {
      key: 'team.creation_limit',
      name: 'Team Creation Limit',
      defaultValue: 3,
      type: 'number',
      description: 'Maximum number of teams a user can create, including both default and custom teams.',
      encrypted: false,
      required: false
    },
    {
      key: 'team.default_non_http_mcp_limit',
      name: 'Default Non-HTTP MCP Limit',
      defaultValue: 1,
      type: 'number',
      description: 'Maximum number of non-HTTP (stdio) MCP servers per team. Applied when a new team is created. HTTP and SSE servers are not affected.',
      encrypted: false,
      required: false
    },
    {
      key: 'team.default_mcp_server_limit',
      name: 'Default MCP Server Limit',
      defaultValue: 5,
      type: 'number',
      description: 'Maximum total number of MCP server installations per team. Applied when a new team is created. Includes all transport types (HTTP, SSE, stdio).',
      encrypted: false,
      required: false
    },
    {
      key: 'team.allow_github_mcp',
      name: 'Allow GitHub MCP Servers',
      defaultValue: true,
      type: 'boolean',
      description: 'Allow teams to install MCP servers directly from GitHub repositories',
      encrypted: false,
      required: false
    },
    {
      key: 'team.allow_private_github_repos',
      name: 'Allow Private GitHub Repositories',
      defaultValue: true,
      type: 'boolean',
      description: 'Allow teams to install MCP servers from private GitHub repositories',
      encrypted: false,
      required: false
    },
    {
      key: 'team.github_mcp_limit',
      name: 'GitHub MCP Server Limit',
      defaultValue: 1,
      type: 'number',
      description: 'Maximum number of MCP servers that can be installed from GitHub repositories per team',
      encrypted: false,
      required: false
    }
  ]
};
