/**
 * nsjail Resource Limits Configuration
 * These limits apply only in production on Linux platforms when nsjail isolation is enabled
 *
 * Defaults based on empirical testing with package managers (npm, uvx) and runtime requirements:
 * - 2048MB virtual memory (RLIMIT_AS): Fallback for systems without cgroup support
 * - 512MB physical memory (cgroup_mem_max): Precise control over actual memory usage
 * - 1000 processes: Adequate for package managers which spawn many child processes
 * - 1024 file descriptors: Adequate for file I/O operations
 * - 50MB file size: Prevents oversized downloads while accommodating most packages
 * - 100MB tmpfs: Sufficient for package manager cache operations
 */
export const nsjailConfig = {
  /** Memory limit per MCP server process in MB (default: 2048, sufficient for most runtimes) */
  memoryLimitMB: parseInt(process.env.NSJAIL_MEMORY_LIMIT_MB || '2048', 10),

  /** Cgroup physical memory limit in bytes (default: 512MB = 536870912 bytes) */
  cgroupMemMaxBytes: parseInt(process.env.NSJAIL_CGROUP_MEM_MAX_BYTES || '536870912', 10),

  /** CPU time limit per MCP server process in seconds (default: 60) */
  cpuTimeLimitSeconds: parseInt(process.env.NSJAIL_CPU_TIME_LIMIT_SECONDS || '60', 10),

  /** Maximum number of processes per MCP server (default: 1000, required for package managers) */
  maxProcesses: parseInt(process.env.NSJAIL_MAX_PROCESSES || '1000', 10),

  /** Cgroup max PIDs (default: 1000) */
  cgroupPidsMax: parseInt(process.env.NSJAIL_CGROUP_PIDS_MAX || '1000', 10),

  /** Maximum number of open file descriptors (default: 1024) */
  maxOpenFiles: parseInt(process.env.NSJAIL_RLIMIT_NOFILE || '1024', 10),

  /** Maximum file size in MB (default: 50, prevents oversized package downloads) */
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

/**
 * Blocked Environment Variables
 * These env vars are stripped from user-provided config before passing to nsjail.
 * They can be exploited for code injection, library hijacking, or privilege escalation.
 */
export const BLOCKED_ENV_VARS = new Set([
  // Linux dynamic linker (affects ALL processes)
  'LD_PRELOAD',           // Shared library injection - most dangerous
  'LD_LIBRARY_PATH',      // Library search path hijacking
  'LD_AUDIT',             // Audit library injection
  'LD_DEBUG',             // Debug output manipulation
  'LD_DEBUG_OUTPUT',      // Debug output file
  'LD_PROFILE',           // Profiling library injection
  'LD_SHOW_AUXV',         // Auxiliary vector exposure
  'LD_DYNAMIC_WEAK',      // Weak symbol manipulation

  // Node.js specific
  'NODE_OPTIONS',         // Can inject --require, --inspect, etc.
  'NODE_REPL_EXTERNAL_MODULE', // External module loading
  'NODE_EXTRA_CA_CERTS',  // Could point to malicious CA cert
  'NODE_PATH',            // Module resolution hijacking
  'NODE_REDIRECT_WARNINGS', // Warning output redirection

  // Python specific
  'PYTHONSTARTUP',        // Executes script on Python interpreter start
  'PYTHONPATH',           // Module resolution hijacking
  'PYTHONHOME',           // Python installation path hijacking
  'PYTHONWARNINGS',       // Warning behavior manipulation
  'PYTHONDEBUG',          // Debug mode enabling
  'PYTHONINSPECT',        // Forces interactive mode after script
  'PYTHONUSERSITE',       // User site-packages manipulation
  'PYTHONEXECUTABLE',     // Executable path override
  'PYTHONHASHSEED',       // Hash randomization control

  // Shell injection (if any subprocess spawns shell)
  'BASH_ENV',             // Executed on non-interactive bash start
  'ENV',                  // Executed on sh start
  'ZDOTDIR',              // Zsh config directory override
  'SHELL',                // Default shell override

  // Path and temp manipulation (already set by nsjail)
  'PATH',                 // Already controlled by nsjail
  'HOME',                 // Already set by nsjail
  'TMPDIR',               // Could redirect temp to attacker location
  'TMP',                  // Windows-style temp
  'TEMP',                 // Windows-style temp

  // Misc dangerous
  'IFS',                  // Shell word splitting manipulation
]);

// Re-export security validation for convenience
export {
  ALLOWED_COMMANDS,
  COMMAND_PATHS,
  validateCommand,
  validateArgs,
  validateStdioConfig,
  resolveCommandPath
} from './security-validation';
