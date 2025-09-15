import type { FastifyInstance } from 'fastify';
import configRoute from './config';
import clientsRoute from './clients';

export default async function satelliteRoutes(server: FastifyInstance) {
  // Register satellite config routes
  await server.register(configRoute);
  await server.register(clientsRoute);
}