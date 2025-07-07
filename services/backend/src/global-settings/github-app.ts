import type { GlobalSettingsModule } from './types';

export const githubAppSettings: GlobalSettingsModule = {
  group: {
    id: 'github-app',
    name: 'GitHub App Configuration',
    description: 'GitHub App authentication for MCP catalog integration',
    icon: 'github',
    sort_order: 4
  },
  settings: [
    {
      key: 'github.app.app_id',
      defaultValue: '',
      type: 'string',
      description: 'GitHub App ID for API authentication',
      encrypted: false,
      required: false
    },
    {
      key: 'github.app.private_key_base64',
      defaultValue: '',
      type: 'string',
      description: 'GitHub App private key (base64 encoded)',
      encrypted: true,
      required: false
    },
    {
      key: 'github.app.installation_id',
      defaultValue: '',
      type: 'string',
      description: 'GitHub App installation ID',
      encrypted: false,
      required: false
    },
    {
      key: 'github.app.enabled',
      defaultValue: false,
      type: 'boolean',
      description: 'Enable GitHub App integration for MCP catalog',
      encrypted: false,
      required: false
    }
  ]
};
