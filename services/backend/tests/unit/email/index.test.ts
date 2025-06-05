import { describe, it, expect } from 'vitest';

describe('Email Module Exports', () => {
  it('should export EmailService as named export', async () => {
    const { EmailService } = await import('../../../src/email/index');
    
    expect(EmailService).toBeDefined();
    expect(typeof EmailService).toBe('function'); // EmailService is a class, so it's a function
    expect(typeof EmailService.sendEmail).toBe('function');
    expect(typeof EmailService.testConnection).toBe('function');
    expect(typeof EmailService.getSmtpStatus).toBe('function');
    expect(typeof EmailService.refreshConfiguration).toBe('function');
    expect(typeof EmailService.getAvailableTemplates).toBe('function');
    expect(typeof EmailService.validateTemplate).toBe('function');
    expect(typeof EmailService.sendWelcomeEmail).toBe('function');
    expect(typeof EmailService.sendPasswordResetEmail).toBe('function');
    expect(typeof EmailService.sendNotificationEmail).toBe('function');
  });

  it('should export TemplateRenderer as named export', async () => {
    const { TemplateRenderer } = await import('../../../src/email/index');
    
    expect(TemplateRenderer).toBeDefined();
    expect(typeof TemplateRenderer).toBe('function'); // TemplateRenderer is a class, so it's a function
    expect(typeof TemplateRenderer.render).toBe('function');
    expect(typeof TemplateRenderer.validateTemplate).toBe('function');
    expect(typeof TemplateRenderer.getAvailableTemplates).toBe('function');
    expect(typeof TemplateRenderer.clearCache).toBe('function');
    expect(typeof TemplateRenderer.ensureTemplatesDirectory).toBe('function');
    expect(typeof TemplateRenderer.getTemplateMetadata).toBe('function');
  });

  it('should export all types', async () => {
    const emailModule = await import('../../../src/email/index');
    
    // Check that type exports don't cause runtime errors
    // Types are compile-time only, so we can't directly test them at runtime
    // But we can ensure the module imports without errors
    expect(emailModule).toBeDefined();
  });

  it('should export EmailService as default export', async () => {
    const defaultExport = await import('../../../src/email/index');
    
    expect(defaultExport.default).toBeDefined();
    expect(defaultExport.default).toBe(defaultExport.EmailService);
    expect(typeof defaultExport.default.sendEmail).toBe('function');
  });

  it('should have consistent exports between named and default', async () => {
    const { EmailService, default: DefaultEmailService } = await import('../../../src/email/index');
    
    expect(EmailService).toBe(DefaultEmailService);
    expect(EmailService.sendEmail).toBe(DefaultEmailService.sendEmail);
    expect(EmailService.testConnection).toBe(DefaultEmailService.testConnection);
  });

  it('should export all expected named exports', async () => {
    const emailModule = await import('../../../src/email/index') as any;
    
    const expectedExports = [
      'EmailService',
      'TemplateRenderer',
      'default',
    ];
    
    expectedExports.forEach(exportName => {
      expect(emailModule).toHaveProperty(exportName);
      expect(emailModule[exportName]).toBeDefined();
    });
  });

  it('should not export any unexpected properties', async () => {
    const emailModule = await import('../../../src/email/index') as any;
    
    const expectedExports = [
      'EmailService',
      'TemplateRenderer',
      'default',
      // Type exports from the types file
      'EmailAddressSchema',
      'EmailAttachmentSchema', 
      'SendEmailOptionsSchema',
    ];
    
    const actualExports = Object.keys(emailModule);
    
    // Check that all actual exports are expected
    expect(actualExports.length).toBeGreaterThan(0);
    actualExports.forEach(exportName => {
      expect(expectedExports).toContain(exportName);
    });
  });

  it('should maintain proper module structure', async () => {
    const emailModule = await import('../../../src/email/index');
    
    // Verify the module structure is as expected
    expect(typeof emailModule).toBe('object');
    expect(emailModule).not.toBeNull();
    expect(Object.keys(emailModule).length).toBeGreaterThan(0);
  });

  it('should allow destructuring imports', async () => {
    // Test that destructuring works as expected
    const { EmailService, TemplateRenderer } = await import('../../../src/email/index');
    
    expect(EmailService).toBeDefined();
    expect(TemplateRenderer).toBeDefined();
    expect(EmailService).not.toBe(TemplateRenderer);
  });

  it('should allow default import', async () => {
    // Test that default import works
    const EmailServiceDefault = (await import('../../../src/email/index')).default;
    
    expect(EmailServiceDefault).toBeDefined();
    expect(typeof EmailServiceDefault.sendEmail).toBe('function');
  });

  it('should allow mixed import styles', async () => {
    // Test that you can import both named and default exports together
    const emailModule = await import('../../../src/email/index');
    const { EmailService, TemplateRenderer, default: DefaultEmailService } = emailModule;
    
    expect(EmailService).toBeDefined();
    expect(TemplateRenderer).toBeDefined();
    expect(DefaultEmailService).toBeDefined();
    expect(EmailService).toBe(DefaultEmailService);
  });
});
