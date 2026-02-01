import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import { Logger } from 'pino';
import { MCPServerConfig } from './types';
import { LogBuffer } from './log-buffer';
import type { BackendClient } from '../services/backend-client';
import { ProcessSpawner } from './nsjail-spawner';
import { validateBuildScripts } from '../config/security-validation';
import { TmpfsManager } from '../lib/tmpfs-manager';
import { githubDeploymentBaseDir, nsjailConfig } from '../config/nsjail';
import { selectBestPythonForDeployment } from '../utils/runtime-validator';
import {
  isPyprojectSimpleScript,
  parsePyprojectDependencies,
  resolvePythonEntryPoint
} from '../utils/python-helpers';
import {
  parseGitHubUrl,
  resolvePackageEntry,
  detectRuntime,
  type GitHubInfo
} from '../utils/node-helpers';
import {
  downloadRepository,
  extractTarball
} from '../utils/tarball-operations';
import {
  emitBuildResult,
  type BuildCommandMetadata
} from '../utils/build-logging';
import {
  readPackageJson,
  hasBuildScript
} from '../utils/package-json-reader';
import {
  createDeploymentDirectory,
  type DeploymentDirConfig
} from '../utils/deployment-directory';

// Re-export GitHubInfo for backward compatibility
export type { GitHubInfo };

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
      const metadata: BuildCommandMetadata = { installation_id: installationId, team_id: teamId, user_id: userId };
      emitBuildResult(this.logBuffer, metadata, 'npm install', result);

      if (result.code !== 0) {
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
      // Check if there's a build script
      if (!(await hasBuildScript(tempDir))) {
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
        const metadata: BuildCommandMetadata = { installation_id: installationId, team_id: teamId, user_id: userId };
        emitBuildResult(this.logBuffer, metadata, 'npm build', result);

        if (result.code !== 0) {
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

    // Determine installation method using pattern detection from python-helpers
    if (hasPyproject && !(await isPyprojectSimpleScript(tempDir))) {
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
          // Parse dependencies from pyproject.toml using extracted helper
          const pyprojectPath = path.join(tempDir, 'pyproject.toml');
          const deps = await parsePyprojectDependencies(pyprojectPath);

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

        const metadata: BuildCommandMetadata = { installation_id: installationId, team_id: teamId, user_id: userId };
        emitBuildResult(this.logBuffer, metadata, 'uv pip', depsResult);

        if (depsResult.code !== 0) {
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
   * Delegates to resolvePythonEntryPoint() from python-helpers.ts
   */
  async resolvePythonPackageEntry(tempDir: string): Promise<{ command: string; entryPoint: string }> {
    this.logger.debug({
      operation: 'python_entry_resolve_start',
      temp_dir: tempDir
    }, 'Resolving Python package entry point');

    const result = await resolvePythonEntryPoint(tempDir);

    if (!result) {
      throw new Error('Cannot resolve Python entry point: no scripts in pyproject.toml, no __main__.py, and no common script files (server.py, main.py, app.py, run.py) found');
    }

    this.logger.info({
      operation: 'python_entry_resolved',
      temp_dir: tempDir,
      command: result.command,
      entry_point: result.entryPoint
    }, `Resolved Python entry point: ${result.command}`);

    return result;
  }

  /**
   * Check if a file exists
   */
  private async fileExistsAsync(filePath: string): Promise<boolean> {
    try {
      await fsPromises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the site-packages path from a venv directory
   * Detects Python version by scanning .venv/lib/pythonX.Y/site-packages
   *
   * @param deploymentDir - Real deployment directory path (for reading filesystem)
   * @param venvPath - Venv path to use in the result (could be /app/.venv for nsjail)
   * @returns Site-packages path using venvPath prefix
   */
  private async getPythonSitePackagesPath(
    deploymentDir: string,
    venvPath: string
  ): Promise<string> {
    const libDir = path.join(deploymentDir, '.venv', 'lib');

    try {
      const entries = await fsPromises.readdir(libDir);

      // Find python3.X directory
      const pythonDir = entries.find(e => e.startsWith('python3.'));

      if (!pythonDir) {
        throw new Error('Could not find Python version in venv lib directory');
      }

      this.logger.debug({
        operation: 'python_site_packages_detected',
        python_dir: pythonDir,
        venv_path: venvPath
      }, `Detected Python version: ${pythonDir}`);

      // Return site-packages path (use venvPath for the prefix, not deploymentDir)
      return path.join(venvPath, 'lib', pythonDir, 'site-packages');
    } catch (error) {
      this.logger.warn({
        operation: 'python_site_packages_fallback',
        error: error instanceof Error ? error.message : String(error)
      }, 'Could not detect Python version, trying common versions');

      // Fallback: try common Python versions
      const commonVersions = ['python3.13', 'python3.12', 'python3.11', 'python3.10', 'python3.9'];

      for (const version of commonVersions) {
        const candidatePath = path.join(deploymentDir, '.venv', 'lib', version, 'site-packages');

        if (await this.fileExistsAsync(candidatePath)) {
          this.logger.info({
            operation: 'python_site_packages_found',
            python_version: version,
            venv_path: venvPath
          }, `Found Python ${version} site-packages`);

          return path.join(venvPath, 'lib', version, 'site-packages');
        }
      }

      throw new Error('Could not determine Python site-packages path in venv');
    }
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
    const githubInfo = parseGitHubUrl(config.command, config.args || [], this.logger);
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
    const tarballBuffer = await downloadRepository(
      githubInfo.owner,
      githubInfo.repo,
      githubInfo.ref,
      tokenResult.token,
      this.logger
    );

    // Create deployment directory
    const deploymentDirConfig: DeploymentDirConfig = {
      teamId: config.team_id,
      installationId: config.installation_id,
      useTmpfs,
      tmpfsSize: nsjailConfig.deploymentTmpfsSize,
      baseDir: githubDeploymentBaseDir
    };

    const deploymentDir = await createDeploymentDirectory(
      deploymentDirConfig,
      this.tmpfsManager,
      this.logger
    );

    // Extract tarball to deployment directory
    await extractTarball(tarballBuffer, deploymentDir, this.logger, this.tmpfsManager);

    // Detect runtime from extracted files or use config runtime
    const runtime = config.runtime || await detectRuntime(deploymentDir);

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
        const packageJson = await readPackageJson(deploymentDir);

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
      const entryPoint = await resolvePackageEntry(deploymentDir, this.logger);

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

        // Activate venv by setting PYTHONPATH environment variable
        // This allows system python3 to find packages in .venv/lib/python3.x/site-packages
        //
        // Note: PATH is blocked by security sanitization, so we use PYTHONPATH instead
        // In production (nsjail), deployment dir is mounted as /app
        // In development, we use the actual deployment directory path
        const isProduction = process.env.NODE_ENV === 'production';
        const venvPath = isProduction ? '/app/.venv' : path.join(deploymentDir, '.venv');

        // Detect Python version and get site-packages path
        const sitePackagesPath = await this.getPythonSitePackagesPath(deploymentDir, venvPath);

        const activatedEnv = {
          ...config.env,
          // Set PYTHONPATH so python3 finds packages in venv
          PYTHONPATH: sitePackagesPath
        };

        this.logger.info({
          operation: 'python_venv_activated',
          site_packages_path: sitePackagesPath,
          is_production: isProduction
        }, `Activated Python venv via PYTHONPATH: ${sitePackagesPath}`);

        updatedConfig = {
          ...config,
          command: 'python3',
          args: [relativeEntryPoint],
          temp_dir: deploymentDir,
          env: activatedEnv
        };
      } else {
        // Running directly (entry point is executable script from venv bin)
        // Used for Pattern 1 (Installable Package) where [project.scripts] creates executables
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
