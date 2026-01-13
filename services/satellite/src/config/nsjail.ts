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
