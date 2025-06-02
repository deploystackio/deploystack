import type { GlobalSettingsModule } from './types';

export const smtpSettings: GlobalSettingsModule = {
  category: 'smtp',
  settings: [
    {
      key: 'smtp.host',
      defaultValue: '',
      description: 'SMTP server hostname (e.g., smtp.gmail.com)',
      encrypted: false,
      required: true
    },
    {
      key: 'smtp.port',
      defaultValue: '587',
      description: 'SMTP server port (587 for TLS, 465 for SSL, 25 for unencrypted)',
      encrypted: false,
      required: true
    },
    {
      key: 'smtp.username',
      defaultValue: '',
      description: 'SMTP authentication username',
      encrypted: false,
      required: true
    },
    {
      key: 'smtp.password',
      defaultValue: '',
      description: 'SMTP authentication password',
      encrypted: true,
      required: true
    },
    {
      key: 'smtp.secure',
      defaultValue: 'true',
      description: 'Use SSL/TLS for SMTP connection (true/false)',
      encrypted: false,
      required: false
    },
    {
      key: 'smtp.from_name',
      defaultValue: 'DeployStack',
      description: 'Default sender name for emails',
      encrypted: false,
      required: false
    },
    {
      key: 'smtp.from_email',
      defaultValue: '',
      description: 'Default sender email address',
      encrypted: false,
      required: false
    }
  ]
};
