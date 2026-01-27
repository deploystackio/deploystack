/**
 * Process module barrel export
 * Re-exports all process management components
 */

// Main ProcessManager class
export { ProcessManager } from './manager';

// Log handling
export { LogBuffer, parseNsjailLog, inferMcpLogLevel } from './log-buffer';
export type { BufferedLogEntry } from './log-buffer';

// Process spawning
export { ProcessSpawner } from './nsjail-spawner';

// GitHub deployment
export { GitHubDeploymentHandler } from './github-deployment';
export type { GitHubInfo } from './github-deployment';

// Restart handling
export { RestartHandler } from './restart-handler';
export type { SpawnCallback, StatusCallback } from './restart-handler';

// Dormant process management
export { DormantManager } from './dormant-manager';
export type { SpawnFunction, TerminateFunction, GetProcessFunction } from './dormant-manager';

// Types
export * from './types';

// RuntimeState (existing)
export { RuntimeState } from './runtime-state';
