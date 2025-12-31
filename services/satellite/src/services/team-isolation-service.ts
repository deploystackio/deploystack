import { Logger } from 'pino';

/**
 * Team information extracted from installation name
 */
export interface TeamInfo {
  serverSlug: string;      // e.g., "filesystem"
  teamSlug: string;        // e.g., "john"
  installationId: string;  // e.g., "R36no6FGoMFEZO9nWJJLT"
}

/**
 * TeamIsolationService
 * 
 * Handles team-based isolation and access control for MCP server processes.
 * Extracts team information from installation names and validates team access.
 */
export class TeamIsolationService {
  constructor(private logger: Logger) {}

  /**
   * Extract team information from installation name
   *
   * Format: {server_slug}-{team_slug}-{user_id}-{installation_id}
   * Note: user_id is parsed but not returned (available in config.user_id)
   * Examples:
   *   "filesystem-john-user1-R36no6FGoMFEZO9nWJJLT" → {serverSlug: "filesystem", teamSlug: "john", installationId: "R36no6FGoMFEZO9nWJJLT"}
   *   "context7-alice-user2-S47mp8GHpNGFZP0oWKKMU" → {serverSlug: "context7", teamSlug: "alice", installationId: "S47mp8GHpNGFZP0oWKKMU"}
   */
  extractTeamInfo(installationName: string): TeamInfo {
    const parts = installationName.split('-');

    if (parts.length < 4) {
      this.logger.error({
        operation: 'team_info_extraction_failed',
        installation_name: installationName,
        parts_count: parts.length
      }, `Invalid installation name format: ${installationName}`);

      throw new Error(`Invalid installation name format: ${installationName} (expected format: serverSlug-teamSlug-userId-installationId)`);
    }

    // Extract components
    const serverSlug = parts[0];
    const teamSlug = parts[1];
    // parts[2] is user_id - not extracted (use config.user_id instead)
    const installationId = parts.slice(3).join('-'); // Handle IDs with hyphens

    this.logger.debug({
      operation: 'team_info_extracted',
      installation_name: installationName,
      server_slug: serverSlug,
      team_slug: teamSlug,
      installation_id: installationId
    }, 'Extracted team information from installation name');

    return {
      serverSlug,
      teamSlug,
      installationId
    };
  }

  /**
   * Validate team access - ensures request team matches process team
   * 
   * @param requestTeamId - Team ID making the request (from OAuth token)
   * @param processTeamId - Team ID owning the process
   * @returns true if access allowed, false if blocked
   */
  validateTeamAccess(requestTeamId: string, processTeamId: string): boolean {
    if (requestTeamId !== processTeamId) {
      this.logger.warn({
        operation: 'team_access_denied',
        request_team_id: requestTeamId,
        process_team_id: processTeamId
      }, 'Team access validation failed - cross-team access attempt blocked');
      
      return false;
    }

    this.logger.debug({
      operation: 'team_access_granted',
      team_id: requestTeamId
    }, 'Team access validation successful');

    return true;
  }

  /**
   * Validate installation name format
   * 
   * @param installationName - Installation name to validate
   * @returns true if valid format, false otherwise
   */
  isValidInstallationName(installationName: string): boolean {
    try {
      this.extractTeamInfo(installationName);
      return true;
    } catch {
      return false;
    }
  }
}
