import { FastifyInstance } from 'fastify'
import fastifyFavicon from 'fastify-favicon'
import fastifyCors from '@fastify/cors'

export const registerFastifyPlugins = async (server: FastifyInstance): Promise<void> => {
  // Register CORS plugin
  await server.register(fastifyCors, {
    origin: [
      'http://localhost:5173', // Vite dev server
      'http://localhost:3000', // Frontend production (if served from same port)
      'http://localhost:4173', // Vite preview
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  })
  
  // Register favicon plugin
  await server.register(fastifyFavicon, {
    path: '../shared/public/img',
    name: 'favicon.ico',
    maxAge: 604800
  })
  
  // Register other plugins as needed
}
