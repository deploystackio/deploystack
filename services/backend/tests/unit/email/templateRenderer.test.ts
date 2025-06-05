import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TemplateRenderer } from '../../../src/email/templateRenderer';
import type { TemplateRenderOptions, TemplateValidationResult } from '../../../src/email/types';

// Create mock functions using vi.hoisted
const { mockCompileFile, mockExistsSync, mockReadFileSync, mockReaddirSync, mockMkdirSync } = vi.hoisted(() => ({
  mockCompileFile: vi.fn(),
  mockExistsSync: vi.fn(),
  mockReadFileSync: vi.fn(),
  mockReaddirSync: vi.fn(),
  mockMkdirSync: vi.fn(),
}));

// Mock pug
vi.mock('pug', () => ({
  default: {
    compileFile: mockCompileFile,
  },
  compileFile: mockCompileFile,
}));

// Mock fs
vi.mock('fs', () => ({
  default: {
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
    readdirSync: mockReaddirSync,
    mkdirSync: mockMkdirSync,
  },
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  readdirSync: mockReaddirSync,
  mkdirSync: mockMkdirSync,
}));

// Mock path module
vi.mock('path', () => ({
  default: {
    join: (...args: string[]) => args.join('/'),
  },
  join: (...args: string[]) => args.join('/'),
}));

describe('TemplateRenderer', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let mockCompiledTemplate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetAllMocks();
    
    // Setup console spy
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Setup mock compiled template function
    mockCompiledTemplate = vi.fn().mockReturnValue('<html><body>Rendered content</body></html>');
    mockCompileFile.mockReturnValue(mockCompiledTemplate);
    
    // Default mocks
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('p Hello #{userName}!');
    mockReaddirSync.mockReturnValue(['welcome.pug', 'notification.pug', '_layout.pug']);
    mockMkdirSync.mockImplementation(() => {});
    
    // Clear template cache
    TemplateRenderer.clearCache();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('render', () => {
    const validRenderOptions: TemplateRenderOptions = {
      template: 'welcome',
      variables: { userName: 'John Doe' },
    };

    it('should render template successfully with variables', async () => {
      const result = await TemplateRenderer.render(validRenderOptions);

      expect(result).toBe('<html><body>Rendered content</body></html>');
      expect(mockExistsSync).toHaveBeenCalledWith(expect.stringContaining('welcome.pug'));
      expect(mockCompileFile).toHaveBeenCalledWith(
        expect.stringContaining('welcome.pug'),
        expect.objectContaining({
          basedir: expect.stringContaining('templates'),
          pretty: false,
          cache: true,
        })
      );
      expect(mockCompiledTemplate).toHaveBeenCalledWith({
        userName: 'John Doe',
        currentYear: new Date().getFullYear(),
        appName: 'DeployStack',
        layout: 'base',
        layoutsDir: expect.stringContaining('layouts'),
      });
    });

    it('should use custom layout when specified', async () => {
      const options = {
        ...validRenderOptions,
        layout: 'minimal',
      };

      await TemplateRenderer.render(options);

      expect(mockCompiledTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          layout: 'minimal',
        })
      );
    });

    it('should cache compiled templates', async () => {
      // First render
      await TemplateRenderer.render(validRenderOptions);
      expect(mockCompileFile).toHaveBeenCalledTimes(1);

      // Second render should use cache
      await TemplateRenderer.render(validRenderOptions);
      expect(mockCompileFile).toHaveBeenCalledTimes(1); // Still only called once
      expect(mockCompiledTemplate).toHaveBeenCalledTimes(2); // But template executed twice
    });

    it('should throw error when template does not exist', async () => {
      mockExistsSync.mockReturnValue(false);

      await expect(TemplateRenderer.render(validRenderOptions))
        .rejects
        .toThrow("Template 'welcome' not found");
    });

    it('should throw error when template compilation fails', async () => {
      const compilationError = new Error('Invalid pug syntax');
      mockCompileFile.mockImplementation(() => {
        throw compilationError;
      });

      await expect(TemplateRenderer.render(validRenderOptions))
        .rejects
        .toThrow("Failed to render template 'welcome': Invalid pug syntax");
    });

    it('should throw error when template execution fails', async () => {
      const executionError = new Error('Variable not defined');
      mockCompiledTemplate.mockImplementation(() => {
        throw executionError;
      });

      await expect(TemplateRenderer.render(validRenderOptions))
        .rejects
        .toThrow("Failed to render template 'welcome': Variable not defined");
    });

    it('should include helper variables in template context', async () => {
      await TemplateRenderer.render(validRenderOptions);

      expect(mockCompiledTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          currentYear: expect.any(Number),
          appName: 'DeployStack',
          layoutsDir: expect.stringContaining('layouts'),
        })
      );
    });
  });

  describe('validateTemplate', () => {
    it('should return valid result for existing template with all variables', async () => {
      mockReadFileSync.mockReturnValue('p Hello #{userName}! Welcome to #{appName}.');

      const result = await TemplateRenderer.validateTemplate('welcome', {
        userName: 'John',
        appName: 'TestApp',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.missingVariables).toEqual([]);
    });

    it('should return invalid result for non-existent template', async () => {
      mockExistsSync.mockReturnValue(false);

      const result = await TemplateRenderer.validateTemplate('nonexistent', {});

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Template 'nonexistent' not found");
    });

    it('should detect missing variables', async () => {
      mockReadFileSync.mockReturnValue('p Hello #{userName}! Your email is #{userEmail}.');

      const result = await TemplateRenderer.validateTemplate('welcome', {
        userName: 'John',
        // Missing userEmail
      });

      expect(result.valid).toBe(false);
      expect(result.missingVariables).toContain('userEmail');
      expect(result.errors).toContain('Missing required variables: userEmail');
    });

    it('should handle template compilation errors during validation', async () => {
      const compilationError = new Error('Syntax error in template');
      mockCompileFile.mockImplementation(() => {
        throw compilationError;
      });

      const result = await TemplateRenderer.validateTemplate('welcome', {});

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Template compilation failed: Syntax error in template');
    });

    it('should handle validation errors gracefully', async () => {
      const validationError = new Error('File read error');
      mockReadFileSync.mockImplementation(() => {
        throw validationError;
      });

      const result = await TemplateRenderer.validateTemplate('welcome', {});

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Validation failed: File read error');
    });

    it('should extract variables from complex template syntax', async () => {
      mockReadFileSync.mockReturnValue(`
        p Hello #{userName}!
        if actionUrl
          a(href=actionUrl) #{actionText}
        p Your code is #{resetCode}
      `);

      const result = await TemplateRenderer.validateTemplate('complex', {
        userName: 'John',
        actionUrl: 'https://example.com',
        // Missing actionText and resetCode
      });

      expect(result.valid).toBe(false);
      expect(result.missingVariables).toContain('actionText');
      expect(result.missingVariables).toContain('resetCode');
    });
  });

  describe('getAvailableTemplates', () => {
    it('should return list of available templates', () => {
      mockReaddirSync.mockReturnValue(['welcome.pug', 'password-reset.pug', 'notification.pug', '_layout.pug', 'README.md']);

      const result = TemplateRenderer.getAvailableTemplates();

      expect(result).toEqual(['welcome', 'password-reset', 'notification']);
      expect(result).not.toContain('_layout'); // Should exclude files starting with _
      expect(result).not.toContain('README'); // Should exclude non-pug files
    });

    it('should return empty array when templates directory does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      const result = TemplateRenderer.getAvailableTemplates();

      expect(result).toEqual([]);
    });

    it('should handle readdir errors gracefully', () => {
      mockReaddirSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = TemplateRenderer.getAvailableTemplates();

      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to get available templates:', expect.any(Error));
    });
  });

  describe('clearCache', () => {
    it('should clear the template cache', async () => {
      // Render a template to populate cache
      await TemplateRenderer.render({
        template: 'welcome',
        variables: { userName: 'John' },
      });
      expect(mockCompileFile).toHaveBeenCalledTimes(1);

      // Clear cache
      TemplateRenderer.clearCache();

      // Render again should recompile
      await TemplateRenderer.render({
        template: 'welcome',
        variables: { userName: 'Jane' },
      });
      expect(mockCompileFile).toHaveBeenCalledTimes(2);
    });
  });

  describe('ensureTemplatesDirectory', () => {
    it('should create templates directory if it does not exist', () => {
      mockExistsSync.mockReturnValueOnce(false).mockReturnValueOnce(true); // templates dir doesn't exist, layouts dir exists

      TemplateRenderer.ensureTemplatesDirectory();

      expect(mockMkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('templates'),
        { recursive: true }
      );
    });

    it('should create layouts directory if it does not exist', () => {
      mockExistsSync.mockReturnValueOnce(true).mockReturnValueOnce(false); // templates dir exists, layouts dir doesn't exist

      TemplateRenderer.ensureTemplatesDirectory();

      expect(mockMkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('layouts'),
        { recursive: true }
      );
    });

    it('should create both directories if neither exist', () => {
      mockExistsSync.mockReturnValue(false);

      TemplateRenderer.ensureTemplatesDirectory();

      expect(mockMkdirSync).toHaveBeenCalledTimes(2);
      expect(mockMkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('templates'),
        { recursive: true }
      );
      expect(mockMkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('layouts'),
        { recursive: true }
      );
    });

    it('should not create directories if they already exist', () => {
      mockExistsSync.mockReturnValue(true);

      TemplateRenderer.ensureTemplatesDirectory();

      expect(mockMkdirSync).not.toHaveBeenCalled();
    });
  });

  describe('getTemplateMetadata', () => {
    it('should extract metadata from template comments', () => {
      mockReadFileSync.mockReturnValue(`
        // @description Welcome email template
        // @variables userName,userEmail,loginUrl
        p Hello #{userName}!
      `);

      const result = TemplateRenderer.getTemplateMetadata('welcome');

      expect(result.description).toBe('Welcome email template');
      expect(result.requiredVariables).toEqual(['userName', 'userEmail', 'loginUrl']);
    });

    it('should return empty metadata for template without comments', () => {
      mockReadFileSync.mockReturnValue('p Hello #{userName}!');

      const result = TemplateRenderer.getTemplateMetadata('welcome');

      expect(result.description).toBeUndefined();
      expect(result.requiredVariables).toBeUndefined();
    });

    it('should return empty metadata for non-existent template', () => {
      mockExistsSync.mockReturnValue(false);

      const result = TemplateRenderer.getTemplateMetadata('nonexistent');

      expect(result).toEqual({});
    });

    it('should handle file read errors gracefully', () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('File read error');
      });

      const result = TemplateRenderer.getTemplateMetadata('welcome');

      expect(result).toEqual({});
    });

    it('should parse variables with whitespace correctly', () => {
      mockReadFileSync.mockReturnValue(`
        // @variables userName, userEmail , loginUrl,  supportEmail
        p Hello #{userName}!
      `);

      const result = TemplateRenderer.getTemplateMetadata('welcome');

      expect(result.requiredVariables).toEqual(['userName', 'userEmail', 'loginUrl', 'supportEmail']);
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle undefined variables gracefully', async () => {
      const options: TemplateRenderOptions = {
        template: 'welcome',
        variables: {}, // No variables provided
      };

      const result = await TemplateRenderer.render(options);

      expect(result).toBe('<html><body>Rendered content</body></html>');
      expect(mockCompiledTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          currentYear: expect.any(Number),
          appName: 'DeployStack',
        })
      );
    });

    it('should handle special characters in template variables', async () => {
      const options: TemplateRenderOptions = {
        template: 'welcome',
        variables: {
          userName: 'John "The Developer" Doe',
          message: 'Hello & welcome!',
        },
      };

      await TemplateRenderer.render(options);

      expect(mockCompiledTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          userName: 'John "The Developer" Doe',
          message: 'Hello & welcome!',
        })
      );
    });

    it('should handle nested object variables', async () => {
      const options: TemplateRenderOptions = {
        template: 'welcome',
        variables: {
          user: {
            name: 'John Doe',
            email: 'john@example.com',
          },
          settings: {
            theme: 'dark',
            notifications: true,
          },
        },
      };

      await TemplateRenderer.render(options);

      expect(mockCompiledTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          user: {
            name: 'John Doe',
            email: 'john@example.com',
          },
          settings: {
            theme: 'dark',
            notifications: true,
          },
        })
      );
    });
  });
});