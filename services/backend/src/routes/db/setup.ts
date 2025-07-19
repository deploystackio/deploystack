import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { initializeDatabase } from '../../db';
import { getDatabaseConfig, validateDatabaseConfig } from '../../db/config';
import { DbSetupRequestBodySchema, DatabaseType } from './schemas';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import fs from 'node:fs/promises';
import path from 'node:path';

// Response schemas for different scenarios
const setupSuccessResponseSchema = z.object({
  message: z.string().describe('Success message indicating the database setup status.'),
  restart_required: z.boolean().describe('Indicates whether a server restart is required to complete the setup.'),
  database_type: z.string().describe('The type of database that was configured.')
});

const setupErrorResponseSchema = z.object({
  error: z.string().describe('Error message describing what went wrong.'),
  details: z.any().optional().describe('Additional error details.')
});

const setupConflictResponseSchema = z.object({
  message: z.string().describe('Message indicating that database setup has already been performed.'),
  database_type: z.string().describe('The type of database that is currently configured.')
});

// Route schema for OpenAPI documentation
const dbSetupRouteSchema = {
  tags: ['Database'],
  summary: 'Setup database',
  description: 'Initializes and configures the database for the DeployStack application. This endpoint sets up the database schema, creates necessary tables, and initializes database-dependent services. Can only be called once - subsequent calls will return a conflict error.',
  requestBody: {
    content: {
      'application/json': {
        schema: zodToJsonSchema(DbSetupRequestBodySchema, {
          $refStrategy: 'none',
          target: 'openApi3'
        })
      }
    },
    required: true
  },
  response: {
    200: zodToJsonSchema(setupSuccessResponseSchema.describe('Database setup completed successfully'), {
      $refStrategy: 'none',
      target: 'openApi3'
    }),
    400: zodToJsonSchema(setupErrorResponseSchema.describe('Bad Request - Invalid input or unsupported database type'), {
      $refStrategy: 'none',
      target: 'openApi3'
    }),
    409: zodToJsonSchema(setupConflictResponseSchema.describe('Conflict - Database setup has already been performed'), {
      $refStrategy: 'none',
      target: 'openApi3'
    }),
    500: zodToJsonSchema(setupErrorResponseSchema.describe('Internal Server Error - Database setup failed'), {
      $refStrategy: 'none',
      target: 'openApi3'
    })
  }
};

/**
 * Save database selection to persistent_data/db.selection.json
 */
async function saveDatabaseSelection(dbType: DatabaseType): Promise<void> {
  const persistentDataDir = path.join(process.cwd(), 'persistent_data');
  const selectionFile = path.join(persistentDataDir, 'db.selection.json');
  
  // Ensure persistent_data directory exists
  await fs.mkdir(persistentDataDir, { recursive: true });
  
  const selection = {
    type: dbType,
    selectedAt: new Date().toISOString(),
    version: '1.0'
  };
  
  await fs.writeFile(selectionFile, JSON.stringify(selection, null, 2), 'utf8');
}

/**
 * Check if database selection already exists
 */
async function getDatabaseSelection(): Promise<{ type: DatabaseType; selectedAt: string } | null> {
  try {
    const persistentDataDir = path.join(process.cwd(), 'persistent_data');
    const selectionFile = path.join(persistentDataDir, 'db.selection.json');
    
    const content = await fs.readFile(selectionFile, 'utf8');
    const selection = JSON.parse(content);
    
    return {
      type: selection.type as DatabaseType,
      selectedAt: selection.selectedAt
    };
  } catch {
    // File doesn't exist or is invalid
    return null;
  }
}

/**
 * Set environment variables for the selected database type
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setDatabaseEnvironment(dbType: DatabaseType, logger?: any): void {
  // Clear any existing DB_TYPE
  delete process.env.DB_TYPE;
  
  // Set the selected database type
  process.env.DB_TYPE = dbType;
  
  if (logger) {
    logger.info({
      operation: 'set_database_environment',
      databaseType: dbType
    }, `Database type set to: ${dbType}`);
  }
}

// Handler for POST /api/db/setup
async function setupDbHandler(
  request: FastifyRequest,
  reply: FastifyReply,
  server: FastifyInstance
) {
  try {
    // Validate request body
    const parseResult = DbSetupRequestBodySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ 
        error: 'Invalid request body',
        details: parseResult.error.issues
      });
    }

    const { type: dbType } = parseResult.data;

    // Check if database is already configured
    const existingSelection = await getDatabaseSelection();
    if (existingSelection) {
      server.log.warn('Attempt to setup database when already configured.');
      return reply.status(409).send({ 
        message: 'Database setup has already been performed.',
        database_type: existingSelection.type
      });
    }

    // Validate that the selected database type has proper environment configuration
    setDatabaseEnvironment(dbType, server.log);
    
    let dbConfig;
    try {
      dbConfig = getDatabaseConfig(server.log);
    } catch (error) {
      const typedError = error as Error;
      server.log.error('Database configuration error:', typedError.message);
      return reply.status(400).send({ 
        error: 'Database configuration incomplete. Please check environment variables.',
        details: typedError.message
      });
    }

    // Validate configuration
    if (!validateDatabaseConfig(dbConfig)) {
      server.log.error('Invalid database configuration for selected type');
      return reply.status(400).send({ 
        error: `Invalid ${dbType} database configuration. Please check environment variables.`,
        details: `Database type: ${dbType}`
      });
    }

    server.log.info(`Setting up ${dbType} database...`);
    
    // Save the database selection
    await saveDatabaseSelection(dbType);
    server.log.info(`Database selection saved: ${dbType}`);
    
    // Initialize database
    const success = await initializeDatabase(request.log);
    
    if (success) {
      server.log.info('Database initialization successful.');
      
      try {
        // Re-initialize database-dependent services
        server.log.info('Re-initializing database-dependent services...');
        const reinitSuccess = await server.reinitializeDatabaseServices();
        
        if (reinitSuccess) {
          // Re-initialize plugins with database access
          server.log.info('Re-initializing plugins with database access...');
          await server.reinitializePluginsWithDatabase();
          
          server.log.info('Database setup and re-initialization completed successfully.');
          return reply.status(200).send({ 
            message: 'Database setup successful. All services have been initialized and are ready to use.',
            restart_required: false,
            database_type: dbType
          });
        } else {
          server.log.warn('Database initialization succeeded but re-initialization failed. Manual restart may be required.');
          return reply.status(200).send({ 
            message: 'Database setup successful, but some services may require a server restart to function properly.',
            restart_required: true,
            database_type: dbType
          });
        }
      } catch (reinitError) {
        server.log.error('Error during re-initialization after database setup:', reinitError);
        return reply.status(200).send({ 
          message: 'Database setup successful, but re-initialization failed. Please restart the server to complete setup.',
          restart_required: true,
          database_type: dbType
        });
      }
    } else {
      server.log.error('Database initialization failed.');
      return reply.status(500).send({ 
        error: 'Database initialization failed. Check server logs and configuration.'
      });
    }
  } catch (error) {
    const typedError = error as Error;
    server.log.error(typedError, `Error during database setup: ${typedError.message}`);
    return reply.status(500).send({ 
      error: `Database setup failed: ${typedError.message}`
    });
  }
}

// Fastify plugin to register the database setup route
export default async function dbSetupRoute(server: FastifyInstance) {
  server.post(
    '/db/setup',
    { schema: dbSetupRouteSchema },
    async (request, reply) => setupDbHandler(request, reply, server)
  );
}
