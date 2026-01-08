import type { GlobalSettingsModule } from './types';

export const userDisplaySettings: GlobalSettingsModule = {
  group: {
    id: 'user-display',
    name: 'User Display Settings',
    description: 'Control which UI elements and features are displayed to users in the application interface.',
    icon: 'eye',
    sort_order: 3
  },
  settings: [
    {
      key: 'user-display.header_show_discord',
      name: 'Show Discord Button in Header',
      defaultValue: false,
      type: 'boolean',
      description: 'Display the Discord community button in the application header.',
      encrypted: false,
      required: false
    },
    {
      key: 'user-display.header_show_feedback',
      name: 'Show Feedback Form in Header',
      defaultValue: true,
      type: 'boolean',
      description: 'Display the feedback form button in the application header.',
      encrypted: false,
      required: false
    }
  ]
};
