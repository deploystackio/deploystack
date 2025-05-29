import { FastifyInstance } from 'fastify'
import fastifyFavicon from 'fastify-favicon'

export const registerFastifyPlugins = async (server: FastifyInstance): Promise<void> => {
  // Register favicon plugin
  await server.register(fastifyFavicon, {
    path: '../shared/public/img',
    name: 'favicon.ico',
    maxAge: 604800
  })
  
  // Register other plugins as needed
}
