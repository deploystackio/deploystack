import { ChildProcess } from 'child_process';

/**
 * MCP Server configuration for subprocess spawning
 */
export interface MCPServerConfig {
  installation_id: string;       // Database ID from backend
  instance_id?: string;          // Instance ID from mcpServerInstances table (per-user instance)
  instance_path?: string;        // Path-based routing identifier
  instance_token_hash?: string;  // Hash of instance token
  installation_name: string;     // e.g., "context7-john-user123-R36no6FGoMFEZO9nWJJLT" (includes user_id)
  team_id: string;              // Team UUID
  team_slug: string;            // Team slug for identification
  user_id?: string;             // User ID that owns this instance (per-user process)
  server_slug: string;          // Server slug (e.g., "sequential", "brightdata-mcp-1")
  command: string;              // "npx" for Node.js packages
  args: string[];               // ["-y", "@upstash/context7"]
  env: Record<string, string>;  // Environment variables from three-tier config
  source?: 'manual' | 'github' | 'official_registry' | null; // Server source (for GitHub detection)
  language?: string;            // Programming language (e.g., "typescript", "python", "go")
  runtime?: string;             // Runtime environment (e.g., "node", "python", "docker")
  temp_dir?: string;            // Temporary directory path (for GitHub deployments, cleanup on termination)
  // GitHub deployment fields for dynamic args reconstruction
  git_commit_sha?: string;      // Current commit SHA for GitHub deployments (used to reconstruct args with latest SHA)
  repository_url?: string;      // GitHub repository URL
  git_branch?: string;          // Git branch name
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
  isUninstallShutdown?: boolean;        // Flag for intentional uninstall termination (skip crash detection)
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
