import { spawnSync } from 'child_process';

/**
 * Runtime validation utility for checking system dependencies
 *
 * Validates that required runtimes (Node.js, Python) are installed before
 * satellite starts. Prevents spawn failures when MCP servers are configured
 * but required runtimes are missing on the system.
 */

interface Logger {
  info: (obj: Record<string, unknown>, msg: string) => void;
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
      shell: true,
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
 * Build enhanced PATH for runtime checks
 * Exported for potential reuse in process spawner
 */
export { buildEnhancedPath };

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
