import { ConfigEncryption } from './configEncryption';
import type { FastifyBaseLogger } from 'fastify';

/**
 * Utility for storing and retrieving MCP environment variables in standardized JSON object format
 * with selective encryption based on schema types.
 */
export class McpEnvStorage {
  /**
   * Store team-level environment variables with selective encryption
   */
  static async storeTeamEnv(
    env: Record<string, string>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schema: any[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    logger: FastifyBaseLogger
  ): Promise<string> {
    // Apply selective encryption based on schema
    const encryptedEnv = ConfigEncryption.encryptConfigValues(
      env,
      schema
    );

    return JSON.stringify(encryptedEnv);
  }

  /**
   * Store user-level environment variables with selective encryption
   */
  static async storeUserEnv(
    env: Record<string, string>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schema: any[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    logger: FastifyBaseLogger
  ): Promise<string> {
    // Apply selective encryption based on schema
    const encryptedEnv = ConfigEncryption.encryptConfigValues(
      env,
      schema
    );

    return JSON.stringify(encryptedEnv);
  }

  /**
   * Retrieve team-level environment variables with selective decryption
   */
  static async retrieveTeamEnv(
    encryptedEnvJson: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schema: any[],
    options: { maskSecrets?: boolean; decryptSecrets?: boolean } = {},
    logger: FastifyBaseLogger
  ): Promise<Record<string, string>> {
    try {
      const envObject = JSON.parse(encryptedEnvJson);
      
      // Apply selective decryption based on schema
      const decryptedEnv = ConfigEncryption.decryptConfigValues(
        envObject,
        schema,
        options.maskSecrets || false
      );

      return decryptedEnv;
    } catch (error) {
      logger.error({
        operation: 'retrieve_team_env',
        error
      }, 'Failed to retrieve team environment variables');
      return {};
    }
  }

  /**
   * Retrieve user-level environment variables with selective decryption
   */
  static async retrieveUserEnv(
    encryptedEnvJson: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schema: any[],
    options: { maskSecrets?: boolean; decryptSecrets?: boolean } = {},
    logger: FastifyBaseLogger
  ): Promise<Record<string, string>> {
    try {
      const envObject = JSON.parse(encryptedEnvJson);
      
      // Apply selective decryption based on schema
      const decryptedEnv = ConfigEncryption.decryptConfigValues(
        envObject,
        schema,
        options.maskSecrets || false
      );

      return decryptedEnv;
    } catch (error) {
      logger.error({
        operation: 'retrieve_user_env',
        error
      }, 'Failed to retrieve user environment variables');
      return {};
    }
  }
}
