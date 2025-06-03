import type { GlobalSettingsModule } from './types';

export const githubOAuthSettings: GlobalSettingsModule = {
  group: {
    id: 'github-oauth',
    name: 'GitHub OAuth Configuration',
    description: 'GitHub authentication settings for user login',
    icon: 'github',
    sort_order: 2
  },
  settings: [
    {
      key: 'github.oauth.client_id',
      defaultValue: '',
      type: 'string',
      description: 'GitHub OAuth application client ID',
      encrypted: false,
      required: false
    },
    {
      key: 'github.oauth.client_secret',
      defaultValue: '',
      type: 'string',
      description: 'GitHub OAuth application client secret',
      encrypted: true,
      required: false
    },
    {
      key: 'github.oauth.enabled',
      defaultValue: false,
      type: 'boolean',
      description: 'Enable GitHub OAuth authentication',
      encrypted: false,
      required: false
    },
    {
      key: 'github.oauth.callback_url',
      defaultValue: 'http://localhost:3000/api/auth/github/callback',
      type: 'string',
      description: 'GitHub OAuth callback URL',
      encrypted: false,
      required: false
    },
    {
      key: 'github.oauth.scope',
      defaultValue: 'user:email',
      type: 'string',
      description: 'GitHub OAuth requested scopes',
      encrypted: false,
      required: false
    }
  ]
};
