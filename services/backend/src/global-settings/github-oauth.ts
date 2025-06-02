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
      description: 'GitHub OAuth application client ID',
      encrypted: false,
      required: false
    },
    {
      key: 'github.oauth.client_secret',
      defaultValue: '',
      description: 'GitHub OAuth application client secret',
      encrypted: true,
      required: false
    },
    {
      key: 'github.oauth.enabled',
      defaultValue: 'false',
      description: 'Enable GitHub OAuth authentication (true/false)',
      encrypted: false,
      required: false
    },
    {
      key: 'github.oauth.callback_url',
      defaultValue: 'http://localhost:3000/api/auth/github/callback',
      description: 'GitHub OAuth callback URL',
      encrypted: false,
      required: false
    },
    {
      key: 'github.oauth.scope',
      defaultValue: 'user:email',
      description: 'GitHub OAuth requested scopes',
      encrypted: false,
      required: false
    }
  ]
};
