import type { AnyDatabase } from '../db';
import type { FastifyBaseLogger } from 'fastify';
import type { Worker, WorkerResult } from './types';
import { satellites } from '../db/schema';
import { sql } from 'drizzle-orm';

interface CleanupPayload {
	globalSatelliteLimit: number;
	teamSatelliteLimit: number;
}

interface SatelliteCleanupResult {
	satelliteId: string;
	satelliteType: 'global' | 'team';
	recordsBefore: number;
	recordsDeleted: number;
	recordsAfter: number;
}

/**
 * Worker to clean up old satellite heartbeat records
 *
 * Keeps only the most recent N heartbeats per satellite.
 * Global and team satellites have different retention limits.
 * This was moved out of the heartbeat route to prevent blocking
 * the main event loop with expensive window function queries.
 */
export class CleanupSatelliteHeartbeatsWorker implements Worker {
	constructor(
		private readonly db: AnyDatabase,
		private readonly logger: FastifyBaseLogger
	) {}

	async execute(payload: unknown, jobId: string): Promise<WorkerResult> {
		if (!this.isValidPayload(payload)) {
			return {
				success: false,
				message: 'Invalid payload format',
			};
		}

		const { globalSatelliteLimit, teamSatelliteLimit } = payload as CleanupPayload;

		this.logger.info(
			{
				jobId,
				globalSatelliteLimit,
				teamSatelliteLimit,
				operation: 'cleanup_satellite_heartbeats',
			},
			'Starting cleanup of old satellite heartbeats'
		);

		try {
			// Get all satellites with their type
			const allSatellites = await this.db
				.select({
					id: satellites.id,
					satellite_type: satellites.satellite_type,
				})
				.from(satellites);

			let totalDeleted = 0;
			const satelliteResults: SatelliteCleanupResult[] = [];

			// Process each satellite
			for (const satellite of allSatellites) {
				try {
					const limit =
						satellite.satellite_type === 'global' ? globalSatelliteLimit : teamSatelliteLimit;

					// Count records before cleanup
					const countResult = await this.db.execute(sql`
						SELECT COUNT(*) as count FROM "satelliteHeartbeats"
						WHERE satellite_id = ${satellite.id}
					`);
					const recordsBefore = Number((countResult as unknown as { rows: Array<{ count: string }> }).rows?.[0]?.count ?? 0);

					// Delete excess heartbeats beyond the limit
					const deleteResult = await this.db.execute(sql`
						DELETE FROM "satelliteHeartbeats"
						WHERE id IN (
							SELECT id FROM (
								SELECT id,
									ROW_NUMBER() OVER (
										PARTITION BY satellite_id
										ORDER BY timestamp DESC
									) as row_num
								FROM "satelliteHeartbeats"
								WHERE satellite_id = ${satellite.id}
							) as subquery
							WHERE row_num > ${limit}
						)
					`);

					const recordsDeleted = (deleteResult as { rowCount?: number }).rowCount || 0;
					totalDeleted += recordsDeleted;

					satelliteResults.push({
						satelliteId: satellite.id,
						satelliteType: satellite.satellite_type as 'global' | 'team',
						recordsBefore,
						recordsDeleted,
						recordsAfter: recordsBefore - recordsDeleted,
					});

					if (recordsDeleted > 0) {
						this.logger.debug(
							{
								jobId,
								satelliteId: satellite.id,
								satelliteType: satellite.satellite_type,
								recordsBefore,
								recordsDeleted,
								limit,
								operation: 'cleanup_satellite_heartbeats',
							},
							`Cleaned up heartbeats for satellite ${satellite.id}`
						);
					}
				} catch (satelliteError) {
					this.logger.warn(
						{
							jobId,
							satelliteId: satellite.id,
							error: satelliteError instanceof Error ? satelliteError.message : String(satelliteError),
							operation: 'cleanup_satellite_heartbeats',
						},
						`Failed to cleanup heartbeats for satellite ${satellite.id}, continuing with others`
					);
				}
			}

			this.logger.info(
				{
					jobId,
					totalDeleted,
					satellitesProcessed: satelliteResults.length,
					operation: 'cleanup_satellite_heartbeats',
				},
				'Satellite heartbeat cleanup completed'
			);

			return {
				success: true,
				message: `Deleted ${totalDeleted} old heartbeats from ${satelliteResults.length} satellites`,
				data: {
					globalSatelliteLimit,
					teamSatelliteLimit,
					totalDeleted,
					satellites: satelliteResults,
				},
			};
		} catch (error) {
			this.logger.error(
				{
					jobId,
					error: error instanceof Error ? error.message : String(error),
					operation: 'cleanup_satellite_heartbeats',
				},
				'Satellite heartbeat cleanup failed'
			);

			throw error;
		}
	}

	private isValidPayload(payload: unknown): payload is CleanupPayload {
		if (typeof payload !== 'object' || payload === null) return false;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const p = payload as any;
		return (
			typeof p.globalSatelliteLimit === 'number' &&
			p.globalSatelliteLimit > 0 &&
			typeof p.teamSatelliteLimit === 'number' &&
			p.teamSatelliteLimit > 0
		);
	}
}
