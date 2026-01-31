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
import { ProcessSpawner } from './nsjail-spawner';
import { validateBuildScripts } from '../config/security-validation';
import { TmpfsManager } from '../lib/tmpfs-manager';
import { githubDeploymentBaseDir, nsjailConfig } from '../config/nsjail';
import { selectBestPythonForDeployment } from '../utils/runtime-validator';

/**
 * Parsed GitHub repository information
 */
export interface GitHubInfo {
  owner: string;
  repo: string;
  ref: string;
}

/**
 * Helper to check if a file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * GitHubDeploymentHandler manages GitHub repository deployments
 * Handles downloading, extracting, building, and preparing MCP servers from GitHub
 * Supports both Node.js and Python runtimes
 */
export class GitHubDeploymentHandler {
  private processSpawner: ProcessSpawner;
  private tmpfsManager: TmpfsManager;

  constructor(
    private logger: Logger,
    private logBuffer: LogBuffer,
    private backendClient?: BackendClient
  ) {
    this.processSpawner = new ProcessSpawner(logger);
    this.tmpfsManager = new TmpfsManager(logger);
  }

  /**
   * Parse GitHub URL from package manager arguments
   * Supports:
   *   - github:owner/repo#ref (for npx)
   *   - git+https://github.com/owner/repo.git@ref (for uvx/pip)
   */
  parseGitHubUrl(command: string, args: string[]): GitHubInfo | null {
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

    this.logger.warn({
      operation: 'github_url_parse_failed',
      args,
      command
    }, `Failed to parse GitHub URL from ${command} arguments`);
    return null;
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
    const isTmpfs = await this.tmpfsManager.isTmpfs(tempDir);

    this.logger.debug({
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
    }, 'Installing dependencies with npm install');

    // Use nsjail in production, direct spawn in development
    if (this.processSpawner.shouldUseNsjail()) {
      const result = await this.processSpawner.spawnBuildCommandWithNsjail(
        'npm',
        ['install'],
        tempDir,
        {
          allowNetwork: true,  // npm needs network for package downloads
          timeoutMs: 120000,   // 2 minutes
          runtime: 'node'
        }
      );

      // Emit logs to backend
      if (result.stdout) {
        this.logBuffer.add({
          installation_id: installationId,
          team_id: teamId,
          user_id: userId,
          level: 'info',
          message: `[npm install] ${result.stdout.substring(0, 1000)}`,
          timestamp: new Date().toISOString()
        });
      }

      if (result.code !== 0) {
        this.logBuffer.add({
          installation_id: installationId,
          team_id: teamId,
          user_id: userId,
          level: 'error',
          message: `[npm install] ${result.stderr.substring(0, 500)}`,
          timestamp: new Date().toISOString()
        });
        throw new Error(`npm install failed with code ${result.code}: ${result.stderr.substring(0, 200)}`);
      }

      this.logger.info({
        operation: 'npm_install_success',
        temp_dir: tempDir
      }, 'Dependencies installed successfully');
    } else {
      // Development mode - direct spawn
      return new Promise((resolve, reject) => {
        const npmInstall = spawn('npm', ['install'], {
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

      // Use nsjail in production, direct spawn in development
      if (this.processSpawner.shouldUseNsjail()) {
        const result = await this.processSpawner.spawnBuildCommandWithNsjail(
          'npm',
          ['run', 'build'],
          tempDir,
          {
            allowNetwork: false,  // Build should not need network
            timeoutMs: 120000,    // 2 minutes
            runtime: 'node'
          }
        );

        // Emit logs to backend
        if (result.stdout) {
          this.logBuffer.add({
            installation_id: installationId,
            team_id: teamId,
            user_id: userId,
            level: 'info',
            message: `[npm build] ${result.stdout.substring(0, 1000)}`,
            timestamp: new Date().toISOString()
          });
        }

        if (result.code !== 0) {
          this.logBuffer.add({
            installation_id: installationId,
            team_id: teamId,
            user_id: userId,
            level: 'error',
            message: `[npm build] ${result.stderr.substring(0, 500)}`,
            timestamp: new Date().toISOString()
          });
          throw new Error(`npm run build failed with code ${result.code}: ${result.stderr.substring(0, 200)}`);
        }

        this.logger.info({
          operation: 'npm_build_success',
          temp_dir: tempDir
        }, 'Package built successfully');
      } else {
        // Development mode - direct spawn
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
      }

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
   * Detect if pyproject.toml is a simple script (not installable package)
   *
   * A simple script is one that:
   * 1. Has no package structure (no src/ dir, no matching package dir), OR
   * 2. Has [build-system] but the build will fail due to missing structure
   *
   * We detect this by checking if common Python script files exist at root level
   * (server.py, main.py, app.py, __main__.py) - indicating it's meant to run directly
   */
  async isPyprojectSimpleScript(tempDir: string): Promise<boolean> {
    const pyprojectPath = path.join(tempDir, 'pyproject.toml');
    try {
      const content = await fs.promises.readFile(pyprojectPath, 'utf8');

      // Check if pyproject.toml has [build-system] section
      const hasBuildSystem = content.includes('[build-system]');

      // If no build-system, it's definitely a simple script (just dependency management)
      if (!hasBuildSystem) {
        return true;
      }

      // Has build-system - check if package structure exists
      // Look for src/ directory or package directory matching project name
      const hasSrcDir = await fileExists(path.join(tempDir, 'src'));

      // Extract package name from pyproject.toml
      const nameMatch = content.match(/^name\s*=\s*"([^"]+)"/m);
      const packageName = nameMatch ? nameMatch[1].replace(/-/g, '_') : null;
      const hasPackageDir = packageName ? await fileExists(path.join(tempDir, packageName)) : false;

      // If it has proper package structure (src/ or package dir), it's installable
      if (hasSrcDir || hasPackageDir) {
        return false;
      }

      // No package structure - check if there are standalone script files at root
      const scriptFiles = ['server.py', 'main.py', 'app.py', '__main__.py'];
      for (const scriptFile of scriptFiles) {
        if (await fileExists(path.join(tempDir, scriptFile))) {
          // Found a standalone script - treat as simple script
          this.logger.debug({
            operation: 'python_pattern_detected',
            pattern: 'simple_script',
            reason: `Found ${scriptFile} at root without package structure`,
            temp_dir: tempDir
          }, `Detected simple Python script pattern (${scriptFile} without package structure)`);
          return true;
        }
      }

      // Has build-system, has scripts, but no package structure and no standalone scripts
      // This will likely fail to build - treat as simple script to avoid build errors
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Install Python dependencies using uv or pip
   * Auto-detects three patterns:
   * 1. Installable package (pyproject.toml with [build-system] + [project.scripts])
   * 2. Simple script with pyproject.toml (just dependencies, no package structure)
   * 3. Legacy script with requirements.txt
   */
  async installPythonDependencies(
    tempDir: string,
    installationId: string,
    teamId: string,
    userId?: string
  ): Promise<void> {
    const hasPyproject = await fileExists(path.join(tempDir, 'pyproject.toml'));
    const hasRequirements = await fileExists(path.join(tempDir, 'requirements.txt'));

    if (!hasPyproject && !hasRequirements) {
      this.logger.info({
        operation: 'python_install_skip',
        temp_dir: tempDir
      }, 'No pyproject.toml or requirements.txt found, skipping install');

      this.logBuffer.add({
        installation_id: installationId,
        team_id: teamId,
        user_id: userId,
        level: 'info',
        message: '[python install] No dependency file found, skipping install',
        timestamp: new Date().toISOString()
      });

      return;
    }

    let command: string;
    let args: string[];
    let installMethod: string;

    // Determine installation method
    if (hasPyproject && !(await this.isPyprojectSimpleScript(tempDir))) {
      // Pattern 1: Installable package with pyproject.toml
      // Use uv sync to create venv and install package as editable
      command = 'uv';
      args = ['sync', '--no-dev'];
      installMethod = 'uv sync (installable package)';

      // Select best Python version for deployment
      const pythonSelection = selectBestPythonForDeployment(this.logger, '3.10');

      if (pythonSelection) {
        // Use selected Python version
        args.push('--python', pythonSelection.path);

        this.logger.info({
          operation: 'python_version_selected',
          selected_version: pythonSelection.version,
          selected_path: pythonSelection.path,
          reason: pythonSelection.reason,
          alternatives: pythonSelection.alternatives,
          skipped: pythonSelection.skipped
        }, `Selected Python ${pythonSelection.version} for GitHub deployment`);

        // Notify user via log buffer
        this.logBuffer.add({
          installation_id: installationId,
          team_id: teamId,
          user_id: userId,
          level: 'info',
          message: `[python install] Using Python ${pythonSelection.version} (${pythonSelection.reason})`,
          timestamp: new Date().toISOString()
        });
      } else {
        // Fallback to system default Python
        this.logger.warn({
          operation: 'python_version_fallback',
          reason: 'no_suitable_version_found'
        }, 'Using system default Python - build may fail due to missing wheels');

        this.logBuffer.add({
          installation_id: installationId,
          team_id: teamId,
          user_id: userId,
          level: 'warn',
          message: '[python install] Using system default Python (no suitable version found)',
          timestamp: new Date().toISOString()
        });
      }

      this.logger.debug({
        operation: 'python_install_start',
        temp_dir: tempDir,
        method: installMethod,
        args
      }, `Installing Python dependencies with ${installMethod}`);

    } else if (hasPyproject) {
      // Pattern 2: Simple script with pyproject.toml (no build-system or scripts)
      // Use uv pip to just install dependencies into venv
      command = 'uv';
      args = ['venv', '.venv'];
      installMethod = 'uv venv + uv pip (simple script)';

      const pythonSelection = selectBestPythonForDeployment(this.logger, '3.10');
      if (pythonSelection) {
        args.push('--python', pythonSelection.path);

        this.logBuffer.add({
          installation_id: installationId,
          team_id: teamId,
          user_id: userId,
          level: 'info',
          message: `[python install] Using Python ${pythonSelection.version} for simple script`,
          timestamp: new Date().toISOString()
        });
      }

      this.logger.debug({
        operation: 'python_install_start',
        temp_dir: tempDir,
        method: installMethod,
        pattern: 'simple_script_pyproject'
      }, 'Detected simple Python script with pyproject.toml (no build-system), creating venv');

    } else {
      // Pattern 3: Legacy Python with requirements.txt
      command = 'uv';
      args = ['venv', '.venv'];
      installMethod = 'uv venv + uv pip (requirements.txt)';

      this.logger.debug({
        operation: 'python_install_start',
        temp_dir: tempDir,
        method: installMethod,
        pattern: 'simple_script_requirements'
      }, 'Detected simple Python script with requirements.txt, creating venv');
    }

    // For simple scripts, we need two steps: 1) create venv, 2) install deps
    const isSimpleScript = installMethod.includes('simple script') || installMethod.includes('requirements.txt');

    // Use nsjail in production, direct spawn in development
    if (this.processSpawner.shouldUseNsjail()) {
      // Step 1: Create venv (for simple scripts) or sync (for packages)
      const result = await this.processSpawner.spawnBuildCommandWithNsjail(
        command,
        args,
        tempDir,
        {
          allowNetwork: true,  // Install needs network
          timeoutMs: 180000,   // 3 minutes for Python (larger packages)
          runtime: 'python'
        }
      );

      // Emit logs to backend
      if (result.stdout) {
        this.logBuffer.add({
          installation_id: installationId,
          team_id: teamId,
          user_id: userId,
          level: 'info',
          message: `[${command}] ${result.stdout.substring(0, 1000)}`,
          timestamp: new Date().toISOString()
        });
      }

      if (result.code !== 0) {
        this.logBuffer.add({
          installation_id: installationId,
          team_id: teamId,
          user_id: userId,
          level: 'error',
          message: `[${command}] ${result.stderr.substring(0, 500)}`,
          timestamp: new Date().toISOString()
        });
        throw new Error(`${command} ${args.join(' ')} failed with code ${result.code}: ${result.stderr.substring(0, 200)}`);
      }

      // Step 2: For simple scripts, install dependencies into the venv
      if (isSimpleScript) {
        const depFile = hasPyproject ? 'pyproject.toml' : 'requirements.txt';
        let pipArgs: string[];

        if (hasPyproject) {
          // Parse dependencies from pyproject.toml and install them directly
          const pyprojectPath = path.join(tempDir, 'pyproject.toml');
          const pyprojectContent = await fs.promises.readFile(pyprojectPath, 'utf8');

          // Extract dependencies array from [project] section
          const depsMatch = pyprojectContent.match(/dependencies\s*=\s*\[([\s\S]*?)\]/);
          if (depsMatch) {
            const depsContent = depsMatch[1];
            // Parse individual dependencies (handle both "pkg" and 'pkg' quotes)
            const deps = depsContent
              .split(',')
              .map(d => d.trim())
              .filter(d => d.length > 0)
              .map(d => d.replace(/^["']|["']$/g, '')); // Remove quotes

            if (deps.length > 0) {
              pipArgs = ['pip', 'install', ...deps];
            } else {
              // No dependencies found, skip install
              this.logger.info({
                operation: 'python_deps_skip',
                temp_dir: tempDir,
                reason: 'no_dependencies_in_pyproject'
              }, 'No dependencies found in pyproject.toml, skipping install');
              pipArgs = [];
            }
          } else {
            // No dependencies section found
            this.logger.info({
              operation: 'python_deps_skip',
              temp_dir: tempDir,
              reason: 'no_dependencies_section'
            }, 'No [project.dependencies] section in pyproject.toml, skipping install');
            pipArgs = [];
          }
        } else {
          // Use requirements.txt
          pipArgs = ['pip', 'install', '-r', 'requirements.txt'];
        }

        // Skip if no dependencies to install
        if (pipArgs.length === 0) {
          this.logger.info({
            operation: 'python_install_success',
            temp_dir: tempDir,
            method: installMethod
          }, 'Python venv created successfully (no dependencies to install)');
          return;
        }

        this.logger.debug({
          operation: 'python_deps_install_start',
          temp_dir: tempDir,
          dep_file: depFile
        }, `Installing dependencies from ${depFile} into venv`);

        const depsResult = await this.processSpawner.spawnBuildCommandWithNsjail(
          'uv',
          pipArgs,
          tempDir,
          {
            allowNetwork: true,
            timeoutMs: 180000,
            runtime: 'python'
          }
        );

        if (depsResult.stdout) {
          this.logBuffer.add({
            installation_id: installationId,
            team_id: teamId,
            user_id: userId,
            level: 'info',
            message: `[uv pip] ${depsResult.stdout.substring(0, 1000)}`,
            timestamp: new Date().toISOString()
          });
        }

        if (depsResult.code !== 0) {
          this.logBuffer.add({
            installation_id: installationId,
            team_id: teamId,
            user_id: userId,
            level: 'error',
            message: `[uv pip] ${depsResult.stderr.substring(0, 500)}`,
            timestamp: new Date().toISOString()
          });
          throw new Error(`uv pip install failed with code ${depsResult.code}: ${depsResult.stderr.substring(0, 200)}`);
        }
      }

      this.logger.info({
        operation: 'python_install_success',
        temp_dir: tempDir,
        method: installMethod
      }, 'Python dependencies installed successfully');
    } else {
      // Development mode - direct spawn
      // Helper to run a command and return a promise
      const runCommand = (cmd: string, cmdArgs: string[]): Promise<void> => {
        return new Promise((resolve, reject) => {
          const proc = spawn(cmd, cmdArgs, {
            cwd: tempDir,
            stdio: 'pipe'
          });

          let stderr = '';

          proc.stdout.on('data', (data) => {
            const output = data.toString().trim();
            if (output) {
              this.logBuffer.add({
                installation_id: installationId,
                team_id: teamId,
                user_id: userId,
                level: 'info',
                message: `[${cmd}] ${output}`,
                timestamp: new Date().toISOString()
              });
            }
          });

          proc.stderr.on('data', (data) => {
            const output = data.toString().trim();
            stderr += output;
            if (output) {
              // uv outputs progress/status to stderr, not actual warnings
              // Only treat as warn if it contains error indicators
              const isError = output.toLowerCase().includes('error') ||
                             output.toLowerCase().includes('failed') ||
                             output.includes('×');

              this.logBuffer.add({
                installation_id: installationId,
                team_id: teamId,
                user_id: userId,
                level: isError ? 'warn' : 'info',
                message: `[${cmd}] ${output}`,
                timestamp: new Date().toISOString()
              });
            }
          });

          proc.on('exit', (code) => {
            if (code === 0) {
              resolve();
            } else {
              this.logger.error({
                operation: 'python_command_failed',
                temp_dir: tempDir,
                command: cmd,
                exit_code: code,
                stderr: stderr.substring(0, 500)
              }, `${cmd} failed with code ${code}`);
              reject(new Error(`${cmd} failed with code ${code}: ${stderr.substring(0, 200)}`));
            }
          });

          proc.on('error', (error) => {
            this.logger.error({
              operation: 'python_command_error',
              temp_dir: tempDir,
              command: cmd,
              error: error.message
            }, `${cmd} process error`);
            reject(new Error(`${cmd} process error: ${error.message}`));
          });
        });
      };

      // Step 1: Run initial command (venv creation or sync)
      await runCommand(command, args);

      // Step 2: For simple scripts, install dependencies
      if (isSimpleScript) {
        const depFile = hasPyproject ? 'pyproject.toml' : 'requirements.txt';
        let pipArgs: string[];

        if (hasPyproject) {
          // Parse dependencies from pyproject.toml and install them directly
          const pyprojectPath = path.join(tempDir, 'pyproject.toml');
          const pyprojectContent = await fs.promises.readFile(pyprojectPath, 'utf8');

          // Extract dependencies array from [project] section
          const depsMatch = pyprojectContent.match(/dependencies\s*=\s*\[([\s\S]*?)\]/);
          if (depsMatch) {
            const depsContent = depsMatch[1];
            // Parse individual dependencies (handle both "pkg" and 'pkg' quotes)
            const deps = depsContent
              .split(',')
              .map(d => d.trim())
              .filter(d => d.length > 0)
              .map(d => d.replace(/^["']|["']$/g, '')); // Remove quotes

            if (deps.length > 0) {
              pipArgs = ['pip', 'install', ...deps];
            } else {
              // No dependencies, skip
              pipArgs = [];
            }
          } else {
            // No dependencies section
            pipArgs = [];
          }
        } else {
          // Use requirements.txt
          pipArgs = ['pip', 'install', '-r', 'requirements.txt'];
        }

        // Install dependencies if any
        if (pipArgs.length > 0) {
          this.logger.debug({
            operation: 'python_deps_install_start',
            temp_dir: tempDir,
            dep_file: depFile,
            dependencies: hasPyproject ? pipArgs.slice(2) : undefined
          }, `Installing dependencies from ${depFile} into venv`);

          await runCommand('uv', pipArgs);
        } else {
          this.logger.info({
            operation: 'python_deps_skip',
            temp_dir: tempDir
          }, 'No dependencies to install');
        }
      }

      this.logger.info({
        operation: 'python_install_success',
        temp_dir: tempDir,
        method: installMethod
      }, 'Python dependencies installed successfully');
    }
  }

  /**
   * Resolve Python package entry point from pyproject.toml or __main__.py
   */
  async resolvePythonPackageEntry(tempDir: string): Promise<{ command: string; entryPoint: string }> {
    this.logger.debug({
      operation: 'python_entry_resolve_start',
      temp_dir: tempDir
    }, 'Resolving Python package entry point');

    // Try pyproject.toml first
    const pyprojectPath = path.join(tempDir, 'pyproject.toml');
    if (await fileExists(pyprojectPath)) {
      const content = await fs.promises.readFile(pyprojectPath, 'utf8');

      // Look for [project.scripts] section
      const scriptsMatch = content.match(/\[project\.scripts\]\s*\n([^[]+)/);
      if (scriptsMatch) {
        const firstScriptMatch = scriptsMatch[1].match(/^(\w+)\s*=/m);
        if (firstScriptMatch) {
          const scriptName = firstScriptMatch[1];
          // Entry point is installed in .venv/bin/ after uv sync
          const entryPoint = path.join(tempDir, '.venv', 'bin', scriptName);

          this.logger.info({
            operation: 'python_entry_resolved',
            temp_dir: tempDir,
            script_name: scriptName,
            entry_point: entryPoint
          }, `Resolved Python entry point: ${scriptName}`);

          return { command: entryPoint, entryPoint };
        }
      }

      // Look for [project.gui-scripts] as fallback
      const guiMatch = content.match(/\[project\.gui-scripts\]\s*\n([^[]+)/);
      if (guiMatch) {
        const firstScriptMatch = guiMatch[1].match(/^(\w+)\s*=/m);
        if (firstScriptMatch) {
          const scriptName = firstScriptMatch[1];
          const entryPoint = path.join(tempDir, '.venv', 'bin', scriptName);

          this.logger.info({
            operation: 'python_entry_resolved',
            temp_dir: tempDir,
            script_name: scriptName,
            entry_point: entryPoint
          }, `Resolved Python GUI entry point: ${scriptName}`);

          return { command: entryPoint, entryPoint };
        }
      }
    }

    // Fallback: look for __main__.py
    const mainPath = path.join(tempDir, '__main__.py');
    if (await fileExists(mainPath)) {
      this.logger.info({
        operation: 'python_entry_resolved_main',
        temp_dir: tempDir,
        entry_point: mainPath
      }, 'Using __main__.py as entry point');

      // Use venv Python if available
      const venvPython = path.join(tempDir, '.venv', 'bin', 'python');
      const command = await fileExists(venvPython) ? venvPython : 'python3';

      return { command, entryPoint: mainPath };
    }

    // Try src/__main__.py (common pattern)
    const srcMainPath = path.join(tempDir, 'src', '__main__.py');
    if (await fileExists(srcMainPath)) {
      this.logger.info({
        operation: 'python_entry_resolved_src_main',
        temp_dir: tempDir,
        entry_point: srcMainPath
      }, 'Using src/__main__.py as entry point');

      // Use venv Python if available
      const venvPython = path.join(tempDir, '.venv', 'bin', 'python');
      const command = await fileExists(venvPython) ? venvPython : 'python3';

      return { command, entryPoint: srcMainPath };
    }

    // Try common script names (server.py, main.py, app.py)
    const commonScriptNames = ['server.py', 'main.py', 'app.py', 'run.py'];
    for (const scriptName of commonScriptNames) {
      const scriptPath = path.join(tempDir, scriptName);
      if (await fileExists(scriptPath)) {
        this.logger.info({
          operation: 'python_entry_resolved_script',
          temp_dir: tempDir,
          script_name: scriptName,
          entry_point: scriptPath
        }, `Using ${scriptName} as entry point`);

        // Use venv Python if available
        const venvPython = path.join(tempDir, '.venv', 'bin', 'python');
        const command = await fileExists(venvPython) ? venvPython : 'python3';

        return { command, entryPoint: scriptPath };
      }
    }

    throw new Error('Cannot resolve Python entry point: no scripts in pyproject.toml, no __main__.py, and no common script files (server.py, main.py, app.py) found');
  }

  /**
   * Detect runtime from extracted repository files
   */
  async detectRuntime(tempDir: string): Promise<'node' | 'python' | 'unknown'> {
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

  /**
   * Prepare a GitHub deployment - downloads, extracts, builds, and updates config
   * Returns the updated config with local paths
   * Supports both Node.js and Python runtimes
   */
  async prepareDeployment(config: MCPServerConfig): Promise<MCPServerConfig> {
    if (!this.backendClient) {
      throw new Error('BackendClient not available for GitHub deployment');
    }

    const useTmpfs = process.env.NODE_ENV === 'production' || process.env.MCP_USE_TMPFS === 'true';

    this.logger.info({
      operation: 'github_deployment_detected',
      installation_name: config.installation_name,
      installation_id: config.installation_id,
      command: config.command,
      runtime: config.runtime || 'unknown',
      args: config.args,
      use_tmpfs: useTmpfs
    }, `GitHub deployment detected (${config.runtime || 'unknown'} runtime), downloading repository via Octokit`);

    // Parse GitHub URL from package manager arguments
    const githubInfo = this.parseGitHubUrl(config.command, config.args || []);
    if (!githubInfo) {
      throw new Error('Failed to parse GitHub URL from package manager arguments');
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

    // Create deployment directory
    let deploymentDir: string;

    if (useTmpfs) {
      // Production: Use tmpfs with 300MB quota
      deploymentDir = `${githubDeploymentBaseDir}/${config.team_id}/${config.installation_id}`;

      this.logger.debug({
        operation: 'deployment_tmpfs_create_start',
        deployment_dir: deploymentDir,
        tmpfs_size: nsjailConfig.deploymentTmpfsSize
      }, `Creating tmpfs with ${nsjailConfig.deploymentTmpfsSize} quota`);

      try {
        await this.tmpfsManager.createTmpfs(deploymentDir, {
          size: nsjailConfig.deploymentTmpfsSize,
          mode: '0755'
        });

        this.logger.info({
          operation: 'deployment_tmpfs_created',
          deployment_dir: deploymentDir,
          size: nsjailConfig.deploymentTmpfsSize
        }, `tmpfs created with kernel-enforced ${nsjailConfig.deploymentTmpfsSize} quota`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error({
          operation: 'deployment_tmpfs_failed',
          deployment_dir: deploymentDir,
          error: errorMessage
        }, 'Failed to create tmpfs for deployment');

        throw new Error(`Failed to create deployment tmpfs: ${errorMessage}`);
      }
    } else {
      // Development: Use regular /tmp directory
      const { v4: uuidv4 } = await import('uuid');
      deploymentDir = `/tmp/mcp-${uuidv4()}`;

      this.logger.debug({
        operation: 'deployment_dir_create_dev',
        deployment_dir: deploymentDir
      }, 'Creating deployment directory (development mode, no tmpfs)');

      await mkdir(deploymentDir, { recursive: true });
    }

    // Extract tarball to deployment directory
    await this.extractTarball(tarballBuffer, deploymentDir);

    // Detect runtime from extracted files or use config runtime
    const runtime = config.runtime || await this.detectRuntime(deploymentDir);

    this.logger.info({
      operation: 'github_deployment_runtime_detected',
      runtime,
      temp_dir: deploymentDir
    }, `Detected runtime: ${runtime}`);

    // Handle runtime-specific installation and build
    if (runtime === 'node') {
      // Defense-in-depth: Re-validate build scripts before execution
      const packageJsonPath = path.join(deploymentDir, 'package.json');
      if (await fileExists(packageJsonPath)) {
        const packageJsonContent = await fs.promises.readFile(packageJsonPath, 'utf8');
        const packageJson = JSON.parse(packageJsonContent);

        if (packageJson.scripts) {
          const validation = validateBuildScripts(packageJson.scripts);
          if (!validation.valid) {
            this.logger.error({
              operation: 'security_build_scripts_blocked',
              installation_id: config.installation_id,
              blocked_reason: validation.error
            }, 'SECURITY: Blocked dangerous build scripts');
            throw new Error(`Security: ${validation.error}`);
          }
        }
      }

      // Install Node.js dependencies
      await this.installDependencies(deploymentDir, config.installation_id, config.team_id, config.user_id);

      // Build package if build script exists
      await this.buildPackage(deploymentDir, config.installation_id, config.team_id, config.user_id);

      // Resolve Node.js package entry point
      const entryPoint = await this.resolvePackageEntry(deploymentDir);

      // Make entry point relative to deployment dir for nsjail mounting
      const relativeEntryPoint = path.relative(deploymentDir, entryPoint);

      const updatedConfig: MCPServerConfig = {
        ...config,
        command: 'node',
        args: [relativeEntryPoint],
        temp_dir: deploymentDir
      };

      this.logger.info({
        operation: 'github_deployment_ready',
        installation_name: config.installation_name,
        temp_dir: deploymentDir,
        runtime: 'node',
        entry_point: entryPoint,
        relative_entry_point: relativeEntryPoint
      }, 'Node.js GitHub repository downloaded and ready to spawn');

      return updatedConfig;

    } else if (runtime === 'python') {
      // Install Python dependencies
      await this.installPythonDependencies(deploymentDir, config.installation_id, config.team_id, config.user_id);

      // Resolve Python package entry point
      const { command, entryPoint } = await this.resolvePythonPackageEntry(deploymentDir);

      // Determine the correct command and args based on entry point type
      let updatedConfig: MCPServerConfig;

      if (command === 'python3') {
        // Running with system python3 interpreter - make script path relative
        const relativeEntryPoint = path.relative(deploymentDir, entryPoint);
        updatedConfig = {
          ...config,
          command: 'python3',
          args: [relativeEntryPoint],
          temp_dir: deploymentDir
        };
      } else if (command.includes('.venv/bin/python')) {
        // Running with venv Python - use relative paths for both command and script
        const relativeCommand = path.relative(deploymentDir, command);
        const relativeEntryPoint = path.relative(deploymentDir, entryPoint);
        updatedConfig = {
          ...config,
          command: relativeCommand,  // .venv/bin/python
          args: [relativeEntryPoint],  // server.py
          temp_dir: deploymentDir
        };
      } else {
        // Running directly (entry point is executable script from venv bin)
        const relativeCommand = path.relative(deploymentDir, entryPoint);
        updatedConfig = {
          ...config,
          command: relativeCommand,
          args: [],
          temp_dir: deploymentDir
        };
      }

      this.logger.info({
        operation: 'github_deployment_ready',
        installation_name: config.installation_name,
        temp_dir: deploymentDir,
        runtime: 'python',
        command: updatedConfig.command,
        entry_point: entryPoint
      }, 'Python GitHub repository downloaded and ready to spawn');

      return updatedConfig;

    } else {
      throw new Error(`Unsupported runtime: ${runtime}. Only Node.js and Python are currently supported.`);
    }
  }
}
