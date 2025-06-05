import type { GlobalSettingsModule } from './types';

export const smtpSettings: GlobalSettingsModule = {
  group: {
    id: 'smtp',
    name: 'SMTP Mail Settings',
    description: 'Email server configuration for sending notifications',
    icon: 'mail',
    sort_order: 1
  },
  settings: [
    {
      key: 'smtp.host',
      defaultValue: '',
      type: 'string',
      description: 'SMTP server hostname (e.g., smtp.gmail.com)',
      encrypted: false,
      required: true
    },
    {
      key: 'smtp.port',
      defaultValue: 587,
      type: 'number',
      description: 'SMTP server port (587 for TLS, 465 for SSL, 25 for unencrypted)',
      encrypted: false,
      required: true
    },
    {
      key: 'smtp.username',
      defaultValue: '',
      type: 'string',
      description: 'SMTP authentication username',
      encrypted: false,
      required: true
    },
    {
      key: 'smtp.password',
      defaultValue: '',
      type: 'string',
      description: 'SMTP authentication password',
      encrypted: true,
      required: true
    },
    {
      key: 'smtp.secure',
      defaultValue: true,
      type: 'boolean',
      description: 'Use SSL/TLS for SMTP connection',
      encrypted: false,
      required: false
    },
    {
      key: 'smtp.from_name',
      defaultValue: 'DeployStack',
      type: 'string',
      description: 'Default sender name for emails',
      encrypted: false,
      required: false
    },
    {
      key: 'smtp.from_email',
      defaultValue: '',
      type: 'string',
      description: 'Default sender email address',
      encrypted: false,
      required: false
    }
  ]
};
