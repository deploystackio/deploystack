import fastify from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { loggerConfig } from './fastify/config/logger';
import { registerRoutes } from './routes';
import { SessionManager } from './core/session-manager';
import { SSEHandler } from './core/sse-handler';
import { StreamableHTTPHandler } from './core/streamable-http-handler';
import { BackendClient } from './services/backend-client';
import { HeartbeatService } from './services/heartbeat-service';
import { HttpProxyManager } from './services/http-proxy-manager';
import { RemoteToolDiscoveryManager } from './services/remote-tool-discovery-manager';
import { StdioToolDiscoveryManager } from './services/stdio-tool-discovery-manager';
import { UnifiedToolDiscoveryManager } from './services/unified-tool-discovery-manager';
import { ProcessManager } from './process/manager';
import { RuntimeState } from './process/runtime-state';
import { McpProtocolHandler } from './services/mcp-protocol-handler';
import { CommandPollingService, ConfigurationUpdate } from './services/command-polling-service';
import { DynamicConfigManager } from './services/dynamic-config-manager';
import { CommandProcessor } from './services/command-processor';
import { TokenIntrospectionService } from './services/token-introspection-service';
import { TeamAwareMcpHandler } from './services/team-aware-mcp-handler';

/**
 * Validate registration token format and availability
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function validateRegistrationToken(token: string | undefined, logger?: any): void {
  if (!token) {
    const errorMsg = 'DEPLOYSTACK_REGISTRATION_TOKEN is required. Please set the DEPLOYSTACK_REGISTRATION_TOKEN environment variable. You can generate a registration token in the DeployStack Backend Admin Interface.';
    if (logger) {
      logger.fatal({ operation: 'registration_token_missing' }, errorMsg);
    }
    process.exit(1);
  }

  // Check if token is just the placeholder value
  if (token === 'your_registration_token_here') {
    const errorMsg = 'DEPLOYSTACK_REGISTRATION_TOKEN contains placeholder value. Please replace "your_registration_token_here" with a real registration token from the DeployStack Backend Admin Interface.';
    if (logger) {
      logger.fatal({ operation: 'registration_token_placeholder', token }, errorMsg);
    }
    process.exit(1);
  }

  // Check token format - should start with deploystack_satellite_global_ or deploystack_satellite_team_
  const globalPrefix = 'deploystack_satellite_global_';
  const teamPrefix = 'deploystack_satellite_team_';
  
  if (!token.startsWith(globalPrefix) && !token.startsWith(teamPrefix)) {
    const errorMsg = `Invalid registration token format: "${token.substring(0, 20)}...". Registration token must start with "${globalPrefix}" or "${teamPrefix}". Please generate a new token in the DeployStack Backend Admin Interface.`;
    if (logger) {
      logger.fatal({ operation: 'registration_token_invalid_format', token_prefix: token.substring(0, 20) }, errorMsg);
    }
    process.exit(1);
  }

  // Check that token has content after the prefix (JWT part)
  const tokenWithoutPrefix = token.startsWith(globalPrefix) 
    ? token.substring(globalPrefix.length)
    : token.substring(teamPrefix.length);
    
  if (tokenWithoutPrefix.length < 10) {
    const errorMsg = `Registration token is incomplete: Token appears to be cut off after the prefix. Please copy the complete token from the DeployStack Backend Admin Interface.`;
    if (logger) {
      logger.fatal({ operation: 'registration_token_incomplete', token_length: token.length }, errorMsg);
    }
    process.exit(1);
  }

  if (logger) {
    const tokenType = token.startsWith(globalPrefix) ? 'global' : 'team';
    logger.info({ operation: 'registration_token_validated', tokenType }, `Registration token validated: ${tokenType} satellite token`);
  }
}

/**
 * Validate satellite name according to strict rules
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function validateSatelliteName(name: string | undefined, logger?: any): void {
  if (!name) {
    const errorMsg = 'DEPLOYSTACK_SATELLITE_NAME is required. Please set the DEPLOYSTACK_SATELLITE_NAME environment variable. Example: DEPLOYSTACK_SATELLITE_NAME=dev-satellite-001';
    if (logger) {
      logger.fatal({ operation: 'satellite_name_missing' }, errorMsg);
    }
    process.exit(1);
  }

  // Check length constraints
  if (name.length < 10) {
    const errorMsg = `Satellite name too short: "${name}" (${name.length} characters). Minimum: 10 characters required`;
    if (logger) {
      logger.fatal({ operation: 'satellite_name_too_short', name, length: name.length }, errorMsg);
    }
    process.exit(1);
  }

  if (name.length > 32) {
    const errorMsg = `Satellite name too long: "${name}" (${name.length} characters). Maximum: 32 characters allowed`;
    if (logger) {
      logger.fatal({ operation: 'satellite_name_too_long', name, length: name.length }, errorMsg);
    }
    process.exit(1);
  }

  // Check character constraints
  const validPattern = /^[a-z0-9_-]+$/;
  if (!validPattern.test(name)) {
    const errorMsg = `Invalid satellite name: "${name}". Allowed: Only lowercase letters (a-z), numbers (0-9), hyphens (-), and underscores (_). No spaces or uppercase letters allowed. Examples: dev-satellite-001, production_worker_main`;
    if (logger) {
      logger.fatal({ operation: 'satellite_name_invalid_chars', name }, errorMsg);
    }
    process.exit(1);
  }

  if (logger) {
    logger.info({ operation: 'satellite_name_validated', name }, `Satellite name validated: "${name}"`);
  }
}

export async function createServer() {
  // Create a temporary logger for early validation
  const tempLogger = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    info: (obj: any, msg: string) => process.stdout.write(`INFO: ${msg}\n`),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fatal: (obj: any, msg: string) => process.stderr.write(`FATAL: ${msg}\n`)
  };
  
  // STEP 1: Validate satellite configuration BEFORE any other operations
  tempLogger.info({ operation: 'satellite_validation_start' }, 'Validating satellite configuration...');
  const satelliteName = process.env.DEPLOYSTACK_SATELLITE_NAME;
  const registrationToken = process.env.DEPLOYSTACK_REGISTRATION_TOKEN;
  
  validateSatelliteName(satelliteName, tempLogger);
  validateRegistrationToken(registrationToken, tempLogger);

  const server = fastify({
    logger: loggerConfig,
    disableRequestLogging: true,
    ajv: {
      customOptions: {
        strict: false,        // Allows unknown keywords in schemas
        strictTypes: false,   // Disables strict type checking  
        strictTuples: false   // Disables strict tuple checking
      }
    }
  });

  // Register Swagger for API documentation
  await server.register(fastifySwagger, {
    openapi: {
      openapi: '3.0.0',
      info: {
        title: 'DeployStack Satellite API',
        description: 'API documentation for DeployStack Satellite Service with Team-Aware OAuth Authentication',
        version: '0.1.0'
      },
      servers: [
        {
          url: `http://localhost:${process.env.PORT || 3001}`,
          description: 'Development server'
        }
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Team-scoped OAuth 2.1 Bearer token from DeployStack Backend'
          }
        }
      }
    }
  });

  await server.register(fastifySwaggerUi, {
    routePrefix: '/documentation',
    uiConfig: {
      docExpansion: 'full',
      deepLinking: false
    },
    uiHooks: {
      onRequest: function (request, reply, next) { next(); },
      preHandler: function (request, reply, next) { next(); }
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
    transformSpecification: (swaggerObject) => { return swaggerObject; },
    transformSpecificationClone: true
  });

  // Initialize MCP Transport handlers
  const sessionManager = new SessionManager(server.log);
  const sseHandler = new SSEHandler(sessionManager, server.log);
  const streamableHandler = new StreamableHTTPHandler(server.log);

  // Initialize Backend Client
  const backendUrl = process.env.DEPLOYSTACK_BACKEND_URL || 'http://localhost:3000';
  const backendClient = new BackendClient(backendUrl, server.log);

  // Initialize Dynamic Configuration Manager
  const dynamicConfigManager = new DynamicConfigManager(server.log);

  // Initialize HTTP Proxy Manager with dynamic config
  const httpProxyManager = new HttpProxyManager(server, server.log);
  httpProxyManager.setConfigManager(dynamicConfigManager);

  // Initialize Process Manager and Runtime State for stdio subprocess servers
  const runtimeState = new RuntimeState();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const processManager = new ProcessManager(server.log as any); // Fastify logger is compatible with pino Logger

  // Initialize Remote Tool Discovery Manager for HTTP/SSE remote servers
  const remoteToolDiscoveryManager = new RemoteToolDiscoveryManager(server.log);
  remoteToolDiscoveryManager.setConfigManager(dynamicConfigManager);

  // Initialize Stdio Tool Discovery Manager for stdio subprocess servers
  const stdioToolDiscoveryManager = new StdioToolDiscoveryManager(
    processManager,
    runtimeState,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    server.log as any // Fastify logger is compatible with pino Logger
  );

  // Initialize Unified Tool Discovery Manager to coordinate both transport types
  const toolDiscoveryManager = new UnifiedToolDiscoveryManager(
    remoteToolDiscoveryManager,
    stdioToolDiscoveryManager,
    processManager,
    runtimeState,
    server.log
  );
  toolDiscoveryManager.setConfigManager(dynamicConfigManager);

  // Set up configuration change handler for tool discovery
  dynamicConfigManager.setConfigurationChangeHandler(async (config, changes) => {
    // Notify HTTP proxy manager of configuration changes
    await httpProxyManager.handleConfigurationUpdate(config);

    // Notify tool discovery manager of configuration changes with changes parameter
    await toolDiscoveryManager.handleConfigurationUpdate(config, changes);
  });

  // Initialize MCP Protocol Handler (after HTTP Proxy Manager and Tool Discovery Manager)
  const mcpProtocolHandler = new McpProtocolHandler(httpProxyManager, toolDiscoveryManager, server.log);

  // Initialize Command Processor
  const commandProcessor = new CommandProcessor(server.log, dynamicConfigManager);

  // Initialize Command Polling Service (will be started after registration)
  let commandPollingService: CommandPollingService | undefined;

  // Store handlers on server instance for access by routes
  server.decorate('sessionManager', sessionManager);
  server.decorate('sseHandler', sseHandler);
  server.decorate('streamableHandler', streamableHandler);
  server.decorate('backendClient', backendClient);
  server.decorate('httpProxyManager', httpProxyManager);
  server.decorate('toolDiscoveryManager', toolDiscoveryManager);
  server.decorate('mcpProtocolHandler', mcpProtocolHandler);
  server.decorate('dynamicConfigManager', dynamicConfigManager);
  server.decorate('commandProcessor', commandProcessor);
  server.decorate('processManager', processManager);
  server.decorate('runtimeState', runtimeState);

  server.log.info({
    operation: 'handlers_initialized',
    backend_url: backendUrl
  }, 'MCP Transport handlers, Backend Client, and HTTP Proxy Manager initialized');

  // Test backend connection on startup - REQUIRED for satellite operation
  server.log.info({
    operation: 'backend_connection_required',
    backend_url: backendUrl
  }, 'Connecting to backend - required for satellite operation...');

  try {
    const connectionStatus = await backendClient.testConnection();
    
    if (connectionStatus.connection_status === 'connected') {
      server.log.info({
        operation: 'backend_connection_success',
        backend_url: backendUrl,
        response_time_ms: connectionStatus.response_time_ms
      }, `Backend connection successful (${connectionStatus.response_time_ms}ms)`);
    } else {
      // Backend connection failed - satellite cannot operate
      server.log.fatal({
        operation: 'backend_connection_fatal',
        backend_url: backendUrl,
        connection_status: connectionStatus.connection_status,
        error_message: connectionStatus.error_message,
        response_time_ms: connectionStatus.response_time_ms
      }, `Cannot reach backend at ${backendUrl} - Satellite cannot operate without backend connection. Error: ${connectionStatus.error_message}. Please ensure the backend is running and accessible.`);
      
      process.exit(1);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    server.log.fatal({
      operation: 'backend_connection_exception',
      backend_url: backendUrl,
      error: errorMessage
    }, `Failed to connect to backend: ${errorMessage}. Satellite requires backend connection to operate. Please ensure the backend is running and accessible.`);
    
    process.exit(1);
  }

  // Check for existing API key before attempting registration
  server.log.info({
    operation: 'satellite_auth_start'
  }, 'Checking for existing satellite credentials...');
  
  let satelliteId: string | undefined;
  let apiKey: string | undefined;
  let skipRegistration = false;
  
  // Try to load persisted credentials
  const persistedData = await backendClient.loadPersistedData();
  
  if (persistedData && persistedData.api_key && persistedData.satellite_id) {
    server.log.info({
      operation: 'persistent_credentials_found',
      satellite_id: persistedData.satellite_id,
      satellite_name: persistedData.satellite_name,
      registered_at: persistedData.registered_at
    }, 'Found existing satellite credentials - verifying with backend...');
    
    // Verify existing credentials with a test heartbeat
    backendClient.setApiKey(persistedData.api_key);
    satelliteId = persistedData.satellite_id;
    apiKey = persistedData.api_key;
    
    try {
      // Test the credentials with a simple heartbeat
      const testHeartbeat = {
        status: 'active' as const,
        system_metrics: {
          cpu_usage_percent: 0,
          memory_usage_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
          disk_usage_percent: 0,
          uptime_seconds: Math.round(process.uptime())
        },
        processes: [],
        error_count: 0,
        version: '1.0.0'
      };
      
      const heartbeatResult = await backendClient.sendHeartbeat(satelliteId, testHeartbeat);
      
      if (heartbeatResult.success) {
        server.log.info({
          operation: 'credentials_verified',
          satellite_id: satelliteId,
          response_time_ms: heartbeatResult.response_time_ms
        }, 'Existing credentials verified successfully - skipping registration');
        
        // Update last verified timestamp
        await backendClient.updateLastVerified();
        skipRegistration = true;
        
      } else {
        server.log.warn({
          operation: 'credentials_verification_failed',
          satellite_id: satelliteId,
          error: heartbeatResult.error
        }, 'Existing credentials failed verification - will attempt re-registration');
        
        // Clear invalid credentials
        await backendClient.clearPersistedData();
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      server.log.warn({
        operation: 'credentials_verification_error',
        satellite_id: satelliteId,
        error: errorMessage
      }, 'Failed to verify existing credentials - will attempt re-registration');
      
      // Clear potentially corrupted credentials
      await backendClient.clearPersistedData();
    }
  } else {
    server.log.info({
      operation: 'no_persistent_credentials'
    }, 'No existing satellite credentials found - proceeding with registration');
  }
  
  // Perform registration if needed
  if (!skipRegistration) {
    server.log.info({
      operation: 'satellite_registration_start'
    }, 'Registering satellite with backend...');

  try {
    // Get satellite configuration from environment
    const satelliteName = process.env.DEPLOYSTACK_SATELLITE_NAME;

    // Generate registration data (satellite type and team ID are determined by backend)
    const registrationData = backendClient.generateRegistrationData(satelliteName);
    
    // Register with backend using registration token
    const registrationResult = await backendClient.registerSatellite(registrationData, registrationToken!);
    
    if (registrationResult.success && registrationResult.satellite) {
      satelliteId = registrationResult.satellite.id;
      apiKey = registrationResult.satellite.api_key;
      
      server.log.info({
        operation: 'satellite_registration_success',
        satellite_id: satelliteId,
        satellite_name: registrationResult.satellite.name
      }, `Satellite registered successfully: ${registrationResult.satellite.name} (${satelliteId})`);
      
      server.log.info({
        operation: 'satellite_api_key_received',
        satellite_id: satelliteId
      }, 'API key received and ready for authenticated communication');

      // Set API key for authenticated backend communication
      backendClient.setApiKey(apiKey);
      
      // Save credentials to persistent storage
      try {
        const persistData = {
          api_key: apiKey,
          satellite_id: satelliteId,
          satellite_name: registrationResult.satellite.name,
          registered_at: new Date().toISOString(),
          last_verified: new Date().toISOString()
        };
        await backendClient.savePersistedData(persistData);
        
        server.log.info({
          operation: 'credentials_persisted',
          satellite_id: satelliteId
        }, 'Satellite credentials saved to persistent storage');
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        server.log.error({
          operation: 'credentials_persistence_failed',
          satellite_id: satelliteId,
          error: errorMessage
        }, 'Failed to save credentials to persistent storage - satellite will work but require re-registration on restart');
      }

      // Initialize Token Introspection Service for OAuth authentication
      const tokenIntrospectionService = new TokenIntrospectionService(backendClient, server.log);
      
      // Initialize Team-Aware MCP Handler for team-filtered tool access
      const teamAwareMcpHandler = new TeamAwareMcpHandler(
        mcpProtocolHandler,
        dynamicConfigManager,
        toolDiscoveryManager,
        server.log
      );

      // Store OAuth services on server instance for access by routes
      server.decorate('tokenIntrospectionService', tokenIntrospectionService);
      server.decorate('teamAwareMcpHandler', teamAwareMcpHandler);

      server.log.info({
        operation: 'oauth_services_initialized',
        satellite_id: satelliteId
      }, 'OAuth authentication and team-aware MCP services initialized');
    } else {
      server.log.error({
        operation: 'satellite_registration_failed',
        error: registrationResult.error
      }, `Satellite registration failed: ${registrationResult.error}. Satellite cannot operate without registration.`);
      process.exit(1);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    server.log.error({
      operation: 'satellite_registration_exception',
      error: errorMessage
    }, `Satellite registration failed with exception: ${errorMessage}. Satellite cannot operate without registration.`);
    process.exit(1);
  }
  } // End of !skipRegistration block
  
  // Ensure we have valid credentials before proceeding
  if (!satelliteId || !apiKey) {
    server.log.fatal({
      operation: 'satellite_credentials_missing'
    }, 'Satellite credentials missing after authentication process - cannot proceed');
    process.exit(1);
  }
  
  // Continue with common initialization (both registered and existing satellites)
  server.log.info({
    operation: 'satellite_initialization_continue',
    satellite_id: satelliteId
  }, 'Proceeding with satellite service initialization...');
  
  // Initialize OAuth services if not already done (for existing satellites)
  if (skipRegistration) {
    // Initialize Token Introspection Service for OAuth authentication
    const tokenIntrospectionService = new TokenIntrospectionService(backendClient, server.log);
    
    // Initialize Team-Aware MCP Handler for team-filtered tool access
    const teamAwareMcpHandler = new TeamAwareMcpHandler(
      mcpProtocolHandler,
      dynamicConfigManager,
      toolDiscoveryManager,
      server.log
    );

    // Store OAuth services on server instance for access by routes
    server.decorate('tokenIntrospectionService', tokenIntrospectionService);
    server.decorate('teamAwareMcpHandler', teamAwareMcpHandler);

    server.log.info({
      operation: 'oauth_services_initialized',
      satellite_id: satelliteId
    }, 'OAuth authentication and team-aware MCP services initialized');
  }
  
  // Start heartbeat service
  const heartbeatService = new HeartbeatService(
    satelliteId,
    apiKey,
    backendClient,
    server.log
  );

      // Set command processor for process reporting
      heartbeatService.setCommandProcessor(commandProcessor);

      // Store heartbeat service on server instance for potential future access
      server.decorate('heartbeatService', heartbeatService);

      // Start the heartbeat service
      heartbeatService.start();

      server.log.info({
        operation: 'heartbeat_service_started',
        satellite_id: satelliteId,
        interval_seconds: 30
      }, 'Heartbeat service started (30s interval)');

      // Fetch initial configuration from backend
      server.log.info({
        operation: 'initial_config_fetch_start',
        satellite_id: satelliteId
      }, 'Fetching initial configuration from backend...');

      try {
        const configResponse = await fetch(`${backendClient.getBackendUrl()}/api/satellites/${satelliteId}/config`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${backendClient.getApiKey()}`,
            'Content-Type': 'application/json'
          },
          signal: AbortSignal.timeout(10000)
        });

        if (configResponse.ok) {
          const initialConfig = await configResponse.json() as ConfigurationUpdate;
          
          server.log.info({
            operation: 'initial_config_fetched',
            satellite_id: satelliteId,
            mcp_servers_count: Object.keys(initialConfig.mcp_servers || {}).length
          }, `Initial configuration fetched: ${Object.keys(initialConfig.mcp_servers || {}).length} MCP servers`);

          // Update dynamic configuration manager with initial config
          await dynamicConfigManager.updateConfiguration(initialConfig);

          server.log.info({
            operation: 'initial_config_applied',
            satellite_id: satelliteId
          }, 'Initial configuration applied successfully - satellite ready');

        } else {
          server.log.warn({
            operation: 'initial_config_fetch_failed',
            satellite_id: satelliteId,
            status: configResponse.status,
            statusText: configResponse.statusText
          }, `Failed to fetch initial config: HTTP ${configResponse.status}. Satellite will start without initial config.`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        server.log.warn({
          operation: 'initial_config_fetch_exception',
          satellite_id: satelliteId,
          error: errorMessage
        }, `Initial config fetch failed: ${errorMessage}. Satellite will start without initial config.`);
      }

      // Initialize Command Polling Service after initial config fetch
      commandPollingService = new CommandPollingService(
        satelliteId,
        backendClient,
        server.log
      );

      // Set up configuration update handler
      commandPollingService.setConfigurationUpdateHandler(async (config) => {
        server.log.info({
          operation: 'config_update_received',
          satellite_id: satelliteId,
          mcp_servers_count: Object.keys(config.mcp_servers || {}).length
        }, 'Configuration update received from backend');

        try {
          // Update dynamic configuration manager
          await dynamicConfigManager.updateConfiguration(config);

          server.log.info({
            operation: 'config_update_applied',
            satellite_id: satelliteId
          }, 'Configuration update applied successfully');

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          server.log.error({
            operation: 'config_update_failed',
            satellite_id: satelliteId,
            error: errorMessage
          }, `Failed to apply configuration update: ${errorMessage}`);
        }
      });

      // Set up command handler
      commandPollingService.setCommandHandler(async (command) => {
        server.log.info({
          operation: 'command_received',
          satellite_id: satelliteId,
          command_id: command.id,
          command_type: command.command_type
        }, `Processing command from backend: ${command.command_type}`);

        return await commandProcessor.processCommand(command);
      });

      // Set up command processor configuration handler to trigger config refresh
      commandProcessor.setConfigurationUpdateHandler(async (_config) => {
        server.log.info({
          operation: 'command_triggered_config_update',
          satellite_id: satelliteId
        }, 'Configure command triggered - fetching fresh config from backend');

        try {
          // Fetch fresh configuration from backend
          const response = await fetch(`${backendClient.getBackendUrl()}/api/satellites/${satelliteId}/config`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${backendClient.getApiKey()}`,
              'Content-Type': 'application/json'
            },
            signal: AbortSignal.timeout(10000)
          });

          if (response.ok) {
            const freshConfig = await response.json() as ConfigurationUpdate;
            
            server.log.info({
              operation: 'fresh_config_fetched',
              satellite_id: satelliteId,
              mcp_servers_count: Object.keys(freshConfig.mcp_servers || {}).length
            }, 'Fresh configuration fetched from backend');

            // Update dynamic configuration manager
            await dynamicConfigManager.updateConfiguration(freshConfig);

            server.log.info({
              operation: 'command_config_update_applied',
              satellite_id: satelliteId
            }, 'Configure command completed - configuration updated successfully');
          } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          server.log.error({
            operation: 'command_config_update_failed',
            satellite_id: satelliteId,
            error: errorMessage
          }, `Configure command failed to fetch config: ${errorMessage}`);
          throw error; // Re-throw to be handled by command processor
        }
      });

      // Store command polling service on server instance
      server.decorate('commandPollingService', commandPollingService);

      // Start command polling service
      commandPollingService.start();

      server.log.info({
        operation: 'command_polling_service_started',
        satellite_id: satelliteId
      }, 'Command polling service started');

  // Note: HTTP Proxy Manager and Tool Discovery Manager have been initialized
  // with initial configuration and will be updated via command polling
  server.log.info({
    operation: 'dynamic_config_ready'
  }, 'Dynamic configuration system ready - initial config loaded, command polling active');

  // Register all routes
  registerRoutes(server);

  return server;
}

export async function startServer() {
  const server = await createServer();
  
  const PORT = parseInt(process.env.PORT || '3001', 10);
  const HOST = process.env.HOST || '0.0.0.0';

  try {
    await server.listen({ port: PORT, host: HOST });
    server.log.info(`DeployStack Satellite running on http://${HOST}:${PORT}`);
    server.log.info(`API Documentation: http://${HOST}:${PORT}/documentation`);
    server.log.info(`Hello World: http://${HOST}:${PORT}/api/health/hello`);
    server.log.info(`Backend Status: http://${HOST}:${PORT}/api/status/backend`);
    server.log.info(`Proxy Status: http://${HOST}:${PORT}/api/status/proxy`);
    server.log.info(`SSE Transport: http://${HOST}:${PORT}/sse`);
    server.log.info(`Message Transport: http://${HOST}:${PORT}/message`);
    server.log.info(`MCP Transport: http://${HOST}:${PORT}/mcp`);
  } catch (err) {
    server.log.error({
      error: err,
      operation: 'server_startup'
    }, 'Failed to start server');
    process.exit(1);
  }

  return server;
}
