import { FastifyInstance } from 'fastify'
import fastifyCors from '@fastify/cors'

export const registerFastifyPlugins = async (server: FastifyInstance): Promise<void> => {
  // Build allowed origins array
  const defaultOrigins = [
    'http://localhost:5173', // Vite dev server (correct dev port)
    'http://localhost:5174', // Alternative Vite dev server port
    'http://localhost:3000', // Frontend production (if served from same port)
    'http://localhost:4173', // Vite preview
  ];
  
  // Add frontend URL from environment variable
  const frontendUrl = process.env.DEPLOYSTACK_FRONTEND_URL;
  if (frontendUrl) {
    defaultOrigins.push(frontendUrl);
  }
  
  // Register CORS plugin
  await server.register(fastifyCors, {
    origin: defaultOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  })
  
  // Log the allowed origins for debugging
  server.log.info(`CORS configured with origins: ${defaultOrigins.join(', ')}`);
  
  // Favicon plugin is now registered in server.ts after Swagger to exclude it from documentation
  
  // Register other plugins as needed
}
