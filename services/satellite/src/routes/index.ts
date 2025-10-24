import { type FastifyInstance } from 'fastify';

// Import route handlers
import oauthDiscoveryRoutes from './oauth-discovery';
import { registerBackendStatusRoutes } from './status/backend';
import { registerDebugRoutes } from './status/debug';
import { registerSatelliteStatusRoutes } from './root';

export const registerRoutes = (server: FastifyInstance): void => {
  // Register root level routes
  server.register(async (rootInstance) => {
    // OAuth Discovery endpoints - /.well-known/*
    await rootInstance.register(oauthDiscoveryRoutes);
    
    // Satellite service status - GET /
    await registerSatelliteStatusRoutes(rootInstance);
  });

  // Register Status routes
  server.register(async (statusInstance) => {
    // Backend connection status - GET /api/status/backend
    await registerBackendStatusRoutes(statusInstance);
    
    // Debug information - GET /api/status/debug
    await registerDebugRoutes(statusInstance);
  });
};
