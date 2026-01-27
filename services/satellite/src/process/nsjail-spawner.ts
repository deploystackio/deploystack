import { spawn, ChildProcess } from 'child_process';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { Logger } from 'pino';
import { MCPServerConfig } from './types';
import { nsjailConfig, mcpCacheBaseDir, BLOCKED_ENV_VARS } from '../config/nsjail';

/**
 * ProcessSpawner handles spawning MCP server processes
 * Routes between direct spawning (development) and nsjail isolation (production)
 */
export class ProcessSpawner {
  constructor(private logger: Logger) {}

  /**
   * Determine if nsjail should be used for process isolation
   */
  shouldUseNsjail(): boolean {
    const isProduction = process.env.NODE_ENV === 'production';
    const isLinux = process.platform === 'linux';

    // Use nsjail only in production on Linux
    const shouldUse = isProduction && isLinux;

    this.logger.debug({
      operation: 'isolation_mode_check',
      use_nsjail: shouldUse,
      node_env: process.env.NODE_ENV,
      platform: process.platform
    }, `Isolation mode: ${shouldUse ? 'nsjail' : 'direct spawn'}`);

    return shouldUse;
  }

  /**
   * Sanitize environment variables by removing dangerous entries
   * Prevents library injection (LD_PRELOAD), code injection (NODE_OPTIONS, PYTHONSTARTUP), etc.
   * @param env - User-provided environment variables
   * @param installationName - For logging blocked vars
   * @returns Array of nsjail -E arguments with safe env vars only
   */
  sanitizeEnvVars(env: Record<string, string>, installationName: string): string[] {
    const sanitized: string[] = [];
    const blocked: string[] = [];

    for (const [key, value] of Object.entries(env)) {
      // Check against blocklist (case-insensitive for safety)
      if (BLOCKED_ENV_VARS.has(key) || BLOCKED_ENV_VARS.has(key.toUpperCase())) {
        blocked.push(key);
        continue;
      }
      sanitized.push('-E', `${key}=${value}`);
    }

    // Log blocked vars for security auditing
    if (blocked.length > 0) {
      this.logger.warn({
        operation: 'env_vars_blocked',
        installation_name: installationName,
        blocked_vars: blocked,
        blocked_count: blocked.length
      }, `Blocked ${blocked.length} dangerous env var(s) for security: ${blocked.join(', ')}`);
    }

    return sanitized;
  }

  /**
   * Resolve command to full path for nsjail execution
   * nsjail has limited PATH, so we need full paths for common commands
   */
  resolveCommandPath(command: string): string {
    // Map of common commands to their full paths
    const commandPaths: Record<string, string> = {
      'npx': '/usr/bin/npx',
      'node': '/usr/bin/node',
      'python': '/usr/bin/python',
      'python3': '/usr/bin/python3'
    };

    // If command is in our map, return full path
    if (commandPaths[command]) {
      return commandPaths[command];
    }

    // If command already starts with /, assume it's a full path
    if (command.startsWith('/')) {
      return command;
    }

    // Otherwise, try /usr/bin/ as default
    return `/usr/bin/${command}`;
  }

  /**
   * Spawn a process - routes to direct or nsjail based on environment
   */
  async spawn(config: MCPServerConfig): Promise<ChildProcess> {
    const useNsjail = this.shouldUseNsjail();
    return useNsjail
      ? await this.spawnWithNsjail(config)
      : this.spawnDirect(config);
  }

  /**
   * Spawn process directly without isolation (development mode)
   */
  spawnDirect(config: MCPServerConfig): ChildProcess {
    this.logger.info({
      operation: 'spawn_direct',
      installation_name: config.installation_name,
      team_id: config.team_id
    }, 'Spawning process directly (no isolation - development mode)');

    return spawn(config.command, config.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...config.env },
      cwd: process.cwd()
    });
  }

  /**
   * Ensure team-specific cache directory exists
   */
  async ensureCacheDirectory(teamId: string): Promise<string> {
    const cacheDir = `${mcpCacheBaseDir}/mcp-cache/${teamId}`;

    if (!existsSync(cacheDir)) {
      this.logger.info({
        operation: 'create_cache_directory',
        team_id: teamId,
        cache_dir: cacheDir
      }, `Creating team cache directory: ${cacheDir}`);

      try {
        await mkdir(cacheDir, { recursive: true });

        this.logger.info({
          operation: 'cache_directory_created',
          team_id: teamId,
          cache_dir: cacheDir
        }, `Team cache directory created successfully`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error({
          operation: 'cache_directory_creation_failed',
          team_id: teamId,
          cache_dir: cacheDir,
          error: errorMessage
        }, `Failed to create team cache directory`);
        throw new Error(`Failed to create cache directory: ${errorMessage}`);
      }
    }

    return cacheDir;
  }

  /**
   * Spawn process with nsjail isolation (production mode on Linux)
   *
   * Configuration based on empirical testing with npx and Node.js:
   * - Memory: 2048MB (V8 minimum requirement)
   * - Processes: 1000 (npm spawns many child processes)
   * - File descriptors: 1024 (adequate for I/O operations)
   * - File size: 50MB (prevents oversized downloads)
   * - /dev files: Required for Node.js crypto and I/O operations
   * - --proc_rw: Required for pthread_create and thread management
   */
  async spawnWithNsjail(config: MCPServerConfig): Promise<ChildProcess> {
    // Ensure team-specific cache directory exists before mounting
    const cacheDir = await this.ensureCacheDirectory(config.team_id);

    this.logger.info({
      operation: 'spawn_nsjail',
      installation_name: config.installation_name,
      team_id: config.team_id,
      cache_dir: cacheDir,
      memory_limit_mb: nsjailConfig.memoryLimitMB,
      cpu_time_limit_seconds: nsjailConfig.cpuTimeLimitSeconds,
      max_processes: nsjailConfig.maxProcesses,
      max_open_files: nsjailConfig.maxOpenFiles,
      max_file_size_mb: nsjailConfig.maxFileSizeMB,
      tmpfs_size: nsjailConfig.tmpfsSize
    }, 'Spawning process with nsjail isolation');

    // Get current user UID and GID (deploystack user in production)
    const uid = process.getuid ? process.getuid() : 1000;
    const gid = process.getgid ? process.getgid() : 1000;

    // Resolve command to full path (nsjail requires full paths)
    const fullCommandPath = this.resolveCommandPath(config.command);

    this.logger.debug({
      operation: 'command_path_resolved',
      original_command: config.command,
      resolved_command: fullCommandPath
    }, `Resolved command path: ${config.command} -> ${fullCommandPath}`);

    // Build nsjail arguments based on working production configuration
    const nsjailArgs = [
      '-Mo',                                    // Mount mode: once, don't remount
      '--proc_rw',                              // Required for Node.js pthread_create
      '--user', String(uid),                    // Use current user (deploystack)
      '--group', String(gid),                   // Use current group (deploystack)
      '--rlimit_as', String(nsjailConfig.memoryLimitMB), // Memory limit (MB) - 2048 minimum for V8
      '--rlimit_cpu', String(nsjailConfig.cpuTimeLimitSeconds), // CPU time limit (seconds)
      '--rlimit_nproc', String(nsjailConfig.maxProcesses), // Max processes - 1000 for npm
      '--rlimit_nofile', String(nsjailConfig.maxOpenFiles), // Max file descriptors
      '--rlimit_fsize', String(nsjailConfig.maxFileSizeMB), // Max file size (MB)
      '--time_limit', '0',                      // No wall-clock time limit
      '-R', '/usr',                             // Read-only mount: /usr
      '-R', '/lib',                             // Read-only mount: /lib
      '-R', '/lib64',                           // Read-only mount: /lib64
      '-R', '/bin',                             // Read-only mount: /bin
      '-R', '/sbin',                            // Read-only mount: /sbin
      '-R', '/etc',                             // Read-only mount: /etc (includes resolv.conf)
      '-T', `/tmp:size=${nsjailConfig.tmpfsSize}`, // Writable temp with size limit (100M)
      '-B', `${cacheDir}:/home/npx`,           // Team-specific cache directory mount
      '--bindmount', '/dev/null:/dev/null',    // Required for I/O redirection
      '--bindmount', '/dev/urandom:/dev/urandom', // Required for crypto operations
      '--bindmount', '/dev/zero:/dev/zero',    // Required for memory allocation
      '--symlink', '/proc/self/fd:/dev/fd',    // Required for file descriptor management
      '-E', 'HOME=/home/npx',                  // Set HOME for npx cache
      '-E', 'PATH=/usr/bin:/bin:/usr/local/bin', // Set PATH
      '-E', 'NPM_CONFIG_CACHE=/home/npx/.npm', // npm cache location
      '-E', 'NPM_CONFIG_PREFIX=/home/npx/.npm-global', // npm global prefix
      '-E', 'NPM_CONFIG_UPDATE_NOTIFIER=false', // Disable update notifier
      '-E', 'NO_UPDATE_NOTIFIER=1',            // Disable update notifier (alternative)
      // Inject user-provided environment variables (sanitized)
      ...this.sanitizeEnvVars(config.env, config.installation_name),
      '--disable_clone_newnet',                // Allow network access (required for npm downloads)
      '--disable_clone_newcgroup',             // Disable cgroup namespace (causes clone() errors on some kernels)
      '--disable_no_new_privs',                // May be needed for some packages
      '--hostname', `mcp-${config.team_id}`,   // Team-specific hostname
      '--',                                     // End of nsjail args
      fullCommandPath,                          // MCP server command with full path (e.g., /usr/bin/npx)
      ...config.args                            // MCP server arguments
    ];

    return spawn('nsjail', nsjailArgs, {
      stdio: ['pipe', 'pipe', 'pipe']
    });
  }
}
