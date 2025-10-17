import { ChildProcess } from 'child_process';

/**
 * MCP Server configuration for subprocess spawning
 */
export interface MCPServerConfig {
  installation_id: string;       // Database ID from backend
  installation_name: string;     // e.g., "context7-john-R36no6FGoMFEZO9nWJJLT"
  team_id: string;              // Team UUID
  command: string;              // "npx" for Node.js packages
  args: string[];               // ["-y", "@upstash/context7"]
  env: Record<string, string>;  // Environment variables from three-tier config
}

/**
 * Process status types
 */
export type ProcessStatus = 
  | 'starting'           // Process spawned, performing MCP handshake
  | 'running'            // MCP handshake complete, ready for requests
  | 'terminating'        // Graceful shutdown in progress
  | 'terminated'         // Process has exited
  | 'failed'             // Process failed to start or crashed
  | 'permanently_failed'; // Process crashed 3+ times, auto-restart disabled

/**
 * Health status types
 */
export type HealthStatus = 
  | 'healthy'   // Process responding normally
  | 'unhealthy' // Process not responding or errors
  | 'unknown';  // Health not yet checked

/**
 * Pending request tracking for JSON-RPC communication
 */
export interface PendingRequest {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
  startTime: number;
}

/**
 * Core process information
 */
export interface ProcessInfo {
  id: string;                           // UUID for process
  config: MCPServerConfig;              // Spawn configuration
  process: ChildProcess;                // Node.js child process
  status: ProcessStatus;                // Current status
  startTime: number;                    // Unix timestamp
  lastActivity: number;                 // Unix timestamp
  messageCount: number;                 // Total messages sent
  errorCount: number;                   // Total errors encountered
  activeRequests: Map<string, PendingRequest>; // Pending JSON-RPC requests
  isDormantShutdown?: boolean;          // Flag for intentional idle termination (skip crash detection)
}

/**
 * Extended process info with runtime metadata
 */
export interface RuntimeProcessInfo extends ProcessInfo {
  installationId: string;               // Database ID
  installationName: string;             // User-friendly name
  teamId: string;                       // Team UUID
  healthStatus: HealthStatus;           // Health check result
  lastHealthCheck: number;              // Unix timestamp
}

/**
 * Runtime state snapshot for a team
 */
export interface RuntimeStateSnapshot {
  teamId: string;
  teamName: string;
  processes: RuntimeProcessInfo[];
  totalProcesses: number;
  runningProcesses: number;
  failedProcesses: number;
  lastUpdated: number;
}

/**
 * Process start result
 */
export interface ProcessStartResult {
  success: boolean;
  processInfo?: ProcessInfo;
  error?: string;
}
