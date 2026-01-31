import { spawn, ChildProcess } from 'child_process';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';
import { Logger } from 'pino';
import { MCPServerConfig } from './types';
import { nsjailConfig, mcpCacheBaseDir, BLOCKED_ENV_VARS } from '../config/nsjail';
import {
  validateCommand,
  validateArgs,
  COMMAND_PATHS
} from '../config/security-validation';

/**
 * Allowed build commands (npm, uv, pip)
 * These are the only commands that can be used during the build phase
 */
const ALLOWED_BUILD_COMMANDS = new Set(['npm', 'uv', 'pip', 'pip3']);

/**
 * Build command path mappings for nsjail
 */
const BUILD_COMMAND_PATHS: Record<string, string> = {
  'npm': '/usr/bin/npm',
  'uv': '/usr/bin/uv',
  'pip': '/usr/bin/pip',
  'pip3': '/usr/bin/pip3'
};

/**
 * Options for sandboxed build commands
 */
export interface BuildCommandOptions {
  /** Allow network access (required for npm install, blocked for npm run build) */
  allowNetwork: boolean;
  /** Timeout in milliseconds */
  timeoutMs: number;
  /** Runtime type for environment configuration */
  runtime: 'node' | 'python';
}

/**
 * Result of a sandboxed build command
 */
export interface BuildCommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

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
   * SECURE: Only allows commands from the allowlist, rejects absolute paths
   * nsjail requires full paths for command execution
   */
  resolveCommandPath(command: string): string {
    // Validate command first (defense in depth - backend should have validated)
    const validation = validateCommand(command, this.logger);
    if (!validation.valid) {
      this.logger.error({
        operation: 'resolve_command_path_blocked',
        command,
        error: validation.error
      }, `SECURITY: Rejected command '${command}': ${validation.error}`);
      throw new Error(validation.error || `Command '${command}' not allowed`);
    }

    // Get path from secure mappings (only known-safe commands)
    const normalizedCommand = command.trim().toLowerCase();
    const path = COMMAND_PATHS[normalizedCommand];

    if (!path) {
      // This shouldn't happen if ALLOWED_COMMANDS and COMMAND_PATHS are in sync
      this.logger.error({
        operation: 'resolve_command_path_no_mapping',
        command,
        normalizedCommand
      }, `No path mapping found for allowed command '${command}'`);
      throw new Error(`No path mapping for command '${command}'`);
    }

    this.logger.debug({
      operation: 'command_path_resolved',
      original_command: command,
      resolved_command: path
    }, `Resolved command path: ${command} -> ${path}`);

    return path;
  }

  /**
   * Get runtime-specific environment variables for nsjail isolation
   * Different runtimes need different cache directories and package manager settings
   */
  private getEnvironmentForRuntime(config: MCPServerConfig): string[] {
    const runtime = config.runtime || 'node'; // Default to node for backward compatibility
    const envVars: string[] = [];

    switch (runtime) {
      case 'node':
        envVars.push(
          '-E', 'HOME=/home/node',
          '-E', 'PATH=/usr/bin:/bin:/usr/local/bin',
          '-E', 'NPM_CONFIG_CACHE=/home/node/.npm',
          '-E', 'NPM_CONFIG_PREFIX=/home/node/.npm-global',
          '-E', 'NPM_CONFIG_UPDATE_NOTIFIER=false',
          '-E', 'NO_UPDATE_NOTIFIER=1'
        );
        break;

      case 'python':
        envVars.push(
          '-E', 'HOME=/home/python',
          '-E', 'PATH=/usr/bin:/bin:/usr/local/bin',
          '-E', 'UV_CACHE_DIR=/home/python/.cache/uv',
          '-E', 'UV_TOOL_DIR=/home/python/.local/bin',
          '-E', 'PYTHONUNBUFFERED=1',
          '-E', 'UV_NO_UPDATE_NOTIFIER=1'
        );
        break;

      default:
        // Generic runtime - minimal environment
        envVars.push(
          '-E', `HOME=/home/${runtime}`,
          '-E', 'PATH=/usr/bin:/bin:/usr/local/bin'
        );
        break;
    }

    return envVars;
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

    // For GitHub deployments, use temp_dir as working directory
    // This allows relative paths (like 'dist/index.js') to resolve correctly
    const workingDir = config.temp_dir || process.cwd();

    return spawn(config.command, config.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...config.env },
      cwd: workingDir
    });
  }

  /**
   * Ensure team-specific cache directory exists for the runtime
   */
  async ensureCacheDirectory(teamId: string, runtime: string): Promise<string> {
    const cacheDir = `${mcpCacheBaseDir}/mcp-cache/${runtime}/${teamId}`;

    if (!existsSync(cacheDir)) {
      this.logger.info({
        operation: 'create_cache_directory',
        team_id: teamId,
        runtime: runtime,
        cache_dir: cacheDir
      }, `Creating team cache directory for ${runtime} runtime: ${cacheDir}`);

      try {
        await mkdir(cacheDir, { recursive: true });

        this.logger.info({
          operation: 'cache_directory_created',
          team_id: teamId,
          runtime: runtime,
          cache_dir: cacheDir
        }, `Team cache directory created successfully`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error({
          operation: 'cache_directory_creation_failed',
          team_id: teamId,
          runtime: runtime,
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
   * Configuration supports multiple runtimes (Node.js, Python, etc.):
   * - Memory: 2048MB virtual (RLIMIT_AS), 512MB physical (cgroup)
   * - Processes: 1000 (package managers spawn many child processes)
   * - File descriptors: 1024 (adequate for I/O operations)
   * - File size: 50MB (prevents oversized downloads)
   * - /dev files: Required for crypto and I/O operations
   * - --proc_rw: Required for pthread_create and thread management
   * - Cgroup limits: Precise control over physical memory and CPU usage
   */
  async spawnWithNsjail(config: MCPServerConfig): Promise<ChildProcess> {
    // SECURITY: Validate command and arguments (defense in depth)
    // Backend should have validated, but satellite is the last line of defense
    const argsValidation = validateArgs(config.args, this.logger);
    if (!argsValidation.valid) {
      this.logger.error({
        operation: 'spawn_nsjail_args_blocked',
        installation_name: config.installation_name,
        team_id: config.team_id,
        error: argsValidation.error,
        blockedItems: argsValidation.blockedItems
      }, `SECURITY: Blocked spawn due to dangerous arguments`);
      throw new Error(`Security validation failed: ${argsValidation.error}`);
    }

    // Determine runtime (default to 'node' for backward compatibility)
    const runtime = config.runtime || 'node';

    // Ensure team-specific cache directory exists before mounting
    const cacheDir = await this.ensureCacheDirectory(config.team_id, runtime);

    // Log cgroup status (disabled due to permissions)
    const cgroupVersion = existsSync('/sys/fs/cgroup/cgroup.controllers') ? 'v2' : 'v1';
    this.logger.info({
      operation: 'cgroup_status',
      version: cgroupVersion,
      enabled: false,
      reason: 'permissions',
      team_id: config.team_id
    }, `Cgroup ${cgroupVersion} detected but disabled (using rlimit only)`);

    this.logger.info({
      operation: 'spawn_nsjail',
      installation_name: config.installation_name,
      team_id: config.team_id,
      runtime: runtime,
      cache_dir: cacheDir,
      memory_limit_mb: nsjailConfig.memoryLimitMB,
      cpu_time_limit_seconds: nsjailConfig.cpuTimeLimitSeconds,
      max_processes: nsjailConfig.maxProcesses,
      max_open_files: nsjailConfig.maxOpenFiles,
      max_file_size_mb: nsjailConfig.maxFileSizeMB,
      tmpfs_size: nsjailConfig.tmpfsSize
    }, `Spawning ${runtime} MCP server with nsjail isolation (rlimit only)`);

    // Get current user UID and GID (deploystack user in production)
    const uid = process.getuid ? process.getuid() : 1000;
    const gid = process.getgid ? process.getgid() : 1000;

    // Resolve command to full path (nsjail requires full paths)
    // This also validates the command is in the allowlist
    const fullCommandPath = this.resolveCommandPath(config.command);

    // Build nsjail arguments based on working production configuration
    const nsjailArgs = [
      '-Mo',                                    // Mount mode: once, don't remount
      '--proc_rw',                              // Required for pthread_create and thread management
      '--user', String(uid),                    // Use current user (deploystack)
      '--group', String(gid),                   // Use current group (deploystack)
      '--rlimit_as', String(nsjailConfig.memoryLimitMB), // Memory limit (MB) - 2048 for interpreters
      '--rlimit_cpu', String(nsjailConfig.cpuTimeLimitSeconds), // CPU time limit (seconds)
      '--rlimit_nproc', String(nsjailConfig.maxProcesses), // Max processes - 1000 for package managers
      '--rlimit_nofile', String(nsjailConfig.maxOpenFiles), // Max file descriptors
      '--rlimit_fsize', String(nsjailConfig.maxFileSizeMB), // Max file size (MB)
      '--time_limit', '0',                      // No wall-clock time limit
      // Cgroup limits disabled due to permissions (rlimit provides fallback limits)
      // Physical memory limit removed (only virtual memory via rlimit_as: 2048MB)
      // Process limit relies on rlimit_nproc: 1000
      '-R', '/usr',                             // Read-only mount: /usr
      '-R', '/lib',                             // Read-only mount: /lib
      '-R', '/lib64',                           // Read-only mount: /lib64
      '-R', '/bin',                             // Read-only mount: /bin
      '-R', '/sbin',                            // Read-only mount: /sbin
      '-R', '/etc',                             // Read-only mount: /etc (includes resolv.conf)
      '-T', `/tmp:size=${nsjailConfig.tmpfsSize}`, // Writable temp with size limit (100M)
      '-B', `${cacheDir}:/home/${runtime}`,    // Runtime-specific cache directory mount
      // Mount GitHub deployment directory if present
      ...(config.temp_dir ? ['-B', `${config.temp_dir}:/app:ro`, '--cwd', '/app'] : []),
      '--bindmount', '/dev/null:/dev/null',    // Required for I/O redirection
      '--bindmount', '/dev/urandom:/dev/urandom', // Required for crypto operations
      '--bindmount', '/dev/zero:/dev/zero',    // Required for memory allocation
      '--symlink', '/proc/self/fd:/dev/fd',    // Required for file descriptor management
      // Runtime-specific environment variables
      ...this.getEnvironmentForRuntime(config),
      // Inject user-provided environment variables (sanitized)
      ...this.sanitizeEnvVars(config.env, config.installation_name),
      '--disable_clone_newnet',                // Allow network access (required for package downloads)
      '--disable_clone_newcgroup',             // Disable cgroup namespace (causes clone() errors on some kernels)
      '--disable_no_new_privs',                // May be needed for some packages
      '--hostname', `mcp-${config.team_id}`,   // Team-specific hostname
      '--',                                     // End of nsjail args
      fullCommandPath,                          // MCP server command with full path (e.g., /usr/bin/npx)
      // Prepend /app/ to relative paths for GitHub deployments
      ...config.args.map(arg => {
        if (config.temp_dir && !path.isAbsolute(arg) && !arg.startsWith('-')) {
          return path.join('/app', arg);
        }
        return arg;
      })
    ];

    return spawn('nsjail', nsjailArgs, {
      stdio: ['pipe', 'pipe', 'pipe']
    });
  }

  /**
   * Get sanitized build environment (NO SECRETS)
   *
   * Build commands should not have access to secrets or sensitive environment variables.
   * This prevents exfiltration during malicious build scripts.
   */
  private getSanitizedBuildEnv(runtime: 'node' | 'python'): string[] {
    const baseEnv = [
      '-E', 'CI=true',
      '-E', 'PATH=/usr/bin:/bin:/usr/local/bin'
    ];

    if (runtime === 'node') {
      return [
        ...baseEnv,
        '-E', 'HOME=/build',
        '-E', 'NPM_CONFIG_CACHE=/build/.npm',
        '-E', 'NPM_CONFIG_UPDATE_NOTIFIER=false',
        '-E', 'NODE_ENV=production'
      ];
    } else {
      return [
        ...baseEnv,
        '-E', 'HOME=/build',
        '-E', 'UV_CACHE_DIR=/build/.cache/uv',
        '-E', 'UV_TOOL_DIR=/build/.local/bin',
        '-E', 'PYTHONUNBUFFERED=1',
        '-E', 'PIP_NO_CACHE_DIR=1',
        '-E', 'PIP_DISABLE_PIP_VERSION_CHECK=1'
      ];
    }
  }

  /**
   * Spawn build commands (npm/uv/pip) inside nsjail sandbox
   *
   * Only used in production mode (Linux + nsjail available).
   * Development mode uses direct spawn() instead.
   *
   * Security features:
   * - Command allowlist validation (only npm, uv, pip, pip3)
   * - Sanitized environment (NO secrets passed to build)
   * - Network can be blocked during build phase (post-install)
   * - Resource limits applied
   *
   * @param command - The build command (npm, uv, pip, pip3)
   * @param args - Command arguments
   * @param workingDir - Directory with the extracted repository
   * @param options - Build options (network, timeout, runtime)
   * @returns Promise with exit code, stdout, and stderr
   */
  async spawnBuildCommandWithNsjail(
    command: string,
    args: string[],
    workingDir: string,
    options: BuildCommandOptions
  ): Promise<BuildCommandResult> {
    // Validate command against allowlist
    const normalizedCommand = command.trim().toLowerCase();
    if (!ALLOWED_BUILD_COMMANDS.has(normalizedCommand)) {
      this.logger.error({
        operation: 'security_build_command_blocked',
        command,
        allowed: Array.from(ALLOWED_BUILD_COMMANDS)
      }, `SECURITY: Build command not in allowlist: ${command}`);
      throw new Error(`Build command '${command}' not allowed. Allowed: ${Array.from(ALLOWED_BUILD_COMMANDS).join(', ')}`);
    }

    // Get command path
    const commandPath = BUILD_COMMAND_PATHS[normalizedCommand];
    if (!commandPath) {
      throw new Error(`No path mapping for build command '${command}'`);
    }

    // Get current user UID and GID
    const uid = process.getuid ? process.getuid() : 1000;
    const gid = process.getgid ? process.getgid() : 1000;

    const timeoutSeconds = Math.floor(options.timeoutMs / 1000);

    this.logger.info({
      operation: 'spawn_build_command_nsjail',
      command,
      command_path: commandPath,
      args,
      working_dir: workingDir,
      allow_network: options.allowNetwork,
      timeout_seconds: timeoutSeconds,
      runtime: options.runtime
    }, `Spawning sandboxed build command: ${command} ${args.join(' ')}`);

    // Build nsjail arguments for build commands
    const nsjailArgs = [
      '-Mo',                                    // Mount mode: once
      '--proc_rw',                              // Required for thread management
      '--user', String(uid),
      '--group', String(gid),
      '--rlimit_as', String(nsjailConfig.memoryLimitMB),
      '--rlimit_cpu', String(timeoutSeconds),
      '--rlimit_nproc', String(nsjailConfig.maxProcesses),
      '--rlimit_nofile', String(nsjailConfig.maxOpenFiles),
      '--rlimit_fsize', String(nsjailConfig.maxFileSizeMB),
      '--time_limit', String(timeoutSeconds),
      // Cgroup limits disabled due to permissions (rlimit provides fallback limits)
      // Read-only system mounts
      '-R', '/usr',
      '-R', '/lib',
      '-R', '/lib64',
      '-R', '/bin',
      '-R', '/sbin',
      '-R', '/etc',
      // Writable temp
      '-T', `/tmp:size=${nsjailConfig.tmpfsSize}`,
      // Working directory (read-write for install/build to work)
      '-B', `${workingDir}:/build:rw`,
      '--cwd', '/build',
      // Device mounts
      '--bindmount', '/dev/null:/dev/null',
      '--bindmount', '/dev/urandom:/dev/urandom',
      '--bindmount', '/dev/zero:/dev/zero',
      '--symlink', '/proc/self/fd:/dev/fd',
      // Sanitized environment (NO SECRETS)
      ...this.getSanitizedBuildEnv(options.runtime),
      // Disable cgroup namespace (causes clone() errors on some kernels)
      '--disable_clone_newcgroup',
      '--disable_no_new_privs',
      '--hostname', 'mcp-build',
      // Network: conditional based on phase
      // Install phase needs network, build phase should block it
      ...(options.allowNetwork ? ['--disable_clone_newnet'] : []),
      '--',
      commandPath,
      ...args
    ];

    return new Promise<BuildCommandResult>((resolve, reject) => {
      const proc = spawn('nsjail', nsjailArgs, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      // Set up timeout
      const timeout = setTimeout(() => {
        timedOut = true;
        proc.kill('SIGKILL');
      }, options.timeoutMs + 5000); // Give nsjail time to cleanup

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        clearTimeout(timeout);

        if (timedOut) {
          this.logger.error({
            operation: 'build_command_timeout',
            command,
            timeout_ms: options.timeoutMs
          }, `Build command timed out after ${options.timeoutMs}ms`);
          reject(new Error(`Build command '${command}' timed out after ${options.timeoutMs}ms`));
          return;
        }

        this.logger.info({
          operation: 'build_command_completed',
          command,
          exit_code: code,
          stdout_length: stdout.length,
          stderr_length: stderr.length
        }, `Build command completed with code ${code}`);

        resolve({
          code: code ?? 1,
          stdout,
          stderr
        });
      });

      proc.on('error', (error) => {
        clearTimeout(timeout);
        this.logger.error({
          operation: 'build_command_error',
          command,
          error: error.message
        }, `Build command process error: ${error.message}`);
        reject(error);
      });
    });
  }
}
