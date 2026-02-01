/**
 * Deployment directory creation utilities
 *
 * Extracted from github-deployment.ts to reduce file size and improve maintainability.
 * Handles creation of deployment directories with tmpfs (production) or regular filesystem (development).
 */

import { mkdir } from 'fs/promises';

/**
 * Optional logger interface for dependency injection
 */
interface Logger {
  trace?: (obj: unknown, msg?: string) => void;
  debug?: (obj: unknown, msg?: string) => void;
  info?: (obj: unknown, msg?: string) => void;
  warn?: (obj: unknown, msg?: string) => void;
  error?: (obj: unknown, msg?: string) => void;
  fatal?: (obj: unknown, msg?: string) => void;
}

/**
 * TmpfsManager interface for tmpfs operations
 */
interface TmpfsManager {
  createTmpfs(path: string, options: { size: string; mode: string }): Promise<void>;
  isTmpfs(path: string): Promise<boolean>;
}

/**
 * Deployment directory configuration
 */
export interface DeploymentDirConfig {
  teamId: string;
  installationId: string;
  useTmpfs: boolean;
  tmpfsSize?: string;
  baseDir?: string;
}

/**
 * Create deployment directory for GitHub deployment
 *
 * Handles two modes:
 * - Production (tmpfs): Creates tmpfs-backed directory with kernel-enforced quota
 * - Development (regular fs): Creates /tmp directory with UUID
 *
 * @param config - Deployment directory configuration
 * @param tmpfsManager - TmpfsManager instance for tmpfs creation
 * @param logger - Optional logger for debug/info/error messages
 * @returns Absolute path to created deployment directory
 * @throws Error if directory creation fails
 */
export async function createDeploymentDirectory(
  config: DeploymentDirConfig,
  tmpfsManager: TmpfsManager,
  logger?: Logger
): Promise<string> {
  let deploymentDir: string;

  if (config.useTmpfs) {
    // Production: Use tmpfs with quota
    const baseDir = config.baseDir || '/opt/mcp-deployments';
    deploymentDir = `${baseDir}/${config.teamId}/${config.installationId}`;
    const tmpfsSize = config.tmpfsSize || '300M';

    logger?.debug?.({
      operation: 'deployment_tmpfs_create_start',
      deployment_dir: deploymentDir,
      tmpfs_size: tmpfsSize
    }, `Creating tmpfs with ${tmpfsSize} quota`);

    try {
      await tmpfsManager.createTmpfs(deploymentDir, {
        size: tmpfsSize,
        mode: '0755'
      });

      logger?.info?.({
        operation: 'deployment_tmpfs_created',
        deployment_dir: deploymentDir,
        size: tmpfsSize
      }, `tmpfs created with kernel-enforced ${tmpfsSize} quota`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger?.error?.({
        operation: 'deployment_tmpfs_failed',
        deployment_dir: deploymentDir,
        error: errorMessage
      }, 'Failed to create tmpfs for deployment');

      throw new Error(`Failed to create deployment tmpfs: ${errorMessage}`);
    }
  } else {
    // Development: Use regular /tmp directory
    const { v4: uuidv4 } = await import('uuid');
    deploymentDir = `/tmp/mcp-${uuidv4()}`;

    logger?.debug?.({
      operation: 'deployment_dir_create_dev',
      deployment_dir: deploymentDir
    }, 'Creating deployment directory (development mode, no tmpfs)');

    await mkdir(deploymentDir, { recursive: true });
  }

  return deploymentDir;
}
