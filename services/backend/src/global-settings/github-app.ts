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
      name: 'App ID',
      defaultValue: '',
      type: 'string',
      description: 'GitHub App ID used for API authentication.',
      encrypted: false,
      required: false
    },
    {
      key: 'github.app.private_key_base64',
      name: 'Private Key (Base64)',
      defaultValue: '',
      type: 'string',
      description: 'GitHub App private key encoded in base64 format.',
      encrypted: true,
      required: false
    },
    {
      key: 'github.app.installation_id',
      name: 'Installation ID',
      defaultValue: '',
      type: 'string',
      description: 'GitHub App installation ID for your organization or account.',
      encrypted: false,
      required: false
    },
    {
      key: 'github.app.enabled',
      name: 'Enable GitHub App',
      defaultValue: false,
      type: 'boolean',
      description: 'Use GitHub App authentication for MCP catalog integration.',
      encrypted: false,
      required: false
    }
  ]
};
