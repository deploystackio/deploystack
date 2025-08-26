import { ConfigEncryption } from './configEncryption';
import type { FastifyBaseLogger } from 'fastify';

/**
 * Utility for storing and retrieving MCP arguments in standardized JSON object format
 * with selective encryption based on schema types.
 */
export class McpArgsStorage {
  /**
   * Store team-level arguments with selective encryption
   */
  static async storeTeamArgs(
    args: string[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schema: any[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    logger: FastifyBaseLogger
  ): Promise<string> {
    // Convert array to object format using schema argument names
    const argsObject: Record<string, string> = {};
    args.forEach((arg, index) => {
      if (schema[index] && schema[index].name) {
        argsObject[schema[index].name] = arg;
      } else {
        // Fallback to generic key if schema is missing
        argsObject[`arg_${index}`] = arg;
      }
    });

    // Apply selective encryption based on schema
    const encryptedArgs = ConfigEncryption.encryptConfigValues(
      argsObject,
      schema
    );

    return JSON.stringify(encryptedArgs);
  }

  /**
   * Store user-level arguments with selective encryption
   */
  static async storeUserArgs(
    args: Record<string, string>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schema: any[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    logger: FastifyBaseLogger
  ): Promise<string> {
    // Apply selective encryption based on schema
    const encryptedArgs = ConfigEncryption.encryptConfigValues(
      args,
      schema
    );

    return JSON.stringify(encryptedArgs);
  }

  /**
   * Retrieve team-level arguments with selective decryption
   */
  static async retrieveTeamArgs(
    encryptedArgsJson: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schema: any[],
    options: { maskSecrets?: boolean; decryptSecrets?: boolean } = {},
    logger: FastifyBaseLogger
  ): Promise<string[]> {
    try {
      const argsObject = JSON.parse(encryptedArgsJson);
      
      // Apply selective decryption based on schema
      const decryptedArgs = ConfigEncryption.decryptConfigValues(
        argsObject,
        schema,
        options.maskSecrets || false
      );

      // Convert back to array format for API response using schema order
      const argsArray: string[] = [];
      schema.forEach((schemaItem, index) => {
        if (schemaItem.name && decryptedArgs[schemaItem.name] !== undefined) {
          argsArray.push(decryptedArgs[schemaItem.name]);
        } else if (decryptedArgs[`arg_${index}`] !== undefined) {
          // Fallback for old format
          argsArray.push(decryptedArgs[`arg_${index}`]);
        }
      });

      return argsArray;
    } catch (error) {
      logger.error({
        operation: 'retrieve_team_args',
        error
      }, 'Failed to retrieve team arguments');
      return [];
    }
  }

  /**
   * Retrieve user-level arguments with selective decryption
   */
  static async retrieveUserArgs(
    encryptedArgsJson: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schema: any[],
    options: { maskSecrets?: boolean; decryptSecrets?: boolean } = {},
    logger: FastifyBaseLogger
  ): Promise<Record<string, string>> {
    try {
      const argsObject = JSON.parse(encryptedArgsJson);
      
      // Apply selective decryption based on schema
      const decryptedArgs = ConfigEncryption.decryptConfigValues(
        argsObject,
        schema,
        options.maskSecrets || false
      );

      return decryptedArgs;
    } catch (error) {
      logger.error({
        operation: 'retrieve_user_args',
        error
      }, 'Failed to retrieve user arguments');
      return {};
    }
  }
}
