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
      name: 'Client ID',
      defaultValue: '',
      type: 'string',
      description: 'GitHub OAuth application client ID.',
      encrypted: false,
      required: false
    },
    {
      key: 'github.oauth.client_secret',
      name: 'Client Secret',
      defaultValue: '',
      type: 'string',
      description: 'GitHub OAuth application client secret.',
      encrypted: true,
      required: false
    },
    {
      key: 'github.oauth.enabled',
      name: 'Enable GitHub OAuth',
      defaultValue: false,
      type: 'boolean',
      description: 'Allow users to authenticate using their GitHub account.',
      encrypted: false,
      required: false
    },
    {
      key: 'github.oauth.callback_url',
      name: 'Callback URL',
      defaultValue: 'http://localhost:3000/api/auth/github/callback',
      type: 'string',
      description: 'URL where GitHub redirects users after authorization.',
      encrypted: false,
      required: false
    },
    {
      key: 'github.oauth.scope',
      name: 'OAuth Scopes',
      defaultValue: 'user:email',
      type: 'string',
      description: 'Permissions requested from GitHub. The user:email scope is required for email access.',
      encrypted: false,
      required: false
    }
  ]
};
