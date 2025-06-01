import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { GlobalSettingsService } from '../../services/globalSettingsService';
import { requirePermission } from '../../middleware/roleMiddleware';
import {
  CreateGlobalSettingSchema,
  UpdateGlobalSettingSchema,
  BulkGlobalSettingsSchema,
  SearchGlobalSettingsSchema,
  type CreateGlobalSettingInput,
  type UpdateGlobalSettingInput,
  type BulkGlobalSettingsInput,
  type SearchGlobalSettingsInput,
} from './schemas';

export default async function globalSettingsRoute(fastify: FastifyInstance) {
  // GET /api/settings - List all global settings (admin only)
  fastify.get('/api/settings', {
    preHandler: requirePermission('settings.view'),
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const settings = await GlobalSettingsService.getAll();
      return reply.status(200).send({
        success: true,
        data: settings,
      });
    } catch (error) {
      fastify.log.error(error, 'Error fetching global settings');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch global settings',
      });
    }
  });

  // GET /api/settings/:key - Get specific global setting (admin only)
  fastify.get<{ Params: { key: string } }>('/api/settings/:key', {
    preHandler: requirePermission('settings.view'),
  }, async (request, reply) => {
    try {
      const { key } = request.params;
      const setting = await GlobalSettingsService.get(key);
      
      if (!setting) {
        return reply.status(404).send({
          success: false,
          error: 'Setting not found',
        });
      }

      return reply.status(200).send({
        success: true,
        data: setting,
      });
    } catch (error) {
      fastify.log.error(error, 'Error fetching global setting');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch global setting',
      });
    }
  });

  // POST /api/settings - Create new global setting (admin only)
  fastify.post<{ Body: CreateGlobalSettingInput }>('/api/settings', {
    preHandler: requirePermission('settings.edit'),
  }, async (request, reply) => {
    try {
      const validatedData = CreateGlobalSettingSchema.parse(request.body);
      
      // Check if setting already exists
      const existing = await GlobalSettingsService.exists(validatedData.key);
      if (existing) {
        return reply.status(409).send({
          success: false,
          error: 'Setting with this key already exists. Use PUT to update.',
        });
      }

      const setting = await GlobalSettingsService.set(
        validatedData.key,
        validatedData.value,
        {
          description: validatedData.description,
          encrypted: validatedData.encrypted,
          category: validatedData.category,
        }
      );

      return reply.status(201).send({
        success: true,
        data: setting,
        message: 'Global setting created successfully',
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
      }
      
      fastify.log.error(error, 'Error creating global setting');
      return reply.status(500).send({
        success: false,
        error: 'Failed to create global setting',
      });
    }
  });

  // PUT /api/settings/:key - Update existing global setting (admin only)
  fastify.put<{ Params: { key: string }; Body: UpdateGlobalSettingInput }>('/api/settings/:key', {
    preHandler: requirePermission('settings.edit'),
  }, async (request, reply) => {
    try {
      const { key } = request.params;
      const validatedData = UpdateGlobalSettingSchema.parse(request.body);
      
      const setting = await GlobalSettingsService.update(key, validatedData);
      
      if (!setting) {
        return reply.status(404).send({
          success: false,
          error: 'Setting not found',
        });
      }

      return reply.status(200).send({
        success: true,
        data: setting,
        message: 'Global setting updated successfully',
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
      }
      
      fastify.log.error(error, 'Error updating global setting');
      return reply.status(500).send({
        success: false,
        error: 'Failed to update global setting',
      });
    }
  });

  // DELETE /api/settings/:key - Delete global setting (admin only)
  fastify.delete<{ Params: { key: string } }>('/api/settings/:key', {
    preHandler: requirePermission('settings.delete'),
  }, async (request, reply) => {
    try {
      const { key } = request.params;
      
      const success = await GlobalSettingsService.delete(key);
      
      if (!success) {
        return reply.status(404).send({
          success: false,
          error: 'Setting not found',
        });
      }

      return reply.status(200).send({
        success: true,
        message: 'Global setting deleted successfully',
      });
    } catch (error) {
      fastify.log.error(error, 'Error deleting global setting');
      return reply.status(500).send({
        success: false,
        error: 'Failed to delete global setting',
      });
    }
  });

  // GET /api/settings/category/:category - Get settings by category (admin only)
  fastify.get<{ Params: { category: string } }>('/api/settings/category/:category', {
    preHandler: requirePermission('settings.view'),
  }, async (request, reply) => {
    try {
      const { category } = request.params;
      const settings = await GlobalSettingsService.getByCategory(category);
      
      return reply.status(200).send({
        success: true,
        data: settings,
      });
    } catch (error) {
      fastify.log.error(error, 'Error fetching settings by category');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch settings by category',
      });
    }
  });

  // GET /api/settings/categories - Get all categories (admin only)
  fastify.get('/api/settings/categories', {
    preHandler: requirePermission('settings.view'),
  }, async (request, reply) => {
    try {
      const categories = await GlobalSettingsService.getCategories();
      
      return reply.status(200).send({
        success: true,
        data: categories,
      });
    } catch (error) {
      fastify.log.error(error, 'Error fetching categories');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch categories',
      });
    }
  });

  // POST /api/settings/search - Search settings by key pattern (admin only)
  fastify.post<{ Body: SearchGlobalSettingsInput }>('/api/settings/search', {
    preHandler: requirePermission('settings.view'),
  }, async (request, reply) => {
    try {
      const { pattern } = SearchGlobalSettingsSchema.parse(request.body);
      const settings = await GlobalSettingsService.search(pattern);
      
      return reply.status(200).send({
        success: true,
        data: settings,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
      }
      
      fastify.log.error(error, 'Error searching settings');
      return reply.status(500).send({
        success: false,
        error: 'Failed to search settings',
      });
    }
  });

  // POST /api/settings/bulk - Bulk create/update settings (admin only)
  fastify.post<{ Body: BulkGlobalSettingsInput }>('/api/settings/bulk', {
    preHandler: requirePermission('settings.edit'),
  }, async (request, reply) => {
    try {
      const { settings } = BulkGlobalSettingsSchema.parse(request.body);
      
      const results = [];
      const errors = [];

      for (const settingData of settings) {
        try {
          const setting = await GlobalSettingsService.set(
            settingData.key,
            settingData.value,
            {
              description: settingData.description,
              encrypted: settingData.encrypted,
              category: settingData.category,
            }
          );
          results.push(setting);
        } catch (error) {
          errors.push({
            key: settingData.key,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      const hasErrors = errors.length > 0;
      const status = hasErrors ? (results.length > 0 ? 207 : 400) : 200; // 207 = Multi-Status

      return reply.status(status).send({
        success: !hasErrors || results.length > 0,
        data: results,
        errors: hasErrors ? errors : undefined,
        message: hasErrors 
          ? `Processed ${results.length} settings successfully, ${errors.length} failed`
          : `Successfully processed ${results.length} settings`,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
      }
      
      fastify.log.error(error, 'Error in bulk settings operation');
      return reply.status(500).send({
        success: false,
        error: 'Failed to process bulk settings operation',
      });
    }
  });

  // GET /api/settings/health - Health check for encryption system (admin only)
  fastify.get('/api/settings/health', {
    preHandler: requirePermission('settings.view'),
  }, async (request, reply) => {
    try {
      const { validateEncryption } = await import('../../utils/encryption');
      const encryptionWorking = validateEncryption();
      
      return reply.status(200).send({
        success: true,
        data: {
          encryption_working: encryptionWorking,
          timestamp: new Date().toISOString(),
        },
        message: encryptionWorking 
          ? 'Global settings system is healthy'
          : 'Warning: Encryption system is not working properly',
      });
    } catch (error) {
      fastify.log.error(error, 'Error checking settings health');
      return reply.status(500).send({
        success: false,
        error: 'Failed to check settings health',
      });
    }
  });
}
