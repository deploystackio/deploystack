/**
 * Build script validation for GitHub deployments
 *
 * Validates build scripts for security risks before accepting deployments.
 * Works for Node.js (package.json scripts) and Python (pyproject.toml).
 *
 * This is the first layer of defense - backend validation before accepting deployment.
 * The satellite re-validates as defense-in-depth before execution.
 */

/**
 * Dangerous patterns that indicate potential malicious activity in build scripts.
 * These patterns block common attack vectors:
 * - Network exfiltration (curl, wget, netcat)
 * - Shell execution (bash -c, sh -c)
 * - Code execution from strings (eval, exec, python -c)
 * - Encoding for obfuscation (base64)
 * - Environment variable exfiltration
 * - Dangerous system operations
 */
const BLOCKED_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
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

export interface ScriptValidationResult {
  valid: boolean;
  error?: string;
  blockedPatterns?: Array<{ location: string; pattern: string; reason: string }>;
}

/**
 * Validate Node.js package.json scripts for security risks
 *
 * @param scripts - The scripts object from package.json
 * @returns Validation result with blocked patterns if any
 */
export function validateNodeScripts(
  scripts: Record<string, string> | undefined
): ScriptValidationResult {
  if (!scripts) {
    return { valid: true };
  }

  const blockedPatterns: Array<{ location: string; pattern: string; reason: string }> = [];

  for (const [name, content] of Object.entries(scripts)) {
    if (!content || typeof content !== 'string') continue;

    for (const { pattern, reason } of BLOCKED_PATTERNS) {
      if (pattern.test(content)) {
        blockedPatterns.push({
          location: `scripts.${name}`,
          pattern: pattern.source,
          reason
        });
      }
    }
  }

  if (blockedPatterns.length > 0) {
    const locations = blockedPatterns.map(p => p.location).join(', ');
    return {
      valid: false,
      error: `Dangerous patterns detected in npm scripts: ${locations}. Build scripts cannot contain network commands, shell execution, or code evaluation.`,
      blockedPatterns
    };
  }

  return { valid: true };
}

/**
 * Validate Python project files for security risks
 *
 * Note: Python has many ways to run code during install, so this is best-effort.
 * The main risks are:
 * - setup.py: Can run arbitrary Python code during pip install
 * - Build hooks: Can execute code during package building
 *
 * @param pyprojectContent - Content of pyproject.toml (if exists)
 * @param hasSetupPy - Whether setup.py exists in the repository
 * @returns Validation result with blocked patterns if any
 */
export function validatePythonProject(
  pyprojectContent: string | undefined,
  hasSetupPy: boolean
): ScriptValidationResult {
  const blockedPatterns: Array<{ location: string; pattern: string; reason: string }> = [];

  // setup.py is inherently dangerous - it runs arbitrary Python during install
  if (hasSetupPy) {
    blockedPatterns.push({
      location: 'setup.py',
      pattern: 'setup.py exists',
      reason: 'setup.py can run arbitrary code during pip install. Use pyproject.toml instead.'
    });
  }

  if (pyprojectContent) {
    // Check for build hooks that can run arbitrary code
    if (/\[tool\.hatch\.build\.hooks/.test(pyprojectContent)) {
      blockedPatterns.push({
        location: 'pyproject.toml',
        pattern: '[tool.hatch.build.hooks]',
        reason: 'hatch build hooks can execute arbitrary code during build'
      });
    }

    // Check for setuptools build hooks
    if (/\[tool\.setuptools\.cmdclass\]/.test(pyprojectContent)) {
      blockedPatterns.push({
        location: 'pyproject.toml',
        pattern: '[tool.setuptools.cmdclass]',
        reason: 'setuptools cmdclass can execute arbitrary code during build'
      });
    }

    // Check for dangerous patterns in the content
    for (const { pattern, reason } of BLOCKED_PATTERNS) {
      if (pattern.test(pyprojectContent)) {
        blockedPatterns.push({
          location: 'pyproject.toml',
          pattern: pattern.source,
          reason
        });
      }
    }
  }

  if (blockedPatterns.length > 0) {
    const locations = [...new Set(blockedPatterns.map(p => p.location))].join(', ');
    return {
      valid: false,
      error: `Dangerous patterns detected in Python project: ${locations}. Projects with setup.py or build hooks are not allowed for security reasons.`,
      blockedPatterns
    };
  }

  return { valid: true };
}

/**
 * Get the list of blocked patterns (for documentation/testing)
 */
export function getBlockedPatterns(): Array<{ pattern: RegExp; reason: string }> {
  return [...BLOCKED_PATTERNS];
}
