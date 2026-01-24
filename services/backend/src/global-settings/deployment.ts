import type { GlobalSettingsModule } from './types';

export const deploymentSettings: GlobalSettingsModule = {
  group: {
    id: 'deployment',
    name: 'Deployment Settings',
    description: 'GitHub App configuration for deploying MCP servers from repositories',
    icon: 'rocket',
    sort_order: 5
  },
  settings: [
    {
      key: 'deployment.enabled',
      name: 'Enable Deployment',
      defaultValue: false,
      type: 'boolean',
      description: 'Enable deployment of MCP servers from GitHub repositories',
      encrypted: false,
      required: false
    },
    {
      key: 'deployment.github_app.app_id',
      name: 'GitHub App ID',
      defaultValue: '',
      type: 'string',
      description: 'GitHub App ID for deployment installation flow',
      encrypted: false,
      required: false
    },
    {
      key: 'deployment.github_app.app_slug',
      name: 'GitHub App Slug',
      defaultValue: '',
      type: 'string',
      description: 'GitHub App slug used in installation URLs (e.g., "ds-mcp-deployer-staging")',
      encrypted: false,
      required: false
    },
    {
      key: 'deployment.github_app.private_key_base64',
      name: 'GitHub App Private Key (Base64)',
      defaultValue: '',
      type: 'string',
      description: 'GitHub App private key encoded in base64 format (for generating installation access tokens)',
      encrypted: true,
      required: false
    },
    {
      key: 'deployment.github_app.webhook_secret',
      name: 'GitHub Webhook Secret',
      defaultValue: '',
      type: 'string',
      description: 'Webhook secret for HMAC signature validation',
      encrypted: true,
      required: false
    }
  ]
};
