import { FastifyInstance } from 'fastify'

export const registerRoutes = (server: FastifyInstance): void => {
  // Define a route
  server.get('/', async () => {
    return { hello: `world ${process.env.FOO} 18` }
  })
}
