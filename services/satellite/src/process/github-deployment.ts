import { spawn } from 'child_process';
import { mkdir } from 'fs/promises';
import * as tar from 'tar';
import * as path from 'path';
import * as fs from 'fs';
import { Octokit } from '@octokit/rest';
import { Logger } from 'pino';
import { MCPServerConfig } from './types';
import { LogBuffer } from './log-buffer';
import type { BackendClient } from '../services/backend-client';

/**
 * Parsed GitHub repository information
 */
export interface GitHubInfo {
  owner: string;
  repo: string;
  ref: string;
}

/**
 * GitHubDeploymentHandler manages GitHub repository deployments
 * Handles downloading, extracting, building, and preparing MCP servers from GitHub
 */
export class GitHubDeploymentHandler {
  constructor(
    private logger: Logger,
    private logBuffer: LogBuffer,
    private backendClient?: BackendClient
  ) {}

  /**
   * Parse GitHub URL from package manager arguments
   * Supports: github:owner/repo#ref (for npx and uvx)
   */
  parseGitHubUrl(command: string, args: string[]): GitHubInfo | null {
    // Check if this is a supported package manager command with GitHub shorthand
    const supportedCommands = ['npx', 'uvx'];
    if (!supportedCommands.includes(command)) {
      return null;
    }

    // Find the github: argument (skip -y or other flags)
    const githubArg = args.find(arg => arg.startsWith('github:'));
    if (!githubArg) {
      return null;
    }

    // Parse github:owner/repo#ref
    const match = githubArg.match(/^github:([^/]+)\/([^#]+)#(.+)$/);
    if (!match) {
      this.logger.warn({
        operation: 'github_url_parse_failed',
        github_arg: githubArg,
        command: command
      }, `Failed to parse GitHub URL from ${command} arguments`);
      return null;
    }

    return {
      owner: match[1],
      repo: match[2],
      ref: match[3]
    };
  }

  /**
   * Check if a config requires GitHub deployment
   * Supports both Node.js (npx) and Python (uvx) runtimes
   */
  isGitHubDeployment(config: MCPServerConfig): boolean {
    const supportedCommands = ['npx', 'uvx'];
    return config.source === 'github' &&
           supportedCommands.includes(config.command) &&
           !!this.backendClient;
  }

  /**
   * Download GitHub repository as tarball using Octokit
   * Includes retry logic with exponential backoff
   */
  async downloadRepository(
    owner: string,
    repo: string,
    ref: string,
    token: string,
    maxRetries = 3
  ): Promise<Buffer> {
    const octokit = new Octokit({ auth: token });

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.debug({
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

        this.logger.info({
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

        this.logger.error({
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
   * Extract tarball to temporary directory
   */
  async extractTarball(tarballBuffer: Buffer, tempDir: string): Promise<void> {
    this.logger.debug({
      operation: 'tarball_extract_start',
      temp_dir: tempDir,
      tarball_size: tarballBuffer.length
    }, 'Extracting tarball to temporary directory');

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

      this.logger.debug({
        operation: 'tarball_extract_success',
        temp_dir: tempDir
      }, 'Tarball extracted successfully');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.error({
        operation: 'tarball_extract_failed',
        temp_dir: tempDir,
        error: errorMessage
      }, 'Failed to extract tarball');

      throw new Error(`Failed to extract tarball: ${errorMessage}`);
    }
  }

  /**
   * Install dependencies in extracted repository
   */
  async installDependencies(
    tempDir: string,
    installationId: string,
    teamId: string,
    userId?: string
  ): Promise<void> {
    this.logger.debug({
      operation: 'npm_install_start',
      temp_dir: tempDir
    }, 'Installing dependencies with npm install --omit=dev');

    return new Promise((resolve, reject) => {
      const npmInstall = spawn('npm', ['install', '--omit=dev'], {
        cwd: tempDir,
        stdio: 'pipe'
      });

      let stderr = '';

      // Capture and emit stdout to backend
      npmInstall.stdout.on('data', (data) => {
        const output = data.toString().trim();
        if (output) {
          this.logBuffer.add({
            installation_id: installationId,
            team_id: teamId,
            user_id: userId,
            level: 'info',
            message: `[npm install] ${output}`,
            timestamp: new Date().toISOString()
          });
        }
      });

      npmInstall.stderr.on('data', (data) => {
        const output = data.toString().trim();
        stderr += output;

        // Also emit stderr as warn logs
        if (output) {
          this.logBuffer.add({
            installation_id: installationId,
            team_id: teamId,
            user_id: userId,
            level: 'warn',
            message: `[npm install] ${output}`,
            timestamp: new Date().toISOString()
          });
        }
      });

      npmInstall.on('exit', (code) => {
        if (code === 0) {
          this.logger.info({
            operation: 'npm_install_success',
            temp_dir: tempDir
          }, 'Dependencies installed successfully');
          resolve();
        } else {
          this.logger.error({
            operation: 'npm_install_failed',
            temp_dir: tempDir,
            exit_code: code,
            stderr: stderr.substring(0, 500) // Limit stderr output
          }, `npm install failed with code ${code}`);

          reject(new Error(`npm install failed with code ${code}: ${stderr.substring(0, 200)}`));
        }
      });

      npmInstall.on('error', (error) => {
        this.logger.error({
          operation: 'npm_install_error',
          temp_dir: tempDir,
          error: error.message
        }, 'npm install process error');

        reject(new Error(`npm install process error: ${error.message}`));
      });
    });
  }

  /**
   * Build package if build script exists
   */
  async buildPackage(
    tempDir: string,
    installationId: string,
    teamId: string,
    userId?: string
  ): Promise<void> {
    try {
      // Read package.json to check for build script
      const packageJsonPath = path.join(tempDir, 'package.json');
      const packageJsonContent = await fs.promises.readFile(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(packageJsonContent);

      // Check if there's a build script
      if (!packageJson.scripts?.build) {
        this.logger.debug({
          operation: 'npm_build_skip',
          temp_dir: tempDir
        }, 'No build script found, skipping build');

        // Emit log to backend so users know build was skipped
        this.logBuffer.add({
          installation_id: installationId,
          team_id: teamId,
          user_id: userId,
          level: 'info',
          message: '[npm build] No build script found, skipping build',
          timestamp: new Date().toISOString()
        });

        return;
      }

      this.logger.debug({
        operation: 'npm_build_start',
        temp_dir: tempDir
      }, 'Building package with npm run build');

      return new Promise((resolve, reject) => {
        const npmBuild = spawn('npm', ['run', 'build'], {
          cwd: tempDir,
          stdio: 'pipe'
        });

        let stderr = '';

        // Capture and emit stdout to backend
        npmBuild.stdout.on('data', (data) => {
          const output = data.toString().trim();
          if (output) {
            this.logBuffer.add({
              installation_id: installationId,
              team_id: teamId,
              user_id: userId,
              level: 'info',
              message: `[npm build] ${output}`,
              timestamp: new Date().toISOString()
            });
          }
        });

        npmBuild.stderr.on('data', (data) => {
          const output = data.toString().trim();
          stderr += output;

          // Also emit stderr as warn logs
          if (output) {
            this.logBuffer.add({
              installation_id: installationId,
              team_id: teamId,
              user_id: userId,
              level: 'warn',
              message: `[npm build] ${output}`,
              timestamp: new Date().toISOString()
            });
          }
        });

        npmBuild.on('exit', (code) => {
          if (code === 0) {
            this.logger.info({
              operation: 'npm_build_success',
              temp_dir: tempDir
            }, 'Package built successfully');
            resolve();
          } else {
            this.logger.error({
              operation: 'npm_build_failed',
              temp_dir: tempDir,
              exit_code: code,
              stderr: stderr.substring(0, 500)
            }, `npm run build failed with code ${code}`);

            reject(new Error(`npm run build failed with code ${code}: ${stderr.substring(0, 200)}`));
          }
        });

        npmBuild.on('error', (error) => {
          this.logger.error({
            operation: 'npm_build_error',
            temp_dir: tempDir,
            error: error.message
          }, 'npm run build process error');

          reject(new Error(`npm run build process error: ${error.message}`));
        });
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.error({
        operation: 'npm_build_check_failed',
        temp_dir: tempDir,
        error: errorMessage
      }, 'Failed to check for build script');

      throw new Error(`Failed to check for build script: ${errorMessage}`);
    }
  }

  /**
   * Resolve package entry point from package.json
   */
  async resolvePackageEntry(tempDir: string): Promise<string> {
    this.logger.debug({
      operation: 'package_entry_resolve_start',
      temp_dir: tempDir
    }, 'Resolving package entry point from package.json');

    try {
      const packageJsonPath = path.join(tempDir, 'package.json');
      const packageJsonContent = await fs.promises.readFile(packageJsonPath, 'utf8');
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

        this.logger.info({
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

        this.logger.info({
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

      this.logger.error({
        operation: 'package_entry_resolve_failed',
        temp_dir: tempDir,
        error: errorMessage
      }, 'Failed to resolve package entry point');

      throw new Error(`Failed to resolve package entry point: ${errorMessage}`);
    }
  }

  /**
   * Prepare a GitHub deployment - downloads, extracts, builds, and updates config
   * Returns the updated config with local paths
   */
  async prepareDeployment(config: MCPServerConfig): Promise<MCPServerConfig> {
    if (!this.backendClient) {
      throw new Error('BackendClient not available for GitHub deployment');
    }

    this.logger.info({
      operation: 'github_deployment_detected',
      installation_name: config.installation_name,
      installation_id: config.installation_id,
      command: config.command,
      runtime: config.runtime || 'unknown',
      args: config.args
    }, `GitHub deployment detected (${config.runtime || 'unknown'} runtime), downloading repository via Octokit`);

    // Parse GitHub URL from package manager arguments
    const githubInfo = this.parseGitHubUrl(config.command, config.args || []);
    if (!githubInfo) {
      throw new Error('Failed to parse GitHub URL from NPX arguments');
    }

    this.logger.debug({
      operation: 'github_url_parsed',
      owner: githubInfo.owner,
      repo: githubInfo.repo,
      ref: githubInfo.ref
    }, `Parsed GitHub URL: ${githubInfo.owner}/${githubInfo.repo}#${githubInfo.ref}`);

    // Fetch GitHub App installation token
    const tokenResult = await this.backendClient.fetchGitHubToken(config.installation_id);
    if (!tokenResult || !tokenResult.token) {
      throw new Error('Failed to fetch GitHub token for private repository deployment');
    }

    this.logger.debug({
      operation: 'github_token_fetched',
      installation_id: config.installation_id,
      expires_at: tokenResult.expires_at
    }, 'GitHub token fetched successfully');

    // Download repository as tarball
    const tarballBuffer = await this.downloadRepository(
      githubInfo.owner,
      githubInfo.repo,
      githubInfo.ref,
      tokenResult.token
    );

    // Create temp directory
    const { v4: uuidv4 } = await import('uuid');
    const tempDir = `/tmp/mcp-${uuidv4()}`;
    this.logger.debug({
      operation: 'temp_dir_created',
      temp_dir: tempDir
    }, `Created temp directory: ${tempDir}`);

    // Extract tarball
    await this.extractTarball(tarballBuffer, tempDir);

    // Install dependencies
    await this.installDependencies(tempDir, config.installation_id, config.team_id, config.user_id);

    // Build package if build script exists
    await this.buildPackage(tempDir, config.installation_id, config.team_id, config.user_id);

    // Resolve package entry point
    const entryPoint = await this.resolvePackageEntry(tempDir);

    // Return updated config to run from local directory
    const updatedConfig: MCPServerConfig = {
      ...config,
      command: 'node',
      args: [entryPoint],
      temp_dir: tempDir
    };

    this.logger.info({
      operation: 'github_deployment_ready',
      installation_name: config.installation_name,
      temp_dir: tempDir,
      entry_point: entryPoint
    }, 'GitHub repository downloaded and ready to spawn');

    return updatedConfig;
  }
}
