/**
 * Build command logging utilities
 *
 * Extracted from github-deployment.ts to reduce code duplication.
 * Provides helpers for emitting build command output to LogBuffer.
 */

/**
 * LogBuffer interface for emitting logs to backend
 */
interface LogBuffer {
  add(entry: BufferedLogEntry): void;
}

/**
 * Buffered log entry structure
 */
interface BufferedLogEntry {
  installation_id: string;
  team_id: string;
  user_id?: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
}

/**
 * Build command metadata
 */
export interface BuildCommandMetadata {
  installation_id: string;
  team_id: string;
  user_id?: string;
}

/**
 * Emit stdout from build command to log buffer
 *
 * @param logBuffer - LogBuffer instance for emitting logs
 * @param metadata - Installation metadata (installation_id, team_id, user_id)
 * @param commandName - Command name for log prefix (e.g., "npm install", "uv sync")
 * @param stdout - Command stdout output
 * @param maxLength - Maximum message length (default: 1000)
 */
export function emitStdout(
  logBuffer: LogBuffer,
  metadata: BuildCommandMetadata,
  commandName: string,
  stdout: string,
  maxLength = 1000
): void {
  if (!stdout) return;

  logBuffer.add({
    installation_id: metadata.installation_id,
    team_id: metadata.team_id,
    user_id: metadata.user_id,
    level: 'info',
    message: `[${commandName}] ${stdout.substring(0, maxLength)}`,
    timestamp: new Date().toISOString()
  });
}

/**
 * Emit stderr from build command to log buffer
 *
 * @param logBuffer - LogBuffer instance for emitting logs
 * @param metadata - Installation metadata (installation_id, team_id, user_id)
 * @param commandName - Command name for log prefix (e.g., "npm install", "uv sync")
 * @param stderr - Command stderr output
 * @param maxLength - Maximum message length (default: 500)
 */
export function emitStderr(
  logBuffer: LogBuffer,
  metadata: BuildCommandMetadata,
  commandName: string,
  stderr: string,
  maxLength = 500
): void {
  if (!stderr) return;

  logBuffer.add({
    installation_id: metadata.installation_id,
    team_id: metadata.team_id,
    user_id: metadata.user_id,
    level: 'error',
    message: `[${commandName}] ${stderr.substring(0, maxLength)}`,
    timestamp: new Date().toISOString()
  });
}

/**
 * Emit build command result (stdout + stderr if failed)
 *
 * Convenience function that emits both stdout and stderr based on exit code.
 *
 * @param logBuffer - LogBuffer instance for emitting logs
 * @param metadata - Installation metadata
 * @param commandName - Command name for log prefix
 * @param result - Command execution result
 */
export function emitBuildResult(
  logBuffer: LogBuffer,
  metadata: BuildCommandMetadata,
  commandName: string,
  result: { code: number; stdout: string; stderr: string }
): void {
  // Emit stdout if available
  if (result.stdout) {
    emitStdout(logBuffer, metadata, commandName, result.stdout);
  }

  // Emit stderr as error if command failed
  if (result.code !== 0 && result.stderr) {
    emitStderr(logBuffer, metadata, commandName, result.stderr);
  }
}
