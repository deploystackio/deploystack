import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError, z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { GlobalSettingsService } from '../../services/globalSettingsService';
import { validateEncryption } from '../../utils/encryption'; // Static import
import { requirePermission } from '../../middleware/roleMiddleware';
import {
  CreateGlobalSettingSchema,
  UpdateGlobalSettingSchema,
  BulkGlobalSettingsSchema,
  SearchGlobalSettingsSchema,
  GlobalSettingSchema,
  type CreateGlobalSettingInput,
  type UpdateGlobalSettingInput,
  type BulkGlobalSettingsInput,
  type SearchGlobalSettingsInput,
} from './schemas';

// Response schemas for global settings API
const globalSettingResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful'),
  data: GlobalSettingSchema.optional().describe('Global setting data'),
  message: z.string().optional().describe('Success message')
});

const globalSettingsListResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful'),
  data: z.array(GlobalSettingSchema).describe('Array of global settings')
});

const globalSettingGroupSchema = z.object({
  id: z.string().describe('Group ID'),
  name: z.string().describe('Group display name'),
  description: z.string().nullable().describe('Group description'),
  icon: z.string().nullable().describe('Group icon'),
  sort_order: z.number().describe('Display sort order'),
  settings: z.array(GlobalSettingSchema).describe('Settings in this group'),
  created_at: z.date().describe('Group creation date'),
  updated_at: z.date().describe('Group last update date')
});

const globalSettingGroupsResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful'),
  data: z.array(globalSettingGroupSchema).describe('Array of setting groups with their settings')
});

const categoriesResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful'),
  data: z.array(z.string()).describe('Array of category names')
});

const healthResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful'),
  data: z.object({
    encryption_working: z.boolean().describe('Whether encryption system is working'),
    timestamp: z.string().describe('Health check timestamp')
  }).describe('Health check data'),
  message: z.string().describe('Health status message')
});

const bulkResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful'),
  data: z.array(GlobalSettingSchema).describe('Successfully processed settings'),
  errors: z.array(z.object({
    key: z.string().describe('Setting key that failed'),
    error: z.string().describe('Error message')
  })).optional().describe('Failed settings with error details'),
  message: z.string().describe('Bulk operation result message')
});

const errorResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful (false for errors)').default(false),
  error: z.string().describe('Error message'),
  details: z.any().optional().describe('Additional error details (validation errors)')
});

const successMessageResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful'),
  message: z.string().describe('Success message')
});

const paramsWithKeySchema = z.object({
  key: z.string().describe('Global setting key')
});

const paramsWithGroupIdSchema = z.object({
  groupId: z.string().describe('Group ID')
});

export default async function globalSettingsRoute(fastify: FastifyInstance) {
  // GET /api/settings/groups - List all groups with their settings (admin only)
  fastify.get('/api/settings/groups', {
    schema: {
      tags: ['Global Settings'],
      summary: 'List all setting groups',
      description: 'Retrieves all setting groups with their associated settings. Requires settings view permissions.',
      security: [{ cookieAuth: [] }],
      response: {
        200: zodToJsonSchema(globalSettingGroupsResponseSchema.describe('Successfully retrieved setting groups'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        401: zodToJsonSchema(errorResponseSchema.describe('Unauthorized - Authentication required'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        403: zodToJsonSchema(errorResponseSchema.describe('Forbidden - Insufficient permissions'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        500: zodToJsonSchema(errorResponseSchema.describe('Internal Server Error'), {
          $refStrategy: 'none',
          target: 'openApi3'
        })
      }
    },
    preHandler: requirePermission('settings.view'),
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const groupsWithSettings = await GlobalSettingsService.getAllGroupsWithSettings();
      return reply.status(200).send({
        success: true,
        data: groupsWithSettings,
      });
    } catch (error) {
      fastify.log.error(error, 'Error fetching all global setting groups with settings');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch all global setting groups with settings',
      });
    }
  });

  // GET /api/settings - List all global settings (admin only)
  fastify.get('/api/settings', {
    schema: {
      tags: ['Global Settings'],
      summary: 'List all global settings',
      description: 'Retrieves all global settings in the system. Requires settings view permissions.',
      security: [{ cookieAuth: [] }],
      response: {
        200: zodToJsonSchema(globalSettingsListResponseSchema.describe('Successfully retrieved global settings'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        401: zodToJsonSchema(errorResponseSchema.describe('Unauthorized - Authentication required'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        403: zodToJsonSchema(errorResponseSchema.describe('Forbidden - Insufficient permissions'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        500: zodToJsonSchema(errorResponseSchema.describe('Internal Server Error'), {
          $refStrategy: 'none',
          target: 'openApi3'
        })
      }
    },
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
    schema: {
      tags: ['Global Settings'],
      summary: 'Get global setting by key',
      description: 'Retrieves a specific global setting by its key. Requires settings view permissions.',
      security: [{ cookieAuth: [] }],
      params: zodToJsonSchema(paramsWithKeySchema, {
        $refStrategy: 'none',
        target: 'openApi3'
      }),
      response: {
        200: zodToJsonSchema(globalSettingResponseSchema.describe('Global setting retrieved successfully'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        401: zodToJsonSchema(errorResponseSchema.describe('Unauthorized - Authentication required'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        403: zodToJsonSchema(errorResponseSchema.describe('Forbidden - Insufficient permissions'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        404: zodToJsonSchema(errorResponseSchema.describe('Not Found - Setting not found'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        500: zodToJsonSchema(errorResponseSchema.describe('Internal Server Error'), {
          $refStrategy: 'none',
          target: 'openApi3'
        })
      }
    },
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
    schema: {
      tags: ['Global Settings'],
      summary: 'Create new global setting',
      description: 'Creates a new global setting with the specified key, value, and metadata. Requires settings edit permissions.',
      security: [{ cookieAuth: [] }],
      body: zodToJsonSchema(CreateGlobalSettingSchema, {
        $refStrategy: 'none',
        target: 'openApi3'
      }),
      response: {
        201: zodToJsonSchema(globalSettingResponseSchema.describe('Global setting created successfully'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        400: zodToJsonSchema(errorResponseSchema.describe('Bad Request - Validation error'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        401: zodToJsonSchema(errorResponseSchema.describe('Unauthorized - Authentication required'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        403: zodToJsonSchema(errorResponseSchema.describe('Forbidden - Insufficient permissions'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        409: zodToJsonSchema(errorResponseSchema.describe('Conflict - Setting with this key already exists'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        500: zodToJsonSchema(errorResponseSchema.describe('Internal Server Error'), {
          $refStrategy: 'none',
          target: 'openApi3'
        })
      }
    },
    preHandler: requirePermission('settings.edit'),
  }, async (request, reply) => {
    try {
      // Fastify has already validated request.body using CreateGlobalSettingSchema
      const validatedData = request.body;
      
      // Check if setting already exists
      const existing = await GlobalSettingsService.exists(validatedData.key);
      if (existing) {
        return reply.status(409).send({
          success: false,
          error: 'Setting with this key already exists. Use PUT to update.',
        });
      }

      const setting = await GlobalSettingsService.setTyped(
        validatedData.key,
        validatedData.value,
        validatedData.type,
        {
          description: validatedData.description,
          encrypted: validatedData.encrypted,
          group_id: validatedData.group_id,
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
    schema: {
      tags: ['Global Settings'],
      summary: 'Update global setting',
      description: 'Updates an existing global setting. Requires settings edit permissions.',
      security: [{ cookieAuth: [] }],
      params: zodToJsonSchema(paramsWithKeySchema, {
        $refStrategy: 'none',
        target: 'openApi3'
      }),
      body: zodToJsonSchema(UpdateGlobalSettingSchema, {
        $refStrategy: 'none',
        target: 'openApi3'
      }),
      response: {
        200: zodToJsonSchema(globalSettingResponseSchema.describe('Global setting updated successfully'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        400: zodToJsonSchema(errorResponseSchema.describe('Bad Request - Validation error'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        401: zodToJsonSchema(errorResponseSchema.describe('Unauthorized - Authentication required'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        403: zodToJsonSchema(errorResponseSchema.describe('Forbidden - Insufficient permissions'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        404: zodToJsonSchema(errorResponseSchema.describe('Not Found - Setting not found'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        500: zodToJsonSchema(errorResponseSchema.describe('Internal Server Error'), {
          $refStrategy: 'none',
          target: 'openApi3'
        })
      }
    },
    preHandler: requirePermission('settings.edit'),
  }, async (request, reply) => {
    try {
      const { key } = request.params;
      // Fastify has already validated request.body using UpdateGlobalSettingSchema
      const validatedData = request.body;
      
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
    schema: {
      tags: ['Global Settings'],
      summary: 'Delete global setting',
      description: 'Deletes a global setting from the system. Requires settings delete permissions.',
      security: [{ cookieAuth: [] }],
      params: zodToJsonSchema(paramsWithKeySchema, {
        $refStrategy: 'none',
        target: 'openApi3'
      }),
      response: {
        200: zodToJsonSchema(successMessageResponseSchema.describe('Global setting deleted successfully'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        401: zodToJsonSchema(errorResponseSchema.describe('Unauthorized - Authentication required'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        403: zodToJsonSchema(errorResponseSchema.describe('Forbidden - Insufficient permissions'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        404: zodToJsonSchema(errorResponseSchema.describe('Not Found - Setting not found'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        500: zodToJsonSchema(errorResponseSchema.describe('Internal Server Error'), {
          $refStrategy: 'none',
          target: 'openApi3'
        })
      }
    },
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

  // GET /api/settings/group/:groupId - Get settings by group (admin only)
  fastify.get<{ Params: { groupId: string } }>('/api/settings/group/:groupId', {
    schema: {
      tags: ['Global Settings'],
      summary: 'Get settings by group',
      description: 'Retrieves all global settings belonging to a specific group. Requires settings view permissions.',
      security: [{ cookieAuth: [] }],
      params: zodToJsonSchema(paramsWithGroupIdSchema, {
        $refStrategy: 'none',
        target: 'openApi3'
      }),
      response: {
        200: zodToJsonSchema(globalSettingsListResponseSchema.describe('Settings retrieved successfully'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        401: zodToJsonSchema(errorResponseSchema.describe('Unauthorized - Authentication required'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        403: zodToJsonSchema(errorResponseSchema.describe('Forbidden - Insufficient permissions'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        500: zodToJsonSchema(errorResponseSchema.describe('Internal Server Error'), {
          $refStrategy: 'none',
          target: 'openApi3'
        })
      }
    },
    preHandler: requirePermission('settings.view'),
  }, async (request, reply) => {
    try {
      const { groupId } = request.params;
      const settings = await GlobalSettingsService.getByGroup(groupId);
      
      return reply.status(200).send({
        success: true,
        data: settings,
      });
    } catch (error) {
      fastify.log.error(error, 'Error fetching settings by group');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch settings by group',
      });
    }
  });

  // GET /api/settings/categories - Get all categories (admin only)
  fastify.get('/api/settings/categories', {
    schema: {
      tags: ['Global Settings'],
      summary: 'Get all categories',
      description: 'Retrieves all available setting categories. Requires settings view permissions.',
      security: [{ cookieAuth: [] }],
      response: {
        200: zodToJsonSchema(categoriesResponseSchema.describe('Categories retrieved successfully'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        401: zodToJsonSchema(errorResponseSchema.describe('Unauthorized - Authentication required'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        403: zodToJsonSchema(errorResponseSchema.describe('Forbidden - Insufficient permissions'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        500: zodToJsonSchema(errorResponseSchema.describe('Internal Server Error'), {
          $refStrategy: 'none',
          target: 'openApi3'
        })
      }
    },
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
    schema: {
      tags: ['Global Settings'],
      summary: 'Search settings',
      description: 'Searches for global settings by key pattern. Requires settings view permissions.',
      security: [{ cookieAuth: [] }],
      body: zodToJsonSchema(SearchGlobalSettingsSchema, {
        $refStrategy: 'none',
        target: 'openApi3'
      }),
      response: {
        200: zodToJsonSchema(globalSettingsListResponseSchema.describe('Search results retrieved successfully'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        400: zodToJsonSchema(errorResponseSchema.describe('Bad Request - Validation error'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        401: zodToJsonSchema(errorResponseSchema.describe('Unauthorized - Authentication required'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        403: zodToJsonSchema(errorResponseSchema.describe('Forbidden - Insufficient permissions'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        500: zodToJsonSchema(errorResponseSchema.describe('Internal Server Error'), {
          $refStrategy: 'none',
          target: 'openApi3'
        })
      }
    },
    preHandler: requirePermission('settings.view'),
  }, async (request, reply) => {
    try {
      // Fastify has already validated request.body using SearchGlobalSettingsSchema
      const { pattern } = request.body;
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
    schema: {
      tags: ['Global Settings'],
      summary: 'Bulk create/update settings',
      description: 'Creates or updates multiple global settings in a single operation. Requires settings edit permissions.',
      security: [{ cookieAuth: [] }],
      body: zodToJsonSchema(BulkGlobalSettingsSchema, {
        $refStrategy: 'none',
        target: 'openApi3'
      }),
      response: {
        200: zodToJsonSchema(bulkResponseSchema.describe('All settings processed successfully'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        207: zodToJsonSchema(bulkResponseSchema.describe('Partial success - Some settings processed, some failed'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        400: zodToJsonSchema(errorResponseSchema.describe('Bad Request - Validation error or all settings failed'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        401: zodToJsonSchema(errorResponseSchema.describe('Unauthorized - Authentication required'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        403: zodToJsonSchema(errorResponseSchema.describe('Forbidden - Insufficient permissions'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        500: zodToJsonSchema(errorResponseSchema.describe('Internal Server Error'), {
          $refStrategy: 'none',
          target: 'openApi3'
        })
      }
    },
    preHandler: requirePermission('settings.edit'),
  }, async (request, reply) => {
    try {
      // Fastify has already validated request.body using BulkGlobalSettingsSchema
      const { settings } = request.body;
      
      const results = [];
      const errors = [];

      for (const settingData of settings) {
        try {
          const setting = await GlobalSettingsService.setTyped(
            settingData.key,
            settingData.value,
            settingData.type,
            {
              description: settingData.description,
              encrypted: settingData.encrypted,
              group_id: settingData.group_id,
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
    schema: {
      tags: ['Global Settings'],
      summary: 'Health check',
      description: 'Performs a health check on the global settings system, including encryption functionality. Requires settings view permissions.',
      security: [{ cookieAuth: [] }],
      response: {
        200: zodToJsonSchema(healthResponseSchema.describe('Health check completed successfully'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        401: zodToJsonSchema(errorResponseSchema.describe('Unauthorized - Authentication required'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        403: zodToJsonSchema(errorResponseSchema.describe('Forbidden - Insufficient permissions'), {
          $refStrategy: 'none',
          target: 'openApi3'
        }),
        500: zodToJsonSchema(errorResponseSchema.describe('Internal Server Error'), {
          $refStrategy: 'none',
          target: 'openApi3'
        })
      }
    },
    preHandler: requirePermission('settings.view'),
  }, async (request, reply) => {
    try {
      // const { validateEncryption } = await import('@src/utils/encryption'); // Removed dynamic import
      const encryptionWorking = validateEncryption(); // Use statically imported function
      
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
