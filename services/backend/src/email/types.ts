import { z } from 'zod';

// Zod schemas for validation
export const EmailAddressSchema = z.string().email('Invalid email address');

export const EmailAttachmentSchema = z.object({
  filename: z.string().min(1, 'Filename is required'),
  content: z.union([z.string(), z.instanceof(Buffer)]),
  contentType: z.string().optional(),
  encoding: z.string().optional(),
});

export const SendEmailOptionsSchema = z.object({
  to: z.union([EmailAddressSchema, z.array(EmailAddressSchema)]),
  subject: z.string().min(1, 'Subject is required'),
  template: z.string().min(1, 'Template name is required'),
  variables: z.record(z.string(), z.unknown()).optional().default({}),
  from: z.object({
    name: z.string().optional(),
    email: EmailAddressSchema.optional(),
  }).optional(),
  attachments: z.array(EmailAttachmentSchema).optional(),
  replyTo: EmailAddressSchema.optional(),
  cc: z.union([EmailAddressSchema, z.array(EmailAddressSchema)]).optional(),
  bcc: z.union([EmailAddressSchema, z.array(EmailAddressSchema)]).optional(),
});

// TypeScript interfaces
export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
  encoding?: string;
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  template: string;
  variables?: Record<string, unknown>;
  from?: {
    name?: string;
    email?: string;
  };
  attachments?: EmailAttachment[];
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
}

export interface EmailTemplate {
  name: string;
  path: string;
  description?: string;
  requiredVariables?: string[];
  optionalVariables?: string[];
}

export interface TemplateRenderOptions {
  template: string;
  variables: Record<string, unknown>;
  layout?: string;
}

export interface SmtpConfiguration {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: {
    name: string;
    address: string;
  };
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  recipients: string[];
}

export interface TemplateValidationResult {
  valid: boolean;
  errors: string[];
  missingVariables: string[];
}

// Email template variable types for common templates
export interface WelcomeEmailVariables {
  userName: string;
  userEmail: string;
  loginUrl: string;
  supportEmail?: string;
}

export interface PasswordResetEmailVariables {
  userName: string;
  resetUrl: string;
  expirationTime: string;
  supportEmail?: string;
}

export interface NotificationEmailVariables {
  title: string;
  message: string;
  actionUrl?: string;
  actionText?: string;
  userName?: string;
}

export interface EmailVerificationVariables {
  userName: string;
  userEmail: string;
  verificationUrl: string;
  expirationTime?: string;
  supportEmail?: string;
}

// Template registry for type safety
export interface TemplateVariableMap {
  welcome: WelcomeEmailVariables;
  'password-reset': PasswordResetEmailVariables;
  notification: NotificationEmailVariables;
  'email-verification': EmailVerificationVariables;
}

export type TemplateNames = keyof TemplateVariableMap;

// Type-safe email sending for specific templates
export type TypedSendEmailOptions<T extends TemplateNames> = Omit<SendEmailOptions, 'template' | 'variables'> & {
  template: T;
  variables: TemplateVariableMap[T];
};
