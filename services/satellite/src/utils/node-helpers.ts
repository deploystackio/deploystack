/**
 * Node.js deployment utilities
 *
 * Extracted from github-deployment.ts to reduce file size and improve maintainability.
 * Contains GitHub URL parsing, package entry point resolution, and runtime detection.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Parsed GitHub repository information
 */
export interface GitHubInfo {
  owner: string;
  repo: string;
  ref: string;
}

/**
 * Optional logger interface for dependency injection
 */
interface Logger {
  trace?: (obj: unknown, msg?: string) => void;
  debug?: (obj: unknown, msg?: string) => void;
  info?: (obj: unknown, msg?: string) => void;
  warn?: (obj: unknown, msg?: string) => void;
  error?: (obj: unknown, msg?: string) => void;
  fatal?: (obj: unknown, msg?: string) => void;
}

/**
 * Helper: Check if file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse GitHub URL from package manager arguments
 *
 * Supports two formats:
 * 1. npm/npx format: github:owner/repo#ref
 * 2. Python/uvx format: git+https://github.com/owner/repo.git@ref
 *
 * @param command - Package manager command (npx, uvx)
 * @param args - Command arguments containing GitHub URL
 * @param logger - Optional logger for warnings
 * @returns Parsed GitHub info or null if parsing fails
 */
export function parseGitHubUrl(
  command: string,
  args: string[],
  logger?: Logger
): GitHubInfo | null {
  // Check if this is a supported package manager command
  const supportedCommands = ['npx', 'uvx'];
  if (!supportedCommands.includes(command)) {
    return null;
  }

  // Try npm/npx format: github:owner/repo#ref
  const githubArg = args.find(arg => arg.startsWith('github:'));
  if (githubArg) {
    const match = githubArg.match(/^github:([^/]+)\/([^#]+)#(.+)$/);
    if (match) {
      return {
        owner: match[1],
        repo: match[2],
        ref: match[3]
      };
    }
  }

  // Try Python/uvx format: git+https://github.com/owner/repo.git@ref
  const gitPlusArg = args.find(arg => arg.startsWith('git+https://github.com/'));
  if (gitPlusArg) {
    const match = gitPlusArg.match(/^git\+https:\/\/github\.com\/([^/]+)\/([^.]+)\.git@(.+)$/);
    if (match) {
      return {
        owner: match[1],
        repo: match[2],
        ref: match[3]
      };
    }
  }

  logger?.warn?.({
    operation: 'github_url_parse_failed',
    args,
    command
  }, `Failed to parse GitHub URL from ${command} arguments`);

  return null;
}

/**
 * Resolve Node.js package entry point from package.json
 *
 * Resolution order:
 * 1. package.json `bin` field (string or object)
 * 2. package.json `main` field
 * 3. Throws error if none found
 *
 * @param tempDir - Deployment directory containing package.json
 * @param logger - Optional logger for debug/info messages
 * @returns Absolute path to entry point
 * @throws Error if no valid entry point found
 */
export async function resolvePackageEntry(
  tempDir: string,
  logger?: Logger
): Promise<string> {
  logger?.debug?.({
    operation: 'package_entry_resolve_start',
    temp_dir: tempDir
  }, 'Resolving package entry point from package.json');

  try {
    const packageJsonPath = path.join(tempDir, 'package.json');
    const packageJsonContent = await fs.readFile(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(packageJsonContent);

    // Check for bin field (can be string or object)
    if (packageJson.bin) {
      let entryPoint: string;

      if (typeof packageJson.bin === 'string') {
        // bin: "dist/index.js"
        entryPoint = packageJson.bin;
      } else if (typeof packageJson.bin === 'object') {
        // bin: { "server-name": "dist/index.js" }
        // Use the first entry
        const binEntries = Object.values(packageJson.bin);
        if (binEntries.length === 0) {
          throw new Error('bin field is empty object');
        }
        entryPoint = binEntries[0] as string;
      } else {
        throw new Error(`Invalid bin field type: ${typeof packageJson.bin}`);
      }

      const absolutePath = path.join(tempDir, entryPoint);

      logger?.info?.({
        operation: 'package_entry_resolved',
        temp_dir: tempDir,
        entry_point: entryPoint,
        absolute_path: absolutePath
      }, `Resolved package entry point: ${entryPoint}`);

      return absolutePath;
    }

    // Fallback to main field
    if (packageJson.main) {
      const absolutePath = path.join(tempDir, packageJson.main);

      logger?.info?.({
        operation: 'package_entry_resolved_main',
        temp_dir: tempDir,
        main: packageJson.main,
        absolute_path: absolutePath
      }, `Using main field as entry point: ${packageJson.main}`);

      return absolutePath;
    }

    throw new Error('No bin or main field found in package.json');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger?.error?.({
      operation: 'package_entry_resolve_failed',
      temp_dir: tempDir,
      error: errorMessage
    }, 'Failed to resolve package entry point');

    throw new Error(`Failed to resolve package entry point: ${errorMessage}`);
  }
}

/**
 * Detect runtime from repository files
 *
 * Detection order:
 * 1. package.json → Node.js
 * 2. pyproject.toml or requirements.txt → Python
 * 3. Otherwise → unknown
 *
 * @param tempDir - Deployment directory
 * @returns Runtime type: 'node', 'python', or 'unknown'
 */
export async function detectRuntime(tempDir: string): Promise<'node' | 'python' | 'unknown'> {
  // Check for Node.js
  if (await fileExists(path.join(tempDir, 'package.json'))) {
    return 'node';
  }

  // Check for Python
  if (await fileExists(path.join(tempDir, 'pyproject.toml')) ||
      await fileExists(path.join(tempDir, 'requirements.txt'))) {
    return 'python';
  }

  return 'unknown';
}
