// globalTeardown.ts
import { FastifyInstance } from 'fastify';

export default async function globalTeardown() {
  const server = global.__TEST_SERVER__ as FastifyInstance | undefined;

  if (server) {
    await server.close();
    console.log('\nTest server stopped.');
  }
}
