import type { FastifyInstance } from 'fastify';
import listJobsRoute from './list';
import getJobRoute from './get';
import getBatchStatusRoute from './batch-status';
import getJobStatsRoute from './stats';
import searchJobsRoute from './search';
import getJobTypesRoute from './types';

export default async function jobsRoutes(server: FastifyInstance) {
  await listJobsRoute(server);
  await searchJobsRoute(server);
  await getJobRoute(server);
  await getBatchStatusRoute(server);
  await getJobStatsRoute(server);
  await getJobTypesRoute(server);
}
