import { access, constants } from 'fs/promises';
import { Logger } from 'pino';

/**
 * Validate GitHub deployment base directory permissions
 * Follows fail-fast pattern - satellite cannot start without proper permissions
 *
 * This check runs only in production on Linux where:
 * - Satellite runs as 'deploystack' user (UID 1001)
 * - /opt/mcp-deployments must exist with deploystack:deploystack ownership
 * - Directory must have read/write permissions for tmpfs mount operations
 */
export async function validateDeploymentDirectory(
  baseDir: string,
  logger: Logger
): Promise<void> {
  logger.info({
    operation: 'deployment_directory_validation_start',
    path: baseDir
  }, 'Validating GitHub deployment base directory permissions...');

  try {
    // Check if directory exists
    await access(baseDir, constants.F_OK);

    logger.debug({
      operation: 'deployment_directory_exists',
      path: baseDir
    }, 'GitHub deployment base directory exists');
  } catch (error) {
    const accessError = error as NodeJS.ErrnoException;

    if (accessError.code === 'ENOENT') {
      logger.fatal({
        operation: 'deployment_directory_missing',
        path: baseDir,
        error: 'Directory does not exist',
        fix_command: `sudo mkdir -p ${baseDir} && sudo chown deploystack:deploystack ${baseDir} && sudo chmod 755 ${baseDir}`,
        help: 'Create directory with correct ownership during satellite setup'
      }, `❌ FATAL: GitHub deployment base directory does not exist: ${baseDir}`);

      throw new Error(
        `GitHub deployment base directory missing: ${baseDir}. ` +
        `Fix: sudo mkdir -p ${baseDir} && sudo chown deploystack:deploystack ${baseDir}`
      );
    } else {
      // Unexpected error accessing directory
      logger.fatal({
        operation: 'deployment_directory_access_error',
        path: baseDir,
        error: accessError.message
      }, `❌ FATAL: Cannot access GitHub deployment base directory: ${baseDir}`);

      throw new Error(`Failed to access deployment base directory: ${accessError.message}`);
    }
  }

  // Check read permission
  try {
    await access(baseDir, constants.R_OK);
    logger.debug({
      operation: 'deployment_directory_readable',
      path: baseDir
    }, 'GitHub deployment base directory is readable');
  } catch (error) {
    const readError = error as NodeJS.ErrnoException;

    logger.fatal({
      operation: 'deployment_directory_not_readable',
      path: baseDir,
      error: readError.message,
      current_user: process.env.USER || 'unknown',
      fix_command: `sudo chown -R deploystack:deploystack ${baseDir} && sudo chmod 755 ${baseDir}`,
      help: 'Directory must be readable by deploystack user (UID 1001)'
    }, `❌ FATAL: No read permission for GitHub deployment base directory: ${baseDir}`);

    throw new Error(
      `No read permission for ${baseDir}. ` +
      `Fix: sudo chown deploystack:deploystack ${baseDir} && sudo chmod 755 ${baseDir}`
    );
  }

  // Check write permission
  try {
    await access(baseDir, constants.W_OK);
    logger.debug({
      operation: 'deployment_directory_writable',
      path: baseDir
    }, 'GitHub deployment base directory is writable');
  } catch (error) {
    const writeError = error as NodeJS.ErrnoException;

    logger.fatal({
      operation: 'deployment_directory_not_writable',
      path: baseDir,
      error: writeError.message,
      current_user: process.env.USER || 'unknown',
      fix_command: `sudo chown -R deploystack:deploystack ${baseDir} && sudo chmod 755 ${baseDir}`,
      help: 'Directory must be writable by deploystack user (UID 1001) to create tmpfs mounts'
    }, `❌ FATAL: No write permission for GitHub deployment base directory: ${baseDir}`);

    throw new Error(
      `No write permission for ${baseDir}. ` +
      `Fix: sudo chown deploystack:deploystack ${baseDir} && sudo chmod 755 ${baseDir}`
    );
  }

  logger.info({
    operation: 'deployment_directory_validation_success',
    path: baseDir
  }, `✅ GitHub deployment base directory validated: ${baseDir}`);
}
