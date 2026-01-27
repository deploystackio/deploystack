/* eslint-disable @typescript-eslint/no-explicit-any */
import fastify from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { loggerConfig } from './fastify/config/logger';
import { registerRoutes } from './routes';
import { McpServerWrapper } from './core/mcp-server-wrapper';
import { BackendClient } from './services/backend-client';
import { HeartbeatService } from './services/heartbeat-service';
import { HttpProxyManager } from './services/http-proxy-manager';
import { RemoteToolDiscoveryManager } from './services/remote-tool-discovery-manager';
import { StdioToolDiscoveryManager } from './services/stdio-tool-discovery-manager';
import { UnifiedToolDiscoveryManager } from './services/unified-tool-discovery-manager';
import { ProcessManager, RuntimeState } from './process';
import { CommandPollingService, ConfigurationUpdate } from './services/command-polling-service';
import { DynamicConfigManager } from './services/dynamic-config-manager';
import { CommandProcessor } from './services/command-processor';
import { TokenIntrospectionService } from './services/token-introspection-service';
import { JobManager, HeartbeatJob, McpActivityReportJob, IdleProcessCleanupJob } from './jobs';
import { EventBus } from './services/event-bus';
import { McpActivityTracker } from './services/mcp-activity-tracker';
import { ToolSearchService } from './services/tool-search-service';
import { OAuthTokenService } from './services/oauth-token-service';
import { SsePingService } from './services/sse-ping-service';
import { validateSystemRuntimes } from './utils/runtime-validator';

/**
 * Validate registration token format and availability
 */

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
  // Add global error handlers to catch unhandled errors
  // Note: These run before Fastify logger is initialized, so we write to stderr directly
  process.on('unhandledRejection', (reason, promise) => {
    const errorMessage = reason instanceof Error ? reason.message : String(reason);
    process.stderr.write(`FATAL: Unhandled Rejection at: ${String(promise)} reason: ${errorMessage}\n`);
    process.exit(1);
  });
  
  process.on('uncaughtException', (error) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : '';
    process.stderr.write(`FATAL: Uncaught Exception: ${errorMessage}\n${errorStack || ''}\n`);
    process.exit(1);
  });
  
  // Create a temporary logger for early validation
  const tempLogger = {
    
    info: (obj: any, msg: string) => process.stdout.write(`INFO: ${msg}\n`),
    
    fatal: (obj: any, msg: string) => process.stderr.write(`FATAL: ${msg}\n`)
  };
  
  // STEP 1: Validate satellite configuration BEFORE any other operations
  tempLogger.info({ operation: 'satellite_validation_start' }, 'Validating satellite configuration...');
  const satelliteName = process.env.DEPLOYSTACK_SATELLITE_NAME;
  const registrationToken = process.env.DEPLOYSTACK_REGISTRATION_TOKEN;
  
  validateSatelliteName(satelliteName, tempLogger);
  validateRegistrationToken(registrationToken, tempLogger);

  // STEP 1.5: Validate system runtimes (Node.js, Python)
  tempLogger.info({ operation: 'runtime_validation_start' }, 'Validating system runtimes...');
  const skipRuntimeChecks = process.env.DEPLOYSTACK_SKIP_RUNTIME_CHECKS === 'true';

  if (skipRuntimeChecks) {
    tempLogger.info({ operation: 'runtime_validation_skipped' }, 'Runtime validation skipped (DEPLOYSTACK_SKIP_RUNTIME_CHECKS=true)');
  } else {
    validateSystemRuntimes(tempLogger);
    tempLogger.info({ operation: 'runtime_validation_complete' }, 'System runtime validation passed');
  }

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

  // Initialize Backend Client (needed by EventBus)
  const backendUrl = process.env.DEPLOYSTACK_BACKEND_URL || 'http://localhost:3000';
  const backendClient = new BackendClient(backendUrl, server.log);

  // Ensure persistent data directory exists before attempting any operations
  try {
    await backendClient.ensureDirectoryExists();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    server.log.fatal({
      operation: 'persistent_directory_initialization_failed',
      error: errorMessage
    }, 'Failed to initialize persistent storage directory - cannot continue');
    process.exit(1);
  }

  // Initialize MCP Activity Tracker for personal dashboard feature
  const activityTracker = new McpActivityTracker(server.log);
  server.decorate('activityTracker', activityTracker);
  
  server.log.info({
    operation: 'activity_tracker_initialized'
  }, 'MCP Activity Tracker initialized for personal dashboard');
  
  // Note: EventBus will be initialized later after satelliteId is available
  // We'll pass it to services after registration
  
  // Initialize Dynamic Configuration Manager (EventBus will be added after registration)
  const dynamicConfigManager = new DynamicConfigManager(server.log);

  // Initialize HTTP Proxy Manager with dynamic config
  const httpProxyManager = new HttpProxyManager(server, server.log);
  httpProxyManager.setConfigManager(dynamicConfigManager);

  // Initialize Process Manager and Runtime State for stdio subprocess servers (EventBus will be added after registration)
  const runtimeState = new RuntimeState();

  const processManager = new ProcessManager(server.log as any, undefined, runtimeState, backendClient); // Fastify logger is compatible with pino Logger
  
  // Set up RuntimeState to listen for restart limit exceeded events
  runtimeState.listenToProcessManager(processManager);

  // Initialize Remote Tool Discovery Manager for HTTP/SSE remote servers (EventBus will be added after registration)
  // NOTE: Do NOT call initialize() here - it will be called automatically after initial config is fetched
  // The RemoteToolDiscoveryManager has smart fallback: handleConfigurationUpdate() will trigger
  // full initialization if not yet initialized (see line 423-429 in remote-tool-discovery-manager.ts)
  const remoteToolDiscoveryManager = new RemoteToolDiscoveryManager(server.log);
  remoteToolDiscoveryManager.setConfigManager(dynamicConfigManager);

  // Initialize Stdio Tool Discovery Manager for stdio subprocess servers
  const stdioToolDiscoveryManager = new StdioToolDiscoveryManager(
    processManager,
    runtimeState,
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

  // Wire up backend status tracking callbacks (for debug endpoint visibility)
  const backendStatusCallback = (installationId: string, status: string, statusMessage?: string) => {
    toolDiscoveryManager.setBackendStatus(installationId, status as any, statusMessage);
  };

  remoteToolDiscoveryManager.setBackendStatusCallback(backendStatusCallback);
  stdioToolDiscoveryManager.setBackendStatusCallback(backendStatusCallback);

  server.log.info({
    operation: 'backend_status_tracking_configured'
  }, 'Backend status tracking callbacks configured for debug endpoint');

  // Initialize Tool Search Service for hierarchical router (discover_mcp_tools meta-tool)
  const toolSearchService = new ToolSearchService(toolDiscoveryManager, server.log);
  toolSearchService.setConfigManager(dynamicConfigManager);

  server.log.info({
    operation: 'tool_search_service_initialized'
  }, 'Tool Search Service initialized for hierarchical MCP router (disabled tool filtering enabled)');

  // Initialize MCP Server Wrapper with official SDK (replaces custom transport handlers)
  const mcpServerWrapper = new McpServerWrapper(server.log);
  mcpServerWrapper.setDependencies(toolDiscoveryManager, processManager, toolSearchService, dynamicConfigManager);

  // Initialize SSE ping service for keep-alive (prevents proxy timeout on SSE connections)
  const ssePingService = new SsePingService(server.log);
  ssePingService.start();
  mcpServerWrapper.setSsePingService(ssePingService);
  server.decorate('ssePingService', ssePingService);

  // Set up configuration change handler for tool discovery
  dynamicConfigManager.setConfigurationChangeHandler(async (config, changes) => {
    // CLEANUP: Handle removed servers - terminate processes and clear tools
    if (changes && changes.removedServers.length > 0) {
      for (const serverName of changes.removedServers) {
        try {
          server.log.info({
            operation: 'cleanup_removed_server',
            server_name: serverName
          }, `Cleaning up removed server: ${serverName}`);

          // Remove server completely (handles both active and dormant)
          const removed = await processManager.removeServerCompletely(serverName);

          // Clear tools from cache
          stdioToolDiscoveryManager.clearServerTools(serverName);

          server.log.info({
            operation: 'cleanup_removed_server_success',
            server_name: serverName,
            removed_active: removed.active,
            removed_dormant: removed.dormant
          }, `Server cleanup complete: ${serverName} (active: ${removed.active}, dormant: ${removed.dormant})`);

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          server.log.error({
            operation: 'cleanup_removed_server_failed',
            server_name: serverName,
            error: errorMessage
          }, `Failed to cleanup removed server: ${errorMessage}`);
        }
      }
    }

    // Notify HTTP proxy manager of configuration changes
    await httpProxyManager.handleConfigurationUpdate(config);

    // Notify tool discovery manager of configuration changes with changes parameter
    await toolDiscoveryManager.handleConfigurationUpdate(config, changes);

    // Handle modified stdio servers - restart with new configuration
    if (changes && changes.modifiedServers.length > 0) {
      for (const serverName of changes.modifiedServers) {
        const serverConfig = config.servers[serverName];
        const transportType = serverConfig.transport_type || serverConfig.type;

        if (transportType === 'stdio') {
          try {
            server.log.info({
              operation: 'restart_modified_stdio_server',
              server_name: serverName,
              transport_type: transportType
            }, `Restarting modified stdio server with new configuration: ${serverName}`);

            // Check if process is running
            const existing = runtimeState.getProcessByName(serverName);
            if (existing) {
              server.log.info({
                operation: 'terminate_for_restart',
                server_name: serverName,
                pid: existing.process?.pid
              }, `Terminating existing process for restart: ${serverName}`);

              // Remove the existing process completely
              await processManager.removeServerCompletely(serverName);

              // Clear old tools from cache
              stdioToolDiscoveryManager.clearServerTools(serverName);
            }

            // Build MCP server config for process spawning with new configuration
            const processConfig = {
              installation_id: serverConfig.installation_id || serverName,
              instance_id: serverConfig.instance_id,
              installation_name: serverName,
              team_id: serverConfig.team_id || 'unknown',
              team_slug: serverConfig.team_slug || 'unknown',
              server_slug: serverConfig.server_slug || serverName,
              user_id: serverConfig.user_id,
              command: serverConfig.command!,
              args: serverConfig.args!,
              env: serverConfig.env || {},
              source: serverConfig.source,  // GitHub deployment detection
              language: serverConfig.language,
              runtime: serverConfig.runtime
            };

            // Spawn the process with updated configuration
            const processInfo = await processManager.spawnProcess(processConfig);

            // Add to runtime state
            runtimeState.addProcess(
              processInfo,
              processConfig.installation_id,
              processConfig.installation_name,
              processConfig.team_id
            );

            server.log.info({
              operation: 'restart_modified_stdio_success',
              server_name: serverName,
              pid: processInfo.process.pid,
              new_args: serverConfig.args
            }, `Modified stdio server restarted successfully with new configuration: ${serverName}`);

          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            server.log.error({
              operation: 'restart_modified_stdio_failed',
              server_name: serverName,
              error: errorMessage
            }, `Failed to restart modified stdio server: ${errorMessage}`);
          }
        }
      }
    }

    // Auto-spawn stdio processes when servers are added
    if (changes && changes.addedServers.length > 0) {
      for (const serverName of changes.addedServers) {
        const serverConfig = config.servers[serverName];
        const transportType = serverConfig.transport_type || serverConfig.type;

        if (transportType === 'stdio') {
          try {
            server.log.info({
              operation: 'auto_spawn_stdio_server',
              server_name: serverName,
              transport_type: transportType
            }, `Auto-spawning stdio server: ${serverName}`);

            // Check if already running
            const existing = runtimeState.getProcessByName(serverName);
            if (existing && existing.status === 'running') {
              server.log.warn({
                operation: 'auto_spawn_already_running',
                server_name: serverName
              }, `stdio server already running, skipping spawn: ${serverName}`);
              continue;
            }

            // Build MCP server config for process spawning
            const processConfig = {
              installation_id: serverConfig.installation_id || serverName,
              instance_id: serverConfig.instance_id,
              installation_name: serverName,
              team_id: serverConfig.team_id || 'unknown',
              team_slug: serverConfig.team_slug || 'unknown',
              server_slug: serverConfig.server_slug || serverName,
              user_id: serverConfig.user_id,
              command: serverConfig.command!,
              args: serverConfig.args!,
              env: serverConfig.env || {},
              source: serverConfig.source,  // GitHub deployment detection
              language: serverConfig.language,
              runtime: serverConfig.runtime
            };

            // Spawn the process
            const processInfo = await processManager.spawnProcess(processConfig);
            
            // Add to runtime state
            runtimeState.addProcess(
              processInfo,
              processConfig.installation_id,
              processConfig.installation_name,
              processConfig.team_id
            );

            server.log.info({
              operation: 'auto_spawn_stdio_success',
              server_name: serverName,
              pid: processInfo.process.pid
            }, `stdio server spawned successfully: ${serverName}`);

          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            server.log.error({
              operation: 'auto_spawn_stdio_failed',
              server_name: serverName,
              error: errorMessage
            }, `Failed to auto-spawn stdio server: ${errorMessage}`);
          }
        }
      }
    }
  });

  // Set up automatic tool discovery when stdio processes are spawned
  processManager.on('processSpawned', async (processInfo) => {
    try {
      server.log.info({
        operation: 'trigger_stdio_tool_discovery',
        installation_name: processInfo.config.installation_name,
        team_id: processInfo.config.team_id
      }, `Process spawned successfully - triggering tool discovery for ${processInfo.config.installation_name}`);
      
      // FIXED: Add delay after handshake to allow MCP server to fully initialize
      // Some servers (especially npm-based ones) need time to register all tools
      server.log.debug({
        operation: 'tool_discovery_delay',
        installation_name: processInfo.config.installation_name,
        delay_ms: 500
      }, `Waiting 500ms before tool discovery to ensure server is fully initialized`);
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await toolDiscoveryManager.discoverStdioTools(processInfo.config.installation_name);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      server.log.error({
        operation: 'stdio_tool_discovery_error',
        installation_name: processInfo.config.installation_name,
        error: errorMessage
      }, `Failed to discover stdio tools after process spawn: ${errorMessage}`);
    }
  });

  server.log.info({
    operation: 'stdio_tool_discovery_handler_registered'
  }, 'Automatic stdio tool discovery handler registered for process spawn events');


  // Initialize Command Processor with stdio process management dependencies
  const commandProcessor = new CommandProcessor(
    server.log,
    dynamicConfigManager,
    processManager,
    runtimeState,
    stdioToolDiscoveryManager
  );

  // Set UnifiedToolDiscoveryManager for disabled tools tracking
  commandProcessor.setUnifiedToolDiscoveryManager(toolDiscoveryManager);

  // Set RemoteToolDiscoveryManager for mcp_recovery command handling
  commandProcessor.setRemoteToolDiscoveryManager(remoteToolDiscoveryManager);

  // Wire up backend status tracking callbacks for CommandProcessor and ProcessManager
  commandProcessor.setBackendStatusCallback(backendStatusCallback);
  processManager.setBackendStatusCallback(backendStatusCallback);

  server.log.info({
    operation: 'command_processor_initialized',
    stdio_support: true,
    disabled_tools_support: true
  }, 'Command Processor initialized with stdio process management and disabled tools support');

  // Initialize Command Polling Service (will be started after registration)
  let commandPollingService: CommandPollingService | undefined;

  // Store handlers on server instance for access by routes  
  server.decorate('backendClient', backendClient);
  server.decorate('httpProxyManager', httpProxyManager);
  server.decorate('toolDiscoveryManager', toolDiscoveryManager);
  server.decorate('mcpServerWrapper', mcpServerWrapper);
  server.decorate('dynamicConfigManager', dynamicConfigManager);
  server.decorate('commandProcessor', commandProcessor);
  server.decorate('processManager', processManager);
  server.decorate('runtimeState', runtimeState);

  server.log.info({
    operation: 'handlers_initialized',
    backend_url: backendUrl,
    mcp_sdk_integration: true
  }, 'MCP SDK Server Wrapper, Backend Client, and HTTP Proxy Manager initialized');

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

        // Skip registration when credentials are valid
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

      // OAuth: Initialize OAuth Token Service for HTTP/SSE MCP servers
      const oauthTokenService = new OAuthTokenService(server.log as any, backendClient, satelliteId);
      mcpServerWrapper.setOAuthTokenService(oauthTokenService);
      remoteToolDiscoveryManager.setOAuthTokenService(oauthTokenService);

      // Store OAuth services on server instance for access by routes
      server.decorate('tokenIntrospectionService', tokenIntrospectionService);
      server.decorate('oauthTokenService', oauthTokenService);

      // Configure command processor with token services for cache invalidation
      commandProcessor.setTokenIntrospectionService(tokenIntrospectionService);
      commandProcessor.setOAuthTokenService(oauthTokenService);

      server.log.info({
        operation: 'oauth_services_initialized',
        satellite_id: satelliteId,
        activity_tracking_enabled: true
      }, 'OAuth authentication, team-aware MCP services, and activity tracking initialized');
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
  
  // If satellite was already registered (skipRegistration), EventBus initialization happens here
  if (skipRegistration && satelliteId && apiKey) {
    // Initialize Event Bus for existing satellites
    const eventBus = new EventBus(
      satelliteId,
      backendClient,
      server.log,
      {
        batchIntervalMs: parseInt(process.env.EVENT_BATCH_INTERVAL_MS || '3000', 10),
        maxBatchSize: parseInt(process.env.EVENT_MAX_BATCH_SIZE || '100', 10),
        maxQueueSize: parseInt(process.env.EVENT_MAX_QUEUE_SIZE || '10000', 10),
        flushTimeoutMs: parseInt(process.env.EVENT_FLUSH_TIMEOUT_MS || '5000', 10)
      }
    );

    // Store event bus on server instance
    server.decorate('eventBus', eventBus);

    // Start event bus
    eventBus.start();

    server.log.info({
      operation: 'event_bus_initialized_existing',
      satellite_id: satelliteId
    }, 'Event bus initialized for existing satellite');
    
    // Update services with EventBus
    (processManager as any).eventBus = eventBus;
    (dynamicConfigManager as any).eventBus = eventBus;
    (remoteToolDiscoveryManager as any).eventBus = eventBus;
    (stdioToolDiscoveryManager as any).eventBus = eventBus;
    mcpServerWrapper.setEventBus(eventBus);

    server.log.info({
      operation: 'event_bus_services_configured_existing',
      satellite_id: satelliteId
    }, 'All services configured with EventBus');
  }
  
  // Initialize OAuth services if not already done (for existing satellites)
  if (skipRegistration && satelliteId) {
    // Initialize Token Introspection Service for OAuth authentication
    const tokenIntrospectionService = new TokenIntrospectionService(backendClient, server.log);

    // OAuth: Initialize OAuth Token Service for HTTP/SSE MCP servers
    const oauthTokenService = new OAuthTokenService(server.log as any, backendClient, satelliteId);
    mcpServerWrapper.setOAuthTokenService(oauthTokenService);
    remoteToolDiscoveryManager.setOAuthTokenService(oauthTokenService);

    // Store OAuth services on server instance for access by routes
    server.decorate('tokenIntrospectionService', tokenIntrospectionService);
    server.decorate('oauthTokenService', oauthTokenService);

    // Configure command processor with token services for cache invalidation
    commandProcessor.setTokenIntrospectionService(tokenIntrospectionService);
    commandProcessor.setOAuthTokenService(oauthTokenService);

    server.log.info({
      operation: 'oauth_services_initialized',
      satellite_id: satelliteId,
      activity_tracking_enabled: true
    }, 'OAuth authentication, team-aware MCP services, and activity tracking initialized');
  }
  
  // Initialize heartbeat service
  const heartbeatService = new HeartbeatService(
    satelliteId,
    apiKey,
    backendClient,
    server.log
  );

      // Set command processor for process reporting
      heartbeatService.setCommandProcessor(commandProcessor);

      // Initialize HeartbeatDataBuilder for normalized heartbeat data
      
      const teamIsolationService = (server as any).teamIsolationService;
      const heartbeatDataBuilder = new (await import('./services/heartbeat-data-builder')).HeartbeatDataBuilder(
        processManager,
        runtimeState,
        toolDiscoveryManager,
        dynamicConfigManager,
        teamIsolationService,
        
        server.log as any
      );

      // Set heartbeat data builder for normalized data
      heartbeatService.setHeartbeatDataBuilder(heartbeatDataBuilder);

      server.log.info({
        operation: 'heartbeat_data_builder_initialized',
        satellite_id: satelliteId
      }, 'Heartbeat data builder initialized for normalized heartbeat data');

      // Store heartbeat service on server instance for potential future access
      server.decorate('heartbeatService', heartbeatService);

      // Initialize job manager and register jobs
      const jobManager = new JobManager(server.log);
      
      jobManager.register(new HeartbeatJob(heartbeatService));
      jobManager.register(new IdleProcessCleanupJob(processManager, runtimeState, server.log));
      
      // Store job manager on server instance
      server.decorate('jobManager', jobManager);
      
      // Note: McpActivityReportJob will be registered after EventBus initialization
      
      // Start all registered jobs
      await jobManager.startAll();

      server.log.info({
        operation: 'job_system_initialized',
        satellite_id: satelliteId,
        registered_jobs: jobManager.getRegisteredJobs(),
        job_count: jobManager.getRegisteredJobs().length
      }, `Job system initialized with ${jobManager.getRegisteredJobs().length} jobs`);

      // Initialize Event Bus for real-time event emission (ONLY if not already initialized)
      if (!skipRegistration) {
        const eventBus = new EventBus(
          satelliteId,
          backendClient,
          server.log,
          {
            batchIntervalMs: parseInt(process.env.EVENT_BATCH_INTERVAL_MS || '3000', 10),
            maxBatchSize: parseInt(process.env.EVENT_MAX_BATCH_SIZE || '100', 10),
            maxQueueSize: parseInt(process.env.EVENT_MAX_QUEUE_SIZE || '10000', 10),
            flushTimeoutMs: parseInt(process.env.EVENT_FLUSH_TIMEOUT_MS || '5000', 10)
          }
        );

        // Store event bus on server instance
        server.decorate('eventBus', eventBus);

        // Start event bus
        eventBus.start();

        server.log.info({
          operation: 'event_bus_initialized',
          satellite_id: satelliteId,
          batch_interval_ms: parseInt(process.env.EVENT_BATCH_INTERVAL_MS || '3000', 10),
          max_batch_size: parseInt(process.env.EVENT_MAX_BATCH_SIZE || '100', 10),
          max_queue_size: parseInt(process.env.EVENT_MAX_QUEUE_SIZE || '10000', 10)
        }, 'Event bus initialized and started');
      } // End of !skipRegistration block
      
      // Get EventBus from server instance (initialized in either block above)
      const eventBus = (server as any).eventBus as EventBus;
      
      if (!eventBus) {
        server.log.fatal({ operation: 'event_bus_missing' }, 'EventBus not found on server instance!');
        throw new Error('EventBus not found on server instance');
      }
      
      server.log.info({ operation: 'about_to_configure_services' }, 'About to configure services with EventBus...');
      
      // Now that EventBus is initialized, update services to use it
      // Update ProcessManager with EventBus (propagates to LogBuffer, RestartHandler, DormantManager)
      processManager.setEventBus(eventBus);
      server.log.debug({ operation: 'process_manager_event_bus_set' }, 'ProcessManager and composed handlers configured with EventBus');
      
      // Note: SessionManager removed - now using MCP SDK for session management
      
      // Update DynamicConfigManager with EventBus
      (dynamicConfigManager as any).eventBus = eventBus;
      server.log.debug({ operation: 'config_manager_event_bus_set' }, 'DynamicConfigManager configured with EventBus');

      // Update RemoteToolDiscoveryManager with EventBus
      (remoteToolDiscoveryManager as any).eventBus = eventBus;
      server.log.debug({ operation: 'tool_discovery_event_bus_set' }, 'RemoteToolDiscoveryManager configured with EventBus');

      // Update StdioToolDiscoveryManager with EventBus
      (stdioToolDiscoveryManager as any).eventBus = eventBus;
      server.log.debug({ operation: 'stdio_tool_discovery_event_bus_set' }, 'StdioToolDiscoveryManager configured with EventBus');

      // Update McpServerWrapper with EventBus for request log emission
      mcpServerWrapper.setEventBus(eventBus);
      server.log.debug({ operation: 'mcp_server_wrapper_event_bus_set' }, 'McpServerWrapper configured with EventBus');

      server.log.info({
        operation: 'event_bus_services_configured',
        satellite_id: satelliteId
      }, 'All services configured with EventBus for real-time event emission');
      
      server.log.info({ operation: 'about_to_register_activity_job' }, 'About to register MCP Activity Report Job...');
      
      // Now that EventBus is initialized, register MCP Activity Report Job
      const retrievedJobManager = (server as any).jobManager as JobManager;
      
      server.log.info({ 
        operation: 'job_manager_retrieved',
        has_job_manager: !!retrievedJobManager 
      }, 'JobManager retrieved from server instance');
      
      if (!retrievedJobManager) {
        server.log.fatal({ operation: 'job_manager_missing' }, 'JobManager not found on server instance!');
        throw new Error('JobManager not found on server instance');
      }
      
      retrievedJobManager.register(new McpActivityReportJob(
        server.log,
        eventBus,
        activityTracker
      ));
      
      server.log.info({ operation: 'activity_job_registered' }, 'MCP Activity Report Job registered');
      
      // Start the newly registered job
      retrievedJobManager.start('mcp-activity-report');
      
      server.log.info({
        operation: 'mcp_activity_report_job_registered',
        satellite_id: satelliteId
      }, 'MCP Activity Report Job registered and started');

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
            satellite_id: satelliteId,
            searchable_tools: toolSearchService.getStats().total_tools,
            tools_by_transport: toolSearchService.getStats().tools_by_transport
          }, `Initial configuration applied successfully - ${toolSearchService.getStats().total_tools} tools available for search`);

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

  // Setup MCP Server Wrapper routes (replaces custom MCP transport routes)
  mcpServerWrapper.setupRoutes(server);

  server.log.info({
    operation: 'mcp_sdk_routes_setup',
    satellite_id: satelliteId
  }, 'MCP SDK routes setup - official MCP transport now active');

  // Register all other routes
  registerRoutes(server);

  // Set up graceful shutdown handlers
  const gracefulShutdown = async (signal: string) => {
    server.log.info({
      operation: 'graceful_shutdown_start',
      signal
    }, `Received ${signal} - starting graceful shutdown`);

    try {
      // Stop job manager
      
      const jobManager = (server as any).jobManager as JobManager;
      if (jobManager) {
        server.log.info({ operation: 'shutdown_jobs' }, 'Stopping job manager...');
        await jobManager.stopAll();
      }

      // Stop event bus and flush events
      
      const eventBus = (server as any).eventBus as EventBus | undefined;
      if (eventBus) {
        server.log.info({ operation: 'shutdown_events' }, 'Stopping event bus and flushing events...');
        await eventBus.stop();
      }

      // Stop SSE ping service
      const ssePingService = (server as any).ssePingService as SsePingService | undefined;
      if (ssePingService) {
        server.log.info({ operation: 'shutdown_sse_ping' }, 'Stopping SSE ping service...');
        ssePingService.stop();
      }

      // Stop command polling service
      const commandPollingService = (server as any).commandPollingService as CommandPollingService | undefined;
      if (commandPollingService) {
        server.log.info({ operation: 'shutdown_polling' }, 'Stopping command polling service...');
        commandPollingService.stop();
      }

      // Close server
      server.log.info({ operation: 'shutdown_server' }, 'Closing server...');
      await server.close();

      server.log.info({
        operation: 'graceful_shutdown_complete',
        signal
      }, 'Graceful shutdown completed');

      process.exit(0);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      server.log.error({
        operation: 'graceful_shutdown_error',
        error: errorMessage
      }, `Error during graceful shutdown: ${errorMessage}`);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => void gracefulShutdown('SIGINT'));

  return server;
}

export async function startServer() {
  const server = await createServer();
  
  const PORT = parseInt(process.env.PORT || '3001', 10);
  const HOST = process.env.HOST || '0.0.0.0';

  try {
    await server.listen({ port: PORT, host: HOST });
    server.log.info(`DeployStack Satellite running on http://${HOST}:${PORT}`);
    server.log.info(`Backend Status: http://${HOST}:${PORT}/api/status/backend`);
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
