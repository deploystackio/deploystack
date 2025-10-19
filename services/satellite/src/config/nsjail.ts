/**
 * nsjail Resource Limits Configuration
 * These limits apply only in production on Linux platforms when nsjail isolation is enabled
 * 
 * Defaults based on empirical testing with npx and Node.js V8 requirements:
 * - 2048MB memory: Absolute minimum for V8 initialization (cannot be reduced)
 * - 1000 processes: Sufficient for npm operations which spawn many child processes
 * - 1024 file descriptors: Adequate for file I/O operations
 * - 50MB file size: Prevents oversized downloads while accommodating 99% of npm packages
 * - 100MB tmpfs: Sufficient for npm cache operations
 */
export const nsjailConfig = {
  /** Memory limit per MCP server process in MB (default: 2048, V8 minimum) */
  memoryLimitMB: parseInt(process.env.NSJAIL_MEMORY_LIMIT_MB || '2048', 10),
  
  /** CPU time limit per MCP server process in seconds (default: 60) */
  cpuTimeLimitSeconds: parseInt(process.env.NSJAIL_CPU_TIME_LIMIT_SECONDS || '60', 10),
  
  /** Maximum number of processes per MCP server (default: 1000, required for npm) */
  maxProcesses: parseInt(process.env.NSJAIL_MAX_PROCESSES || '1000', 10),
  
  /** Maximum number of open file descriptors (default: 1024) */
  maxOpenFiles: parseInt(process.env.NSJAIL_RLIMIT_NOFILE || '1024', 10),
  
  /** Maximum file size in MB (default: 50, prevents oversized npm downloads) */
  maxFileSizeMB: parseInt(process.env.NSJAIL_RLIMIT_FSIZE || '50', 10),
  
  /** Tmpfs size for /tmp directory (default: 100M) */
  tmpfsSize: process.env.NSJAIL_TMPFS_SIZE || '100M'
};

/**
 * MCP Cache Base Directory
 * Base directory for MCP server cache storage
 * In production: /opt/deploystack (deploystack user's home)
 * Falls back to /opt/deploystack if HOME is not set
 */
export const mcpCacheBaseDir = process.env.HOME || '/opt/deploystack';
