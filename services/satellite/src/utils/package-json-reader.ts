/**
 * Package.json reading and validation utilities
 *
 * Extracted from github-deployment.ts to reduce code duplication.
 * Provides helpers for reading and validating package.json files.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Package.json structure (partial)
 */
export interface PackageJson {
  name?: string;
  version?: string;
  scripts?: Record<string, string>;
  bin?: string | Record<string, string>;
  main?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * Read and parse package.json from a directory
 *
 * @param tempDir - Directory containing package.json
 * @returns Parsed package.json object
 * @throws Error if file doesn't exist or JSON is invalid
 */
export async function readPackageJson(tempDir: string): Promise<PackageJson> {
  const packageJsonPath = path.join(tempDir, 'package.json');
  const packageJsonContent = await fs.readFile(packageJsonPath, 'utf8');
  return JSON.parse(packageJsonContent) as PackageJson;
}

/**
 * Check if package.json has a build script
 *
 * @param tempDir - Directory containing package.json
 * @returns true if build script exists, false otherwise
 */
export async function hasBuildScript(tempDir: string): Promise<boolean> {
  try {
    const packageJson = await readPackageJson(tempDir);
    return !!packageJson.scripts?.build;
  } catch {
    return false;
  }
}

/**
 * Get build script command from package.json
 *
 * @param tempDir - Directory containing package.json
 * @returns Build script command or null if not found
 */
export async function getBuildScript(tempDir: string): Promise<string | null> {
  try {
    const packageJson = await readPackageJson(tempDir);
    return packageJson.scripts?.build || null;
  } catch {
    return null;
  }
}
