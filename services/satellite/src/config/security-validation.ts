/**
 * Security validation for MCP server configurations (Satellite-side defense in depth)
 *
 * This module mirrors the backend validation as a last line of defense.
 * Even if malicious data bypasses the backend, the satellite will reject it.
 */

import { Logger } from 'pino';

/**
 * Validation result type
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  blockedItems?: string[];
}

/**
 * Allowed commands (strict allowlist - only exact matches)
 * These are the only commands that can be used to spawn MCP servers
 */
export const ALLOWED_COMMANDS = new Set(['npx', 'node', 'uvx', 'python', 'python3']);

/**
 * DEPRECATED: Command paths are now resolved dynamically at runtime
 * See runtime-validator.ts for dynamic path resolution
 * This is kept for backwards compatibility but should not be used
 */
export const COMMAND_PATHS: Record<string, string> = {
  // Paths resolved dynamically - see DEPLOYSTACK_COMMAND_CACHE global
};

/**
 * Patterns that are blocked in arguments (security threats)
 */
const BLOCKED_ARG_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  // nsjail argument terminator - CRITICAL security bypass
  { pattern: /^--$/, reason: 'nsjail argument terminator' },

  // Shell metacharacters
  { pattern: /;/, reason: 'semicolon' },
  { pattern: /&/, reason: 'ampersand' },
  { pattern: /\|/, reason: 'pipe' },
  { pattern: /`/, reason: 'backtick' },

  // Command substitution
  { pattern: /\$\(/, reason: 'command substitution' },
  { pattern: /\$\{/, reason: 'parameter expansion' },

  // Path traversal
  { pattern: /\.\.\//, reason: 'path traversal' },
  { pattern: /\.\.\\/, reason: 'path traversal' },

  // nsjail-specific flags
  { pattern: /^--user$/i, reason: 'nsjail flag' },
  { pattern: /^--group$/i, reason: 'nsjail flag' },
  { pattern: /^--rlimit/i, reason: 'nsjail flag' },
  { pattern: /^--mount$/i, reason: 'nsjail flag' },
  { pattern: /^--bindmount$/i, reason: 'nsjail flag' },
  { pattern: /^--symlink$/i, reason: 'nsjail flag' },
  { pattern: /^--tmpfs$/i, reason: 'nsjail flag' },
  { pattern: /^--cgroup/i, reason: 'nsjail flag' },
  { pattern: /^--disable/i, reason: 'nsjail flag' },
  { pattern: /^--time_limit$/i, reason: 'nsjail flag' },
  { pattern: /^--max_cpus$/i, reason: 'nsjail flag' },
  { pattern: /^--seccomp/i, reason: 'nsjail flag' },
  { pattern: /^--chroot$/i, reason: 'nsjail flag' },
  { pattern: /^--hostname$/i, reason: 'nsjail flag' },
  { pattern: /^--proc/i, reason: 'nsjail flag' },

  // nsjail short flags
  { pattern: /^-R$/, reason: 'nsjail flag' },
  { pattern: /^-B$/, reason: 'nsjail flag' },
  { pattern: /^-E$/, reason: 'nsjail flag' },
  { pattern: /^-T$/, reason: 'nsjail flag' },
  { pattern: /^-M$/, reason: 'nsjail flag' },
];

/**
 * Valid argument pattern
 */
const VALID_ARG_PATTERN = /^[a-zA-Z0-9@/_.\-=:#]+$/;

/**
 * Validates that a command is in the allowed list
 * @param command - The command to validate
 * @param logger - Logger for security warnings
 * @returns ValidationResult
 */
export function validateCommand(command: string, logger?: Logger): ValidationResult {
  if (!command || typeof command !== 'string') {
    return { valid: false, error: 'Command is required' };
  }

  const normalizedCommand = command.trim().toLowerCase();

  // Reject absolute paths
  if (normalizedCommand.startsWith('/') || normalizedCommand.startsWith('\\')) {
    if (logger) {
      logger.warn({
        operation: 'security_command_blocked',
        command,
        reason: 'absolute_path_not_allowed'
      }, `SECURITY: Blocked absolute path command: ${command}`);
    }
    return {
      valid: false,
      error: `Absolute paths not allowed. Use one of: ${Array.from(ALLOWED_COMMANDS).join(', ')}`
    };
  }

  // Check allowlist
  let isAllowed = false;
  for (const allowed of ALLOWED_COMMANDS) {
    if (allowed.toLowerCase() === normalizedCommand) {
      isAllowed = true;
      break;
    }
  }

  if (!isAllowed) {
    if (logger) {
      logger.warn({
        operation: 'security_command_blocked',
        command,
        reason: 'not_in_allowlist'
      }, `SECURITY: Blocked non-allowed command: ${command}`);
    }
    return {
      valid: false,
      error: `Command '${command}' not allowed. Allowed: ${Array.from(ALLOWED_COMMANDS).join(', ')}`
    };
  }

  return { valid: true };
}

/**
 * Validates command arguments for security threats
 * @param args - Array of arguments to validate
 * @param logger - Logger for security warnings
 * @returns ValidationResult with blocked items if any
 */
export function validateArgs(args: string[], logger?: Logger): ValidationResult {
  if (!Array.isArray(args)) {
    return { valid: false, error: 'Arguments must be an array' };
  }

  const blockedItems: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (typeof arg !== 'string') {
      blockedItems.push(`[${i}]: non-string`);
      continue;
    }

    // Check blocked patterns
    for (const { pattern, reason } of BLOCKED_ARG_PATTERNS) {
      if (pattern.test(arg)) {
        blockedItems.push(`[${i}]: ${reason} (${arg.substring(0, 50)})`);
        break;
      }
    }

    // Check valid pattern
    if (!VALID_ARG_PATTERN.test(arg) && !blockedItems.some(b => b.startsWith(`[${i}]`))) {
      blockedItems.push(`[${i}]: invalid chars (${arg.substring(0, 50)})`);
    }
  }

  if (blockedItems.length > 0) {
    if (logger) {
      logger.warn({
        operation: 'security_args_blocked',
        blockedCount: blockedItems.length,
        blockedItems
      }, `SECURITY: Blocked ${blockedItems.length} dangerous argument(s)`);
    }
    return {
      valid: false,
      error: 'Arguments contain security violations',
      blockedItems
    };
  }

  return { valid: true };
}

/**
 * DEPRECATED: Resolves command to full path for nsjail execution
 *
 * This function is deprecated. Command paths are now resolved dynamically
 * at startup and cached in DEPLOYSTACK_COMMAND_CACHE global.
 * Use the cache directly via nsjail-spawner's getCommandPath() function.
 *
 * @deprecated Use dynamic path resolution from runtime-validator.ts
 * @param command - The command name (e.g., 'npx', 'node')
 * @param logger - Logger for security warnings
 * @returns Full path to command
 * @throws Error if command is not allowed
 */
export function resolveCommandPath(command: string, logger?: Logger): string {
  // First validate the command is allowed
  const validation = validateCommand(command, logger);
  if (!validation.valid) {
    throw new Error(validation.error || 'Command not allowed');
  }

  // Get path from runtime-resolved cache
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cache = (global as any).DEPLOYSTACK_COMMAND_CACHE as Map<string, string> | undefined;
  const normalizedCommand = command.trim().toLowerCase();

  if (cache && cache.has(normalizedCommand)) {
    return cache.get(normalizedCommand)!;
  }

  // Fallback for backwards compatibility (should not happen after initialization)
  if (logger) {
    logger.warn({
      operation: 'command_cache_miss',
      command,
      normalizedCommand,
      fallbackPath: `/usr/bin/${normalizedCommand}`
    }, `Command ${command} not found in cache, using /usr/bin fallback`);
  }
  return `/usr/bin/${normalizedCommand}`;
}

/**
 * Validates both command and args together (convenience function)
 */
export function validateStdioConfig(
  command: string,
  args: string[],
  logger?: Logger
): ValidationResult {
  const cmdResult = validateCommand(command, logger);
  if (!cmdResult.valid) {
    return cmdResult;
  }

  const argsResult = validateArgs(args, logger);
  if (!argsResult.valid) {
    return argsResult;
  }

  return { valid: true };
}

// ============================================
// Build Script Validation (Defense-in-Depth)
// ============================================

/**
 * Dangerous patterns blocked in build scripts
 * Mirrors the backend validation for defense-in-depth
 */
const BLOCKED_BUILD_SCRIPT_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  // Network exfiltration
  { pattern: /\bcurl\b/i, reason: 'curl command (network exfiltration risk)' },
  { pattern: /\bwget\b/i, reason: 'wget command (network exfiltration risk)' },
  { pattern: /\bnc\b/, reason: 'netcat (network exfiltration risk)' },
  { pattern: /\bnetcat\b/i, reason: 'netcat (network exfiltration risk)' },
  { pattern: /\btelnet\b/i, reason: 'telnet (network exfiltration risk)' },
  { pattern: />\s*\/dev\/tcp/, reason: 'bash network redirect (exfiltration risk)' },

  // Shell execution with inline commands
  { pattern: /\bbash\s+-c\b/i, reason: 'bash -c (arbitrary shell execution)' },
  { pattern: /\bsh\s+-c\b/i, reason: 'sh -c (arbitrary shell execution)' },
  { pattern: /\bzsh\s+-c\b/i, reason: 'zsh -c (arbitrary shell execution)' },

  // Code execution from string
  { pattern: /\bpython\s+-c\b/i, reason: 'python -c (code execution from string)' },
  { pattern: /\bpython3\s+-c\b/i, reason: 'python3 -c (code execution from string)' },
  { pattern: /\bnode\s+-e\b/i, reason: 'node -e (code execution from string)' },
  { pattern: /\bnode\s+--eval\b/i, reason: 'node --eval (code execution from string)' },
  { pattern: /\bperl\s+-e\b/i, reason: 'perl -e (code execution from string)' },
  { pattern: /\bruby\s+-e\b/i, reason: 'ruby -e (code execution from string)' },
  { pattern: /\beval\s*\(/, reason: 'eval() call (code execution from string)' },

  // Encoding (often used for obfuscation)
  { pattern: /\|.*\bbase64\b/, reason: 'piped base64 (obfuscation technique)' },
  { pattern: /\bbase64\s+-d\b/, reason: 'base64 decode (obfuscation technique)' },

  // Environment variable piping (exfiltration)
  { pattern: /\$[A-Z_]+.*\|/, reason: 'env var piped to command (exfiltration risk)' },
  { pattern: /echo\s+\$[A-Z_]+.*[|>]/, reason: 'echo env var redirected (exfiltration risk)' },

  // Dangerous system operations
  { pattern: /\brm\s+-rf\s+\//, reason: 'rm -rf / (destructive operation)' },
  { pattern: /\bchmod\s+777/, reason: 'chmod 777 (insecure permissions)' },

  // Python-specific dangerous patterns
  { pattern: /os\.system\s*\(/, reason: 'os.system() (arbitrary command execution)' },
  { pattern: /subprocess\.(call|run|Popen)\s*\(/, reason: 'subprocess execution' },
  { pattern: /\bexec\s*\(/, reason: 'exec() (code execution from string)' },
  { pattern: /__import__\s*\(/, reason: '__import__() (dynamic import)' },
];

/**
 * Validate build scripts for security risks (Defense-in-depth)
 *
 * This validation runs on the satellite before executing any build commands,
 * even though the backend should have already validated the scripts.
 *
 * @param scripts - The scripts object from package.json
 * @returns ValidationResult with error if dangerous patterns found
 */
export function validateBuildScripts(
  scripts: Record<string, string> | undefined
): ValidationResult {
  if (!scripts) {
    return { valid: true };
  }

  const blockedItems: string[] = [];

  for (const [name, content] of Object.entries(scripts)) {
    if (!content || typeof content !== 'string') continue;

    for (const { pattern, reason } of BLOCKED_BUILD_SCRIPT_PATTERNS) {
      if (pattern.test(content)) {
        blockedItems.push(`scripts.${name}: ${reason}`);
      }
    }
  }

  if (blockedItems.length > 0) {
    return {
      valid: false,
      error: `Dangerous patterns in build scripts: ${blockedItems.join(', ')}`,
      blockedItems
    };
  }

  return { valid: true };
}
