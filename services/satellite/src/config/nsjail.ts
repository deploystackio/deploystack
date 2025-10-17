/**
 * nsjail Resource Limits Configuration
 * These limits apply only in production on Linux platforms when nsjail isolation is enabled
 */
export const nsjailConfig = {
  /** Memory limit per MCP server process in MB (default: 50) */
  memoryLimitMB: parseInt(process.env.NSJAIL_MEMORY_LIMIT_MB || '50', 10),
  
  /** CPU time limit per MCP server process in seconds (default: 60) */
  cpuTimeLimitSeconds: parseInt(process.env.NSJAIL_CPU_TIME_LIMIT_SECONDS || '60', 10),
  
  /** Maximum number of processes per MCP server (default: 50) */
  maxProcesses: parseInt(process.env.NSJAIL_MAX_PROCESSES || '50', 10)
};
