import { spawnSync } from 'child_process';

/**
 * Runtime validation utility for checking system dependencies
 *
 * Validates that required runtimes (Node.js, Python) are installed before
 * satellite starts. Prevents spawn failures when MCP servers are configured
 * but required runtimes are missing on the system.
 */

interface Logger {
  trace?: (obj: Record<string, unknown>, msg: string) => void;
  debug?: (obj: Record<string, unknown>, msg: string) => void;
  info: (obj: Record<string, unknown>, msg: string) => void;
  warn?: (obj: Record<string, unknown>, msg: string) => void;
  error?: (obj: Record<string, unknown>, msg: string) => void;
  fatal: (obj: Record<string, unknown>, msg: string) => void;
}

interface RuntimeCheck {
  name: string;           // Display name (e.g., "Node.js")
  commands: string[];     // Commands to check (e.g., ["node", "npx"])
  versionFlag: string;    // Flag to get version (e.g., "--version")
  required: boolean;      // Exit if missing vs warn only
}

const RUNTIME_CHECKS: RuntimeCheck[] = [
  {
    name: 'Node.js',
    commands: ['node', 'npm'],
    versionFlag: '--version',
    required: true
  },
  {
    name: 'Python 3 & UV',
    commands: ['python3', 'uvx'],
    versionFlag: '--version',
    required: true
  },
  {
    name: 'Python (legacy)',
    commands: ['python'],
    versionFlag: '--version',
    required: false
  }
];

interface CommandCheckResult {
  command: string;
  available: boolean;
  version?: string;
  error?: string;
  checkedPath?: string;
}

interface RuntimeCheckResult {
  runtime: string;
  required: boolean;
  available: boolean;
  commands: CommandCheckResult[];
  allCommandsAvailable: boolean;
}

/**
 * Build enhanced PATH for runtime checks
 * Includes common installation directories that might not be in systemd PATH
 */
function buildEnhancedPath(): string {
  const currentPath = process.env.PATH || '';
  const pathSegments = currentPath.split(':').filter(Boolean);

  // Common installation locations (order matters - user local should come first)
  const commonPaths = [
    // User-local installations (using actual username, not hardcoded)
    `${process.env.HOME}/.local/bin`,     // pip/uv user installs
    `${process.env.HOME}/.cargo/bin`,     // Rust toolchain
    `${process.env.HOME}/bin`,            // User bin directory

    // System-wide package manager locations
    '/usr/local/bin',                      // Homebrew, manual installs
    '/usr/bin',                            // System packages
    '/bin',                                // Core system binaries

    // Additional common locations
    '/opt/homebrew/bin',                   // macOS ARM Homebrew
    '/usr/local/sbin',
    '/usr/sbin',
    '/sbin'
  ];

  // Add common paths that aren't already in PATH
  for (const path of commonPaths) {
    if (path && !pathSegments.includes(path)) {
      pathSegments.push(path);
    }
  }

  return pathSegments.join(':');
}

/**
 * Check if command is available on the system (searches PATH)
 */
function checkCommand(command: string, versionFlag: string): CommandCheckResult {
  try {
    const result = spawnSync(command, [versionFlag], {
      timeout: 5000,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PATH: buildEnhancedPath()
      }
    });

    // Command not found
    if (result.error) {
      if (result.error.message.includes('ENOENT')) {
        return {
          command,
          available: false,
          error: 'Command not found in system PATH'
        };
      }
      return {
        command,
        available: false,
        error: result.error.message
      };
    }

    // Check exit code
    if (result.status !== 0) {
      return {
        command,
        available: false,
        error: `Command exited with code ${result.status}`
      };
    }

    // Extract version from stdout or stderr
    const version = (result.stdout || result.stderr).trim().split('\n')[0];

    return {
      command,
      available: true,
      version: version || 'unknown'
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      command,
      available: false,
      error: errorMessage
    };
  }
}

/**
 * Check if a runtime is available on the system
 */
function checkRuntime(runtime: RuntimeCheck): RuntimeCheckResult {
  const commandResults: CommandCheckResult[] = [];

  for (const command of runtime.commands) {
    const result = checkCommand(command, runtime.versionFlag);
    commandResults.push(result);
  }

  // Runtime is available if ALL commands are available
  const allCommandsAvailable = commandResults.every(r => r.available);

  return {
    runtime: runtime.name,
    required: runtime.required,
    available: allCommandsAvailable,
    commands: commandResults,
    allCommandsAvailable
  };
}

/**
 * Build error message for missing runtime
 */
function buildErrorMessage(
  result: RuntimeCheckResult,
  platform: string
): string {
  const lines: string[] = [];

  lines.push(`FATAL: Required runtime missing: ${result.runtime}`);
  lines.push('');
  lines.push('The following commands are not available in your system PATH:');

  for (const cmd of result.commands) {
    if (!cmd.available) {
      lines.push(`  - ${cmd.command} (${cmd.error || 'not found'})`);
    }
  }

  lines.push('');
  lines.push(`${result.runtime} is required to run MCP servers that use these commands.`);
  lines.push('');

  // Add installation guidance
  if (result.runtime === 'Node.js') {
    lines.push('Please install Node.js 18+ (includes both node and npm) on this system before starting the satellite.');
    lines.push('Installation guide: https://nodejs.org/en/download/');
  } else if (result.runtime === 'Python 3 & UV') {
    lines.push('Please install Python 3.8+ and UV Package Manager on this system before starting the satellite.');
    lines.push('Python installation: https://www.python.org/downloads/');
    lines.push('UV installation: https://docs.astral.sh/uv/getting-started/installation/');
  }

  lines.push('');
  lines.push('See services/satellite/README.md for detailed installation instructions.');
  lines.push('');
  lines.push('Debug info:');
  lines.push(`  Platform: ${platform}`);
  lines.push('  Checked: System PATH (uses same lookup as shell commands)');

  lines.push('');
  lines.push('To skip runtime validation (not recommended):');
  lines.push('  Set environment variable: DEPLOYSTACK_SKIP_RUNTIME_CHECKS=true');

  return lines.join('\n');
}

/**
 * Build warning message for missing optional runtime
 */
function buildWarningMessage(result: RuntimeCheckResult): string {
  const lines: string[] = [];

  lines.push(`WARNING: Optional runtime not available: ${result.runtime}`);
  lines.push('');

  const missingCommands = result.commands
    .filter(c => !c.available)
    .map(c => c.command);

  if (missingCommands.length > 0) {
    lines.push(`Missing commands: ${missingCommands.join(', ')}`);
  }

  lines.push('');
  lines.push('This is optional and will not prevent satellite startup.');
  lines.push('Some MCP servers may not work if they depend on these commands.');

  return lines.join('\n');
}

/**
 * Validate command path for security
 * Only allow paths in known safe directories
 */
function validateCommandPath(commandPath: string): boolean {
  // Must be absolute
  if (!commandPath.startsWith('/')) return false;

  // Must match allowed patterns
  const allowedPatterns = [
    /^\/usr\/bin\//,
    /^\/usr\/local\/bin\//,
    /^\/bin\//,
    /^\/opt\/[^/]+\/bin\//
  ];

  // Add HOME-relative pattern if HOME is set
  if (process.env.HOME) {
    const homePattern = new RegExp(`^${process.env.HOME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\/\.local\/bin\/`);
    allowedPatterns.push(homePattern);
  }

  // Check if path matches any allowed pattern
  if (!allowedPatterns.some(p => p.test(commandPath))) {
    return false;
  }

  // Must not contain suspicious patterns
  if (commandPath.includes('..')) return false;
  if (commandPath.includes('//')) return false;

  return true;
}

/**
 * Resolve absolute path for a command using system PATH
 * Returns null if command not found or validation fails
 * Uses same PATH logic as checkCommand() for consistency
 */
export function resolveCommandPath(command: string): string | null {
  try {
    const result = spawnSync('which', [command], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 5000,
      env: {
        ...process.env,
        PATH: buildEnhancedPath()
      }
    });

    if (result.status === 0 && result.stdout) {
      const path = result.stdout.trim();
      if (validateCommandPath(path)) {
        return path;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Initialize command path cache at startup
 * Resolves all required commands once and caches results
 * Called after validateSystemRuntimes() ensures they exist
 *
 * @param logger - Logger instance for logging resolved paths
 * @returns Map of command name to absolute path
 */
export function initializeCommandCache(logger: Logger): Map<string, string> {
  const commands = ['node', 'npm', 'npx', 'python3', 'python', 'uvx', 'uv', 'pip', 'pip3'];
  const cache = new Map<string, string>();

  logger.info(
    { operation: 'command_cache_init_start', commands },
    'Initializing command path cache...'
  );

  for (const command of commands) {
    const path = resolveCommandPath(command);
    if (path) {
      cache.set(command, path);
      logger.info(
        { operation: 'command_resolved', command, path },
        `Resolved: ${command} -> ${path}`
      );
    } else {
      // Log warning but don't fail - validateSystemRuntimes already checked required commands
      logger.info(
        { operation: 'command_not_resolved', command },
        `Warning: Could not resolve path for ${command} (may be optional)`
      );
    }
  }

  logger.info(
    {
      operation: 'command_cache_init_complete',
      cached_commands: cache.size,
      total_commands: commands.length
    },
    `Command path cache initialized with ${cache.size}/${commands.length} commands`
  );

  return cache;
}

/**
 * Build enhanced PATH for runtime checks
 * Exported for potential reuse in process spawner
 */
export { buildEnhancedPath };

/**
 * Python version information
 */
export interface PythonVersionInfo {
  version: string;        // Full version (e.g., "3.13.9")
  majorMinor: string;     // Major.minor (e.g., "3.13")
  path: string;           // Absolute path to binary
  command: string;        // Command name (e.g., "python3.13")
}

/**
 * Python version selection result
 */
export interface PythonSelectionResult {
  version: string;        // Selected version
  path: string;           // Absolute path
  command: string;        // Command name
  reason: string;         // Why this version was selected
  alternatives: string[]; // Other available versions
  skipped: string[];      // Versions skipped (e.g., bleeding edge)
}

/**
 * Discover all Python 3.x versions available on the system
 * Searches for python3.X binaries using existing PATH infrastructure
 */
export function discoverPythonVersions(logger?: Logger): PythonVersionInfo[] {
  const versions: PythonVersionInfo[] = [];

  // Check python3.X versions (3.8 through 3.20 to be future-proof)
  for (let minor = 8; minor <= 20; minor++) {
    const command = `python3.${minor}`;
    const path = resolveCommandPath(command);

    if (path) {
      try {
        const result = spawnSync(command, ['--version'], {
          encoding: 'utf-8',
          timeout: 5000,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: {
            ...process.env,
            PATH: buildEnhancedPath()
          }
        });

        if (result.status === 0) {
          const versionOutput = (result.stdout || result.stderr).trim();
          const versionMatch = versionOutput.match(/Python (\d+\.\d+\.\d+)/);

          if (versionMatch) {
            const fullVersion = versionMatch[1];
            const majorMinor = `3.${minor}`;

            versions.push({
              version: fullVersion,
              majorMinor,
              path,
              command
            });

            if (logger?.trace) {
              logger.trace({
                operation: 'python_version_discovered',
                command,
                version: fullVersion,
                path
              }, `Found Python ${fullVersion} at ${path}`);
            }
          }
        }
      } catch (error) {
        // Silently skip - command exists but version check failed
        if (logger?.trace) {
          logger.trace({
            operation: 'python_version_check_failed',
            command,
            error: error instanceof Error ? error.message : String(error)
          }, `Failed to check version for ${command}`);
        }
      }
    }
  }

  // Also check generic python3
  const python3Path = resolveCommandPath('python3');
  if (python3Path) {
    try {
      const result = spawnSync('python3', ['--version'], {
        encoding: 'utf-8',
        timeout: 5000,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          PATH: buildEnhancedPath()
        }
      });

      if (result.status === 0) {
        const versionOutput = (result.stdout || result.stderr).trim();
        const versionMatch = versionOutput.match(/Python (\d+\.\d+\.\d+)/);

        if (versionMatch) {
          const fullVersion = versionMatch[1];
          const majorMinorMatch = fullVersion.match(/(\d+\.\d+)/);

          if (majorMinorMatch) {
            const majorMinor = majorMinorMatch[1];

            // Only add if not already discovered
            const alreadyFound = versions.some(v => v.version === fullVersion);
            if (!alreadyFound) {
              versions.push({
                version: fullVersion,
                majorMinor,
                path: python3Path,
                command: 'python3'
              });

              if (logger?.trace) {
                logger.trace({
                  operation: 'python_version_discovered',
                  command: 'python3',
                  version: fullVersion,
                  path: python3Path
                }, `Found Python ${fullVersion} at ${python3Path}`);
              }
            }
          }
        }
      }
    } catch (error) {
      // Silently skip
      if (logger?.trace) {
        logger.trace({
          operation: 'python_version_check_failed',
          command: 'python3',
          error: error instanceof Error ? error.message : String(error)
        }, 'Failed to check version for python3');
      }
    }
  }

  return versions;
}

/**
 * Check if a Python version is considered "bleeding edge"
 * Bleeding edge = latest minor version (most likely to lack pre-built wheels)
 */
function isBleedingEdgePython(version: PythonVersionInfo, allVersions: PythonVersionInfo[]): boolean {
  // Extract all unique major.minor versions
  const minorVersions = allVersions
    .map(v => {
      const match = v.majorMinor.match(/3\.(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter(v => v > 0);

  if (minorVersions.length === 0) return false;

  // Find the latest minor version
  const latestMinor = Math.max(...minorVersions);

  // Check if this version is the latest
  const versionMinor = parseInt(version.majorMinor.split('.')[1], 10);
  return versionMinor === latestMinor;
}

/**
 * Select best Python version for GitHub deployments
 * Prefers stable versions with mature wheel ecosystem, avoids bleeding edge
 *
 * @param logger - Optional logger for debugging
 * @param minVersion - Optional minimum version requirement (e.g., "3.10")
 * @returns Selection result or null if no suitable version found
 */
export function selectBestPythonForDeployment(
  logger?: Logger,
  minVersion?: string
): PythonSelectionResult | null {
  const startTime = Date.now();

  if (logger?.debug) {
    logger.debug({
      operation: 'python_version_selection_start',
      min_version: minVersion
    }, 'Starting Python version selection for deployment');
  }

  // Discover all available versions
  const allVersions = discoverPythonVersions(logger);

  if (allVersions.length === 0) {
    if (logger?.warn) {
      logger.warn({
        operation: 'python_version_selection_failed',
        reason: 'no_versions_found'
      }, 'No Python versions found on system');
    }
    return null;
  }

  // Filter by minimum version if specified
  let candidateVersions = allVersions;
  if (minVersion) {
    const minMajorMinor = minVersion.match(/(\d+\.\d+)/)?.[1];
    if (minMajorMinor) {
      const [minMajor, minMinor] = minMajorMinor.split('.').map(Number);
      candidateVersions = allVersions.filter(v => {
        const [major, minor] = v.majorMinor.split('.').map(Number);
        return major > minMajor || (major === minMajor && minor >= minMinor);
      });

      if (candidateVersions.length === 0) {
        if (logger?.warn) {
          logger.warn({
            operation: 'python_version_selection_failed',
            reason: 'min_version_not_met',
            min_version: minVersion,
            available_versions: allVersions.map(v => v.version)
          }, `No Python versions meet minimum requirement: ${minVersion}`);
        }
        return null;
      }
    }
  }

  // Categorize versions
  const bleedingEdge: PythonVersionInfo[] = [];
  const stable: PythonVersionInfo[] = [];

  for (const version of candidateVersions) {
    if (isBleedingEdgePython(version, allVersions)) {
      bleedingEdge.push(version);
    } else {
      stable.push(version);
    }
  }

  // Selection strategy:
  // 1. Prefer newest stable version (best wheel availability)
  // 2. Fall back to bleeding edge if no stable versions
  // 3. Sort by minor version descending

  let selected: PythonVersionInfo | null = null;
  let reason = '';

  if (stable.length > 0) {
    // Sort stable versions by minor version (descending)
    stable.sort((a, b) => {
      const aMinor = parseInt(a.majorMinor.split('.')[1], 10);
      const bMinor = parseInt(b.majorMinor.split('.')[1], 10);
      return bMinor - aMinor;
    });

    selected = stable[0];
    reason = 'Current stable version with mature wheel ecosystem';
  } else if (bleedingEdge.length > 0) {
    // No stable versions - use bleeding edge as last resort
    bleedingEdge.sort((a, b) => {
      const aMinor = parseInt(a.majorMinor.split('.')[1], 10);
      const bMinor = parseInt(b.majorMinor.split('.')[1], 10);
      return bMinor - aMinor;
    });

    selected = bleedingEdge[0];
    reason = 'Bleeding edge version (no stable alternatives available)';
  }

  if (!selected) {
    if (logger?.warn) {
      logger.warn({
        operation: 'python_version_selection_failed',
        reason: 'no_candidates'
      }, 'No suitable Python version found');
    }
    return null;
  }

  // Build result
  const alternatives = candidateVersions
    .filter(v => v.version !== selected.version)
    .map(v => v.version);

  const skipped = bleedingEdge
    .filter(v => v.version !== selected.version)
    .map(v => `${v.version} (bleeding edge)`);

  const duration = Date.now() - startTime;

  if (logger) {
    logger.info({
      operation: 'python_version_selection_complete',
      selected_version: selected.version,
      selected_path: selected.path,
      reason,
      alternatives,
      skipped,
      duration_ms: duration,
      total_versions: allVersions.length,
      candidate_versions: candidateVersions.length
    }, `Selected Python ${selected.version} for deployment (${reason})`);
  }

  return {
    version: selected.version,
    path: selected.path,
    command: selected.command,
    reason,
    alternatives,
    skipped
  };
}

/**
 * Validate system runtimes before satellite starts
 *
 * @param logger - Logger instance (must have info() and fatal() methods)
 * @throws Never - Calls process.exit(1) on fatal errors
 */
export function validateSystemRuntimes(logger: Logger): void {
  // Check if skip flag is set
  const skipChecks = process.env.DEPLOYSTACK_SKIP_RUNTIME_CHECKS === 'true';

  if (skipChecks) {
    logger.info(
      { operation: 'runtime_validation_skipped' },
      'Runtime validation skipped (DEPLOYSTACK_SKIP_RUNTIME_CHECKS=true)'
    );
    return;
  }

  // Get platform info
  const platform = process.platform;

  logger.info(
    {
      operation: 'runtime_validation_start',
      platform
    },
    'Validating system runtimes (checking system PATH)...'
  );

  // Check all runtimes
  const results: RuntimeCheckResult[] = [];

  for (const runtimeCheck of RUNTIME_CHECKS) {
    const result = checkRuntime(runtimeCheck);
    results.push(result);

    // Log individual runtime check
    if (result.available) {
      const versions = result.commands
        .filter(c => c.version)
        .map(c => `${c.command} ${c.version}`)
        .join(', ');

      logger.info(
        {
          operation: 'runtime_check_passed',
          runtime: result.runtime,
          required: result.required
        },
        `Runtime: ${result.runtime} ✓ (${versions || 'available'})`
      );
    } else if (result.required) {
      // Required runtime missing - this will cause exit below
      logger.fatal(
        {
          operation: 'runtime_check_failed',
          runtime: result.runtime,
          required: true
        },
        `Runtime: ${result.runtime} ✗ (required, not available)`
      );
    } else {
      // Optional runtime missing - just warn
      logger.info(
        {
          operation: 'runtime_check_warning',
          runtime: result.runtime,
          required: false
        },
        `Runtime: ${result.runtime} ✗ (optional, not installed)`
      );
    }
  }

  // Check for required runtime failures
  const missingRequired = results.filter(r => r.required && !r.available);

  if (missingRequired.length > 0) {
    // Build comprehensive error message
    for (const missing of missingRequired) {
      const errorMessage = buildErrorMessage(missing, platform);
      logger.fatal(
        {
          operation: 'runtime_validation_failed',
          runtime: missing.runtime,
          platform
        },
        errorMessage
      );
    }

    // Exit with error
    process.exit(1);
  }

  // Log warnings for optional runtimes
  const missingOptional = results.filter(r => !r.required && !r.available);

  for (const missing of missingOptional) {
    const warningMessage = buildWarningMessage(missing);
    logger.info(
      {
        operation: 'runtime_validation_optional_missing',
        runtime: missing.runtime
      },
      warningMessage
    );
  }

  // Success
  logger.info(
    {
      operation: 'runtime_validation_complete',
      total_runtimes: results.length,
      required_available: results.filter(r => r.required && r.available).length,
      optional_available: results.filter(r => !r.required && r.available).length
    },
    'System runtime validation passed'
  );
}
