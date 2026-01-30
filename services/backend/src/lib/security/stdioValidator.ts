/**
 * Security validation for stdio MCP server configurations
 * Validates commands and arguments to prevent command injection and nsjail bypass
 */

import { ValidationResult, validResult, invalidResult } from './common';

/**
 * Allowed commands (strict allowlist - only exact matches)
 * These are the only commands that can be used to spawn MCP servers
 */
export const ALLOWED_COMMANDS = new Set(['npx', 'node', 'uvx', 'python', 'python3']);

/**
 * Patterns that are blocked in arguments (security threats)
 * Each pattern has a reason for being blocked
 */
const BLOCKED_ARG_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  // nsjail argument terminator - CRITICAL security bypass
  { pattern: /^--$/, reason: 'nsjail argument terminator not allowed' },

  // Shell metacharacters that could enable command chaining/injection
  { pattern: /;/, reason: 'semicolon (command separator) not allowed' },
  { pattern: /&/, reason: 'ampersand (background/chaining) not allowed' },
  { pattern: /\|/, reason: 'pipe character not allowed' },
  { pattern: /`/, reason: 'backtick (command substitution) not allowed' },

  // Command substitution patterns
  { pattern: /\$\(/, reason: 'command substitution $() not allowed' },
  { pattern: /\$\{/, reason: 'parameter expansion ${} not allowed' },

  // Path traversal
  { pattern: /\.\.\//, reason: 'path traversal ../ not allowed' },
  { pattern: /\.\.\\/, reason: 'path traversal ..\\ not allowed' },

  // nsjail-specific flags that could modify sandbox behavior
  { pattern: /^--user$/i, reason: 'nsjail --user flag not allowed' },
  { pattern: /^--group$/i, reason: 'nsjail --group flag not allowed' },
  { pattern: /^--rlimit/i, reason: 'nsjail --rlimit flags not allowed' },
  { pattern: /^--mount$/i, reason: 'nsjail --mount flag not allowed' },
  { pattern: /^--bindmount$/i, reason: 'nsjail --bindmount flag not allowed' },
  { pattern: /^--symlink$/i, reason: 'nsjail --symlink flag not allowed' },
  { pattern: /^--tmpfs$/i, reason: 'nsjail --tmpfs flag not allowed' },
  { pattern: /^--cgroup/i, reason: 'nsjail --cgroup flags not allowed' },
  { pattern: /^--disable/i, reason: 'nsjail --disable flags not allowed' },
  { pattern: /^--time_limit$/i, reason: 'nsjail --time_limit flag not allowed' },
  { pattern: /^--max_cpus$/i, reason: 'nsjail --max_cpus flag not allowed' },
  { pattern: /^--seccomp/i, reason: 'nsjail --seccomp flags not allowed' },
  { pattern: /^--chroot$/i, reason: 'nsjail --chroot flag not allowed' },
  { pattern: /^--hostname$/i, reason: 'nsjail --hostname flag not allowed' },
  { pattern: /^--proc/i, reason: 'nsjail --proc flags not allowed' },

  // nsjail short flags (single letter flags that could be dangerous)
  { pattern: /^-R$/, reason: 'nsjail -R (read-only mount) flag not allowed' },
  { pattern: /^-B$/, reason: 'nsjail -B (bind mount) flag not allowed' },
  { pattern: /^-E$/, reason: 'nsjail -E (env var) flag not allowed' },
  { pattern: /^-T$/, reason: 'nsjail -T (tmpfs) flag not allowed' },
  { pattern: /^-M$/, reason: 'nsjail -M (mount) flag not allowed' },
];

/**
 * Valid argument pattern - all arguments must match this
 * Allows:
 * - Alphanumeric characters
 * - Common package name characters: @, /, _, ., -
 * - Flag characters: =, :
 * - Hash for git refs: #
 * - Forward slash for paths (but not ..)
 */
const VALID_ARG_PATTERN = /^[a-zA-Z0-9@/_.\-=:#]+$/;

/**
 * Maximum length for a single argument
 */
const MAX_ARG_LENGTH = 500;

/**
 * Maximum number of arguments
 */
const MAX_ARGS_COUNT = 100;

/**
 * Validates that a command is in the allowed list
 * @param command - The command to validate (e.g., 'npx', 'node')
 * @returns ValidationResult indicating if the command is allowed
 */
export function validateCommand(command: string): ValidationResult {
  if (!command || typeof command !== 'string') {
    return invalidResult('Command is required', {
      type: 'INVALID_COMMAND',
      reason: 'Command must be a non-empty string'
    });
  }

  // Trim and normalize
  const normalizedCommand = command.trim().toLowerCase();

  // Check if it's an absolute path (not allowed)
  if (normalizedCommand.startsWith('/') || normalizedCommand.startsWith('\\')) {
    return invalidResult(`Absolute paths not allowed for commands. Use one of: ${Array.from(ALLOWED_COMMANDS).join(', ')}`, {
      type: 'INVALID_COMMAND',
      value: command,
      reason: 'Absolute paths could allow arbitrary command execution'
    });
  }

  // Check against allowlist (case-insensitive match, but store original)
  const commandLower = normalizedCommand;
  let isAllowed = false;
  for (const allowed of ALLOWED_COMMANDS) {
    if (allowed.toLowerCase() === commandLower) {
      isAllowed = true;
      break;
    }
  }

  if (!isAllowed) {
    return invalidResult(`Command '${command}' not allowed. Allowed commands: ${Array.from(ALLOWED_COMMANDS).join(', ')}`, {
      type: 'INVALID_COMMAND',
      value: command,
      reason: 'Command not in allowlist'
    });
  }

  return validResult();
}

/**
 * Validates a single argument against blocked patterns and valid format
 * @param arg - The argument to validate
 * @param index - Index in the args array (for error reporting)
 * @returns ValidationResult
 */
function validateSingleArg(arg: string, index: number): ValidationResult {
  if (typeof arg !== 'string') {
    return invalidResult(`Argument at index ${index} must be a string`, {
      type: 'INVALID_FORMAT',
      index,
      reason: 'Argument must be a string'
    });
  }

  // Check length
  if (arg.length > MAX_ARG_LENGTH) {
    return invalidResult(`Argument at index ${index} exceeds maximum length of ${MAX_ARG_LENGTH} characters`, {
      type: 'INVALID_FORMAT',
      index,
      value: arg.substring(0, 50) + '...',
      reason: `Argument too long (${arg.length} > ${MAX_ARG_LENGTH})`
    });
  }

  // Check against blocked patterns
  for (const { pattern, reason } of BLOCKED_ARG_PATTERNS) {
    if (pattern.test(arg)) {
      return invalidResult(`Argument at index ${index} contains blocked pattern: ${reason}`, {
        type: 'BLOCKED_PATTERN',
        index,
        value: arg,
        reason
      });
    }
  }

  // Check against valid pattern (must match)
  if (!VALID_ARG_PATTERN.test(arg)) {
    return invalidResult(`Argument at index ${index} contains invalid characters. Only alphanumeric, @, /, _, ., -, =, :, # are allowed`, {
      type: 'INVALID_FORMAT',
      index,
      value: arg,
      reason: 'Contains characters not in the allowed set'
    });
  }

  return validResult();
}

/**
 * Validates an array of command arguments
 * @param args - Array of arguments to validate
 * @returns ValidationResult
 */
export function validateArgs(args: string[]): ValidationResult {
  if (!Array.isArray(args)) {
    return invalidResult('Arguments must be an array', {
      type: 'INVALID_FORMAT',
      reason: 'Expected array of strings'
    });
  }

  // Check count
  if (args.length > MAX_ARGS_COUNT) {
    return invalidResult(`Too many arguments (${args.length}). Maximum allowed: ${MAX_ARGS_COUNT}`, {
      type: 'INVALID_FORMAT',
      reason: `Argument count ${args.length} exceeds maximum ${MAX_ARGS_COUNT}`
    });
  }

  // Validate each argument
  for (let i = 0; i < args.length; i++) {
    const result = validateSingleArg(args[i], i);
    if (!result.valid) {
      return result;
    }
  }

  return validResult();
}

/**
 * Validates both command and arguments for a stdio MCP server configuration
 * @param command - The command to run (e.g., 'npx', 'node')
 * @param args - Array of arguments to pass to the command
 * @returns ValidationResult
 */
export function validateStdioConfig(command: string, args: string[]): ValidationResult {
  // Validate command first
  const commandResult = validateCommand(command);
  if (!commandResult.valid) {
    return commandResult;
  }

  // Then validate arguments
  const argsResult = validateArgs(args);
  if (!argsResult.valid) {
    return argsResult;
  }

  return validResult();
}
