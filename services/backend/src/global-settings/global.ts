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
    }
  ]
};
