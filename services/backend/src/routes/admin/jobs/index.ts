import type { FastifyInstance } from 'fastify';
import listJobsRoute from './list';
import getJobRoute from './get';
import getBatchStatusRoute from './batch-status';
import getJobStatsRoute from './stats';

export default async function jobsRoutes(server: FastifyInstance) {
  await listJobsRoute(server);
  await getJobRoute(server);
  await getBatchStatusRoute(server);
  await getJobStatsRoute(server);
}
