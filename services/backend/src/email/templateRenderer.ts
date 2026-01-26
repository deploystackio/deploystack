import * as pug from 'pug';
import * as path from 'path';
import * as fs from 'fs';
import type { FastifyBaseLogger } from 'fastify';
import type { TemplateRenderOptions, TemplateValidationResult } from './types';

export class TemplateRenderer {
  private static templateCache = new Map<string, pug.compileTemplate>();

  /**
   * Get templates directory path (resolved at runtime to avoid stale cached paths)
   */
  private static getTemplatesDir(): string {
    return path.join(__dirname, 'templates');
  }

  /**
   * Get layouts directory path (resolved at runtime to avoid stale cached paths)
   */
  private static getLayoutsDir(): string {
    return path.join(__dirname, 'templates', 'layouts');
  }

  /**
   * Render an email template with the given variables
   */
  static async render(options: TemplateRenderOptions): Promise<string> {
    const { template, variables, layout = 'base', logger } = options;

    try {
      // Validate template exists
      const templatePath = this.getTemplatePath(template);
      const templatesDir = this.getTemplatesDir();
      const fileExists = fs.existsSync(templatePath);

      // Structured trace logging with Pino logger
      if (logger) {
        logger.trace({
          operation: 'template_path_resolution',
          template,
          templatesDir,
          templatePath,
          fileExists,
          __dirname,
          cwd: process.cwd()
        }, `Resolving template path: ${template}`);
      }

      if (!fileExists) {
        throw new Error(`Template '${template}' not found at ${templatePath}`);
      }

      // Get compiled template from cache or compile it
      const compiledTemplate = await this.getCompiledTemplate(template);

      // Prepare template variables with layout information
      const templateVariables = {
        ...variables,
        // Add helper functions and common variables
        currentYear: new Date().getFullYear(),
        appName: 'DeployStack',
        // Layout information
        layout,
        layoutsDir: this.getLayoutsDir(),
      };

      // Render the template
      const html = compiledTemplate(templateVariables);
      return html;
    } catch (error) {
      throw new Error(`Failed to render template '${template}': ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate a template and check for missing variables
   */
  static async validateTemplate(template: string, variables: Record<string, unknown>): Promise<TemplateValidationResult> {
    const result: TemplateValidationResult = {
      valid: true,
      errors: [],
      missingVariables: [],
    };

    try {
      // Check if template exists
      const templatePath = this.getTemplatePath(template);
      if (!fs.existsSync(templatePath)) {
        result.valid = false;
        result.errors.push(`Template '${template}' not found`);
        return result;
      }

      // Try to compile the template
      try {
        await this.getCompiledTemplate(template);
      } catch (error) {
        result.valid = false;
        result.errors.push(`Template compilation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return result;
      }

      // Extract required variables from template (basic implementation)
      const templateContent = fs.readFileSync(templatePath, 'utf8');
      const variableMatches = templateContent.match(/#{(\w+)}/g) || [];
      const requiredVariables = variableMatches.map(match => match.slice(2, -1));

      // Check for missing variables
      for (const requiredVar of requiredVariables) {
        if (!(requiredVar in variables)) {
          result.missingVariables.push(requiredVar);
        }
      }

      if (result.missingVariables.length > 0) {
        result.valid = false;
        result.errors.push(`Missing required variables: ${result.missingVariables.join(', ')}`);
      }

    } catch (error) {
      result.valid = false;
      result.errors.push(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Get list of available templates
   */
  static getAvailableTemplates(logger: FastifyBaseLogger): string[] {
    try {
      const templatesDir = this.getTemplatesDir();
      if (!fs.existsSync(templatesDir)) {
        return [];
      }

      return fs.readdirSync(templatesDir)
        .filter(file => file.endsWith('.pug') && !file.startsWith('_'))
        .map(file => file.replace('.pug', ''));
    } catch (error) {
      logger.error({
        error,
        operation: 'get_available_templates'
      }, 'Failed to get available templates');
      return [];
    }
  }

  /**
   * Clear template cache (useful for development)
   */
  static clearCache(): void {
    this.templateCache.clear();
  }

  /**
   * Get compiled template from cache or compile it
   */
  private static async getCompiledTemplate(template: string): Promise<pug.compileTemplate> {
    const cacheKey = template;

    // Check cache first
    if (this.templateCache.has(cacheKey)) {
      return this.templateCache.get(cacheKey)!;
    }

    // Compile template
    const templatePath = this.getTemplatePath(template);
    const compiledTemplate = pug.compileFile(templatePath, {
      basedir: this.getTemplatesDir(),
      pretty: false,
      cache: process.env.NODE_ENV === 'production', // Only cache in production to avoid stale paths
    });

    // Cache the compiled template
    this.templateCache.set(cacheKey, compiledTemplate);

    return compiledTemplate;
  }

  /**
   * Get the full path to a template file
   */
  private static getTemplatePath(template: string): string {
    return path.join(this.getTemplatesDir(), `${template}.pug`);
  }

  /**
   * Ensure templates directory exists
   */
  static ensureTemplatesDirectory(): void {
    const templatesDir = this.getTemplatesDir();
    if (!fs.existsSync(templatesDir)) {
      fs.mkdirSync(templatesDir, { recursive: true });
    }

    const layoutsDir = this.getLayoutsDir();
    if (!fs.existsSync(layoutsDir)) {
      fs.mkdirSync(layoutsDir, { recursive: true });
    }
  }

  /**
   * Get template metadata (if available)
   */
  static getTemplateMetadata(template: string): { description?: string; requiredVariables?: string[] } {
    try {
      const templatePath = this.getTemplatePath(template);
      if (!fs.existsSync(templatePath)) {
        return {};
      }

      const content = fs.readFileSync(templatePath, 'utf8');
      
      // Extract metadata from comments (simple implementation)
      const descriptionMatch = content.match(/\/\/\s*@description\s+(.+)/);
      const variablesMatch = content.match(/\/\/\s*@variables\s+(.+)/);

      return {
        description: descriptionMatch ? descriptionMatch[1].trim() : undefined,
        requiredVariables: variablesMatch ? variablesMatch[1].split(',').map(v => v.trim()) : undefined,
      };
    } catch {
      return {};
    }
  }
}
