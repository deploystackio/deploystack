import { eq, or, and } from 'drizzle-orm';
import { satellites } from '../db/schema';
import type { AnyDatabase } from '../db';
import type { FastifyBaseLogger } from 'fastify';

export interface SatelliteValidationResult {
  valid: boolean;
  satelliteId?: string;
  error?: string;
  errorCode?: string;
  httpStatus?: number; // 400, 403, etc.
}

export interface ValidateSatelliteOptions {
  satelliteId?: string;
  teamId: string;
  autoSelect?: boolean; // If true and no satelliteId, auto-select one
}

export class SatelliteValidationService {
  constructor(
    private db: AnyDatabase,
    private logger: FastifyBaseLogger
  ) {}

  /**
   * Validates satellite access and returns validated satellite_id
   *
   * Rules:
   * 1. If satellite_id provided: validate it exists, is active, and team has access
   * 2. If no satellite_id and autoSelect=true: auto-select first available satellite
   * 3. Global satellites: accessible by all teams
   * 4. Team satellites: only accessible by owning team
   */
  async validateSatellite(options: ValidateSatelliteOptions): Promise<SatelliteValidationResult> {
    const { satelliteId, teamId, autoSelect = true } = options;

    // If satellite_id provided, validate it
    if (satelliteId) {
      this.logger.debug({
        satelliteId,
        teamId
      }, 'Validating satellite access');

      // Query satellite
      const satelliteCheck = await this.db
        .select({
          id: satellites.id,
          satellite_type: satellites.satellite_type,
          team_id: satellites.team_id,
          status: satellites.status
        })
        .from(satellites)
        .where(eq(satellites.id, satelliteId))
        .limit(1);

      // Check 1: Satellite exists
      if (satelliteCheck.length === 0) {
        return {
          valid: false,
          error: 'Invalid satellite_id: Satellite not found',
          errorCode: 'SATELLITE_NOT_FOUND',
          httpStatus: 400
        };
      }

      const satellite = satelliteCheck[0];

      // Check 2: Satellite is active
      if (satellite.status !== 'active') {
        return {
          valid: false,
          error: `Cannot use satellite: Satellite is currently ${satellite.status}`,
          errorCode: 'SATELLITE_NOT_ACTIVE',
          httpStatus: 400
        };
      }

      // Check 3: Team has permission
      if (satellite.satellite_type === 'team' && satellite.team_id !== teamId) {
        return {
          valid: false,
          error: 'Forbidden: Cannot use another team\'s satellite',
          errorCode: 'SATELLITE_FORBIDDEN',
          httpStatus: 403
        };
      }

      // Valid!
      this.logger.info({
        satelliteId,
        satelliteType: satellite.satellite_type,
        satelliteTeamId: satellite.team_id,
        status: satellite.status,
        teamId
      }, 'Satellite access validated');

      return {
        valid: true,
        satelliteId
      };
    }

    // No satellite_id provided - auto-select if enabled
    if (autoSelect) {
      this.logger.debug({
        teamId
      }, 'Auto-selecting satellite for team');

      const teamSatellites = await this.db
        .select({
          id: satellites.id
        })
        .from(satellites)
        .where(
          and(
            or(
              eq(satellites.satellite_type, 'global'),
              eq(satellites.team_id, teamId)
            ),
            eq(satellites.status, 'active')
          )
        )
        .limit(1);

      if (teamSatellites.length > 0) {
        const selectedSatelliteId = teamSatellites[0].id;

        this.logger.info({
          satelliteId: selectedSatelliteId,
          teamId
        }, 'Auto-selected satellite');

        return {
          valid: true,
          satelliteId: selectedSatelliteId
        };
      }

      // No satellites available
      return {
        valid: false,
        error: 'No active satellites available for this team',
        errorCode: 'NO_SATELLITES_AVAILABLE',
        httpStatus: 400
      };
    }

    // No satellite_id and autoSelect disabled
    return {
      valid: true,
      satelliteId: undefined // Will be handled by caller
    };
  }
}
