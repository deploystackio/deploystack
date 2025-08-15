// Email system exports
export { EmailService } from './emailService';
export { TemplateRenderer } from './templateRenderer';
export * from './types';

// Re-export for convenience
import { EmailService } from './emailService';
export default EmailService;
