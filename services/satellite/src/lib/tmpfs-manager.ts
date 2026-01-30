import { spawn } from 'child_process';
import { mkdir, rm } from 'fs/promises';
import { Logger } from 'pino';

export interface TmpfsOptions {
  size: string;  // e.g., '300M'
  mode?: string; // e.g., '0755'
}

/**
 * Create and manage tmpfs mounts for GitHub deployments
 */
export class TmpfsManager {
  constructor(private logger: Logger) {}

  /**
   * Create tmpfs mount at specified path
   */
  async createTmpfs(mountPath: string, options: TmpfsOptions): Promise<void> {
    this.logger.debug({
      operation: 'tmpfs_create_start',
      mount_path: mountPath,
      size: options.size
    }, 'Creating tmpfs mount');

    // Create mount point directory
    await mkdir(mountPath, { recursive: true, mode: options.mode || '0755' });

    // Mount tmpfs with size limit
    return new Promise((resolve, reject) => {
      const mountArgs = [
        '-t', 'tmpfs',
        '-o', `size=${options.size}${options.mode ? `,mode=${options.mode}` : ''}`,
        'tmpfs',
        mountPath
      ];

      const proc = spawn('mount', mountArgs, { stdio: 'pipe' });

      let stderr = '';
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('exit', (code) => {
        if (code === 0) {
          this.logger.info({
            operation: 'tmpfs_create_success',
            mount_path: mountPath,
            size: options.size
          }, `tmpfs created: ${mountPath} (${options.size})`);
          resolve();
        } else {
          this.logger.error({
            operation: 'tmpfs_create_failed',
            mount_path: mountPath,
            exit_code: code,
            stderr: stderr.trim()
          }, 'Failed to create tmpfs');
          reject(new Error(`Failed to create tmpfs: ${stderr.trim()}`));
        }
      });

      proc.on('error', (error) => {
        this.logger.error({
          operation: 'tmpfs_create_error',
          mount_path: mountPath,
          error: error.message
        }, 'tmpfs mount command error');
        reject(new Error(`tmpfs mount error: ${error.message}`));
      });
    });
  }

  /**
   * Unmount and remove tmpfs
   */
  async removeTmpfs(mountPath: string): Promise<void> {
    this.logger.debug({
      operation: 'tmpfs_remove_start',
      mount_path: mountPath
    }, 'Removing tmpfs mount');

    return new Promise((resolve, reject) => {
      const proc = spawn('umount', [mountPath], { stdio: 'pipe' });

      let stderr = '';
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('exit', async (code) => {
        if (code === 0) {
          // Remove mount point directory
          try {
            await rm(mountPath, { recursive: true, force: true });
            this.logger.info({
              operation: 'tmpfs_remove_success',
              mount_path: mountPath
            }, 'tmpfs removed successfully');
            resolve();
          } catch (error) {
            this.logger.warn({
              operation: 'tmpfs_rmdir_failed',
              mount_path: mountPath,
              error: error instanceof Error ? error.message : String(error)
            }, 'Failed to remove mount point directory');
            resolve(); // Don't fail if directory removal fails
          }
        } else {
          this.logger.error({
            operation: 'tmpfs_remove_failed',
            mount_path: mountPath,
            exit_code: code,
            stderr: stderr.trim()
          }, 'Failed to unmount tmpfs');
          reject(new Error(`Failed to unmount tmpfs: ${stderr.trim()}`));
        }
      });

      proc.on('error', (error) => {
        this.logger.error({
          operation: 'tmpfs_remove_error',
          mount_path: mountPath,
          error: error.message
        }, 'tmpfs unmount command error');
        reject(new Error(`tmpfs unmount error: ${error.message}`));
      });
    });
  }

  /**
   * Check if path is a tmpfs mount
   */
  async isTmpfs(mountPath: string): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn('mount', { stdio: 'pipe' });

      let stdout = '';
      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.on('exit', () => {
        // Check if mount path appears in mount output with type tmpfs
        const isMounted = stdout.split('\n').some(line =>
          line.includes(mountPath) && line.includes('type tmpfs')
        );
        resolve(isMounted);
      });

      proc.on('error', () => {
        resolve(false);
      });
    });
  }
}
