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
      key: 'smtp.enabled',
      name: 'Enable SMTP',
      defaultValue: false,
      type: 'boolean',
      description: 'Allow the application to send emails via SMTP.',
      encrypted: false,
      required: false
    },
    {
      key: 'smtp.host',
      name: 'SMTP Host',
      defaultValue: '',
      type: 'string',
      description: 'SMTP server hostname (e.g., smtp.gmail.com).',
      encrypted: false,
      required: true
    },
    {
      key: 'smtp.port',
      name: 'SMTP Port',
      defaultValue: 587,
      type: 'number',
      description: 'SMTP server port. Use 587 for TLS, 465 for SSL, or 25 for unencrypted.',
      encrypted: false,
      required: true
    },
    {
      key: 'smtp.username',
      name: 'SMTP Username',
      defaultValue: '',
      type: 'string',
      description: 'Username for SMTP authentication.',
      encrypted: false,
      required: true
    },
    {
      key: 'smtp.password',
      name: 'SMTP Password',
      defaultValue: '',
      type: 'string',
      description: 'Password for SMTP authentication.',
      encrypted: true,
      required: true
    },
    {
      key: 'smtp.secure',
      name: 'Use SSL/TLS',
      defaultValue: true,
      type: 'boolean',
      description: 'Use a secure SSL/TLS connection for SMTP.',
      encrypted: false,
      required: false
    },
    {
      key: 'smtp.from_name',
      name: 'Sender Name',
      defaultValue: 'DeployStack',
      type: 'string',
      description: 'Default sender name displayed in outgoing emails.',
      encrypted: false,
      required: false
    },
    {
      key: 'smtp.from_email',
      name: 'Sender Email',
      defaultValue: '',
      type: 'string',
      description: 'Default sender email address for outgoing emails.',
      encrypted: false,
      required: false
    }
  ]
};
