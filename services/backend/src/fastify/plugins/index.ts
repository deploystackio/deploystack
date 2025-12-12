import { FastifyInstance } from 'fastify'
import fastifyCors from '@fastify/cors'
import fastifyFormbody from '@fastify/formbody'
import fastifyRateLimit from '@fastify/rate-limit'
import fastifySSE from '@fastify/sse'

export const registerFastifyPlugins = async (server: FastifyInstance): Promise<void> => {
  // Build allowed origins array
  const defaultOrigins = [
    'http://localhost:5173', // Vite dev server (correct dev port)
    'http://localhost:5174', // Alternative Vite dev server port
    'http://localhost:3000', // Frontend production (if served from same port)
    'http://localhost:4173', // Vite preview
  ];
  
  const frontendUrl = process.env.DEPLOYSTACK_FRONTEND_URL?.trim();
  if (frontendUrl && !defaultOrigins.includes(frontendUrl)) {
    defaultOrigins.push(frontendUrl);
  }
  
  // Register form body parser for OAuth2 token endpoint
  await server.register(fastifyFormbody)

  // Register CORS plugin
  await server.register(fastifyCors, {
    origin: defaultOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
  })

  // Log the allowed origins for debugging
  server.log.info(`CORS configured with origins: ${defaultOrigins.join(', ')}`);

  // Register rate limiting plugin (global configuration, can be overridden per-route)
  await server.register(fastifyRateLimit, {
    global: false, // Don't apply globally by default, allow per-route configuration
    max: 1000, // Default: 1000 requests
    timeWindow: '1 minute' // Default: 1 minute window
  })
  server.log.info('Rate limiting plugin registered (per-route configuration enabled)');

  // Register SSE (Server-Sent Events) plugin
  await server.register(fastifySSE, {
    heartbeatInterval: 30000 // Send heartbeat every 30 seconds to keep connections alive
  })
  server.log.info('SSE plugin registered (heartbeat interval: 30s)');

  // Favicon plugin is now registered in server.ts after Swagger to exclude it from documentation

  // Register other plugins as needed
}
