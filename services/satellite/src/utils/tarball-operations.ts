/**
 * Tarball operations for GitHub repository deployments
 *
 * Extracted from github-deployment.ts to reduce file size and improve maintainability.
 * Contains download and extraction logic for GitHub repository tarballs.
 */

import { Octokit } from '@octokit/rest';
import * as tar from 'tar';
import * as path from 'path';
import * as fs from 'fs';
import { mkdir } from 'fs/promises';

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
 * Optional TmpfsManager interface for tmpfs detection
 */
interface TmpfsManager {
  isTmpfs(dirPath: string): Promise<boolean>;
}

/**
 * Download GitHub repository as tarball using Octokit
 *
 * Includes retry logic with exponential backoff to handle transient network failures.
 *
 * @param owner - GitHub repository owner
 * @param repo - GitHub repository name
 * @param ref - Git reference (commit hash, branch, or tag)
 * @param token - GitHub authentication token
 * @param logger - Optional logger for debug/info/error messages
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @returns Buffer containing the tarball data
 * @throws Error if download fails after all retries
 */
export async function downloadRepository(
  owner: string,
  repo: string,
  ref: string,
  token?: string,
  logger?: Logger,
  maxRetries = 3
): Promise<Buffer> {
  const octokit = token ? new Octokit({ auth: token }) : new Octokit();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger?.debug?.({
        operation: 'github_tarball_download_start',
        owner,
        repo,
        ref,
        attempt,
        max_retries: maxRetries
      }, `Downloading GitHub repository tarball (attempt ${attempt}/${maxRetries})`);

      const response = await octokit.request('GET /repos/{owner}/{repo}/tarball/{ref}', {
        owner,
        repo,
        ref,
        request: {
          parseSuccessResponseBody: false // Get raw response
        }
      });

      // Response.data is a ReadableStream - convert to Buffer
      let buffer: Buffer;

      if (response.data instanceof ReadableStream) {
        // Convert ReadableStream to Buffer
        const reader = response.data.getReader();
        const chunks: Uint8Array[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }

        buffer = Buffer.concat(chunks);
      } else if (response.data instanceof ArrayBuffer) {
        buffer = Buffer.from(response.data);
      } else if (Buffer.isBuffer(response.data)) {
        buffer = response.data;
      } else {
        throw new Error(`Unexpected response data type: ${typeof response.data}`);
      }

      logger?.info?.({
        operation: 'github_tarball_download_success',
        owner,
        repo,
        ref,
        size_bytes: buffer.length,
        attempt
      }, `Downloaded GitHub repository tarball (${(buffer.length / 1024).toFixed(2)} KB)`);

      return buffer;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger?.error?.({
        operation: 'github_tarball_download_failed',
        owner,
        repo,
        ref,
        attempt,
        max_retries: maxRetries,
        error: errorMessage
      }, `Failed to download GitHub repository tarball (attempt ${attempt}/${maxRetries})`);

      if (attempt === maxRetries) {
        throw new Error(`Failed to download GitHub repository after ${maxRetries} attempts: ${errorMessage}`);
      }

      // Exponential backoff: 1s, 2s, 4s
      const backoffMs = Math.pow(2, attempt - 1) * 1000;
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }

  throw new Error('Unreachable: maxRetries exhausted');
}

/**
 * Extract tarball to deployment directory
 *
 * Handles GitHub tarball structure (with root directory) and supports both
 * tmpfs and regular filesystem deployments.
 *
 * @param tarballBuffer - Buffer containing the tarball data
 * @param tempDir - Deployment directory path
 * @param logger - Optional logger for debug/error messages
 * @param tmpfsManager - Optional tmpfs manager for tmpfs detection
 * @throws Error if extraction fails
 */
export async function extractTarball(
  tarballBuffer: Buffer,
  tempDir: string,
  logger?: Logger,
  tmpfsManager?: TmpfsManager
): Promise<void> {
  const isTmpfs = tmpfsManager ? await tmpfsManager.isTmpfs(tempDir) : false;

  logger?.debug?.({
    operation: 'tarball_extract_start',
    temp_dir: tempDir,
    tarball_size: tarballBuffer.length,
    is_tmpfs: isTmpfs
  }, `Extracting tarball to ${isTmpfs ? 'tmpfs' : 'filesystem'} directory`);

  try {
    // Create temp directory
    await mkdir(tempDir, { recursive: true });

    // Write tarball to temp file (tar.extract needs a file path)
    const tarballPath = path.join(tempDir, 'repo.tar.gz');
    await fs.promises.writeFile(tarballPath, tarballBuffer);

    // Extract tarball (GitHub tarballs have a root directory, so strip it)
    await tar.extract({
      file: tarballPath,
      cwd: tempDir,
      strip: 1 // Remove the root directory from GitHub tarball
    });

    // Remove the tarball file
    await fs.promises.unlink(tarballPath);

    logger?.debug?.({
      operation: 'tarball_extract_success',
      temp_dir: tempDir
    }, 'Tarball extracted successfully');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger?.error?.({
      operation: 'tarball_extract_failed',
      temp_dir: tempDir,
      error: errorMessage
    }, 'Failed to extract tarball');

    throw new Error(`Failed to extract tarball: ${errorMessage}`);
  }
}
