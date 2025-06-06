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
      defaultValue: 'http://localhost:5173',
      type: 'string',
      description: 'Base URL for the application frontend',
      encrypted: false,
      required: false
    },
    {
      key: 'global.send_mail',
      defaultValue: false,
      type: 'boolean',
      description: 'Enable or disable email sending functionality',
      encrypted: false,
      required: false
    },
    {
      key: 'global.enable_login',
      defaultValue: true,
      type: 'boolean',
      description: 'Enable or disable all login functionality (email, GitHub, etc.)',
      encrypted: false,
      required: false
    },
    {
      key: 'global.enable_email_registration',
      defaultValue: true,
      type: 'boolean',
      description: 'Enable or disable email registration',
      encrypted: false,
      required: false
    },
    {
      key: 'global.enable_swagger_docs',
      defaultValue: true,
      type: 'boolean',
      description: 'Enable or disable Swagger API documentation endpoint (/documentation)',
      encrypted: false,
      required: false
    }
  ]
};
