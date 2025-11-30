import type { CronJob } from '../cronManager';
import type { JobQueueService } from '../../services/jobQueueService';

/**
 * Satellite Heartbeat Cleanup Cron Job
 *
 * Runs every 3 minutes to clean up old satellite heartbeat records.
 * Different retention limits apply based on satellite type:
 * - Global satellites: 1000 records (shared infrastructure, more aggressive cleanup)
 * - Team satellites: 500 records (dedicated infrastructure, shorter retention due to fewer satellites)
 *
 * This cleanup was moved out of the heartbeat route to prevent
 * blocking the main event loop with expensive window function queries,
 * especially when using remote PostgreSQL databases like Neon.tech.
 *
 * Schedule: Every 3 minutes
 * Job Type: cleanup_satellite_heartbeats
 */
export function createCleanupSatelliteHeartbeatsJob(jobQueueService: JobQueueService): CronJob {
	return {
		name: 'cleanup-satellite-heartbeats',
		schedule: '*/3 * * * *', // Every 3 minutes

		task: async () => {
			await jobQueueService.createJob('cleanup_satellite_heartbeats', {
				globalSatelliteLimit: 1000,
				teamSatelliteLimit: 500,
			});
		},
	};
}
