import { type FastifyInstance } from 'fastify';

// Import route handlers
import sseRoute from './sse';
import messageRoute from './message';
import mcpRoute from './mcp';
import oauthDiscoveryRoutes from './oauth-discovery';
import { registerBackendStatusRoutes } from './status/backend';
import { registerSatelliteStatusRoutes } from './root';

export const registerRoutes = (server: FastifyInstance): void => {
  // Register root level routes
  server.register(async (rootInstance) => {
    // OAuth Discovery endpoints - /.well-known/*
    await rootInstance.register(oauthDiscoveryRoutes);
    
    // Satellite service status - GET /
    await registerSatelliteStatusRoutes(rootInstance);
    
    // SSE Transport - GET /sse
    await rootInstance.register(sseRoute);
    
    // SSE Message Transport - POST /message
    await rootInstance.register(messageRoute);
    
    // Streamable HTTP Transport - GET/POST /mcp
    await rootInstance.register(mcpRoute);
  });

  // Register Status routes
  server.register(async (statusInstance) => {
    // Backend connection status - GET /api/status/backend
    await registerBackendStatusRoutes(statusInstance);
  });
};
