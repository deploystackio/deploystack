import { GlobalSettings } from '../global-settings';
import type { FastifyBaseLogger } from 'fastify';

// GitHub API interfaces
export interface GitHubRepoInfo {
  name: string;
  description: string;
  language: string;
  homepage: string;
  license: string;
  defaultBranch: string;
  stars: number;
  forks: number;
  topics: string[];
}

export interface GitHubRelease {
  version: string;
  changelog: string;
  publishedAt: string;
  gitCommit: string;
}

export interface GitHubPackageInfo {
  name?: string;
  version?: string;
  description?: string;
  dependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

export class GitHubService {
   
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static requestWithAuth: any = null;
  private static cachedSettings: { appId: string; privateKeyBase64: string; installationId: string } | null = null;
  
  /**
   * Clear the cached authenticated request client
   * This should be called when settings change to ensure fresh authentication
   */
  static clearAuthCache(): void {
    this.requestWithAuth = null;
    this.cachedSettings = null;
  }
  
  private static async getAuthenticatedRequest(logger: FastifyBaseLogger) {
    // Get current settings first
    logger.debug({
      operation: 'github_auth_setup',
      step: 'get_current_settings'
    }, '📋 Retrieving current GitHub App settings');

    const enabled = await GlobalSettings.getBoolean('github.app.enabled', false);
    if (!enabled) {
      logger.error({
        operation: 'github_auth_setup',
        step: 'check_enabled',
        enabled: false
      }, '❌ GitHub App integration is not enabled');
      throw new Error('GitHub App integration is not enabled');
    }

    let appId: string;
    let privateKeyBase64: string;
    let installationId: string;

    try {
      appId = await GlobalSettings.getRequired('github.app.app_id');
      privateKeyBase64 = await GlobalSettings.getRequired('github.app.private_key_base64');
      installationId = await GlobalSettings.getRequired('github.app.installation_id');
      
      logger.debug({
        operation: 'github_auth_setup',
        step: 'get_current_settings',
        appId: appId ? `${appId.substring(0, 4)}...` : 'null',
        hasPrivateKey: !!privateKeyBase64,
        privateKeyLength: privateKeyBase64 ? privateKeyBase64.length : 0,
        installationId: installationId ? `${installationId.substring(0, 4)}...` : 'null'
      }, '📋 Current GitHub App settings retrieved');
    } catch (error) {
      logger.error({
        operation: 'github_auth_setup',
        step: 'get_current_settings',
        error
      }, '❌ Failed to retrieve GitHub App settings');
      throw error;
    }

    // Check if we have a cached client and if the settings match
    const currentSettings = { appId, privateKeyBase64, installationId };
    const settingsChanged = !this.cachedSettings || 
      this.cachedSettings.appId !== currentSettings.appId ||
      this.cachedSettings.privateKeyBase64 !== currentSettings.privateKeyBase64 ||
      this.cachedSettings.installationId !== currentSettings.installationId;

    if (!this.requestWithAuth || settingsChanged) {
      if (settingsChanged && this.requestWithAuth) {
        logger.info({
          operation: 'github_auth_setup',
          step: 'settings_changed',
          oldAppId: this.cachedSettings?.appId ? `${this.cachedSettings.appId.substring(0, 4)}...` : 'null',
          newAppId: appId ? `${appId.substring(0, 4)}...` : 'null',
          oldInstallationId: this.cachedSettings?.installationId ? `${this.cachedSettings.installationId.substring(0, 4)}...` : 'null',
          newInstallationId: installationId ? `${installationId.substring(0, 4)}...` : 'null'
        }, '🔄 GitHub App settings changed, clearing cache and creating new client');
      }

      logger.debug({
        operation: 'github_auth_setup',
        step: 'start_auth_setup'
      }, '🔄 Starting GitHub App authentication setup');
      
      logger.debug({
        operation: 'github_auth_setup',
        step: 'decode_private_key'
      }, '🔐 Decoding private key from base64');

      let privateKey: string;
      try {
        privateKey = Buffer.from(privateKeyBase64, 'base64').toString('utf8');
        logger.debug({
          operation: 'github_auth_setup',
          step: 'decode_private_key',
          decodedLength: privateKey.length,
          startsWithBegin: privateKey.startsWith('-----BEGIN'),
          endsWithEnd: privateKey.includes('-----END')
        }, `🔐 Private key decoded successfully (${privateKey.length} chars, valid format: ${privateKey.startsWith('-----BEGIN') && privateKey.includes('-----END')})`);
      } catch (error) {
        logger.error({
          operation: 'github_auth_setup',
          step: 'decode_private_key',
          error
        }, '❌ Failed to decode private key from base64');
        throw new Error(`Failed to decode private key: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      // Dynamic import to avoid loading heavy dependencies if not needed
      logger.debug({
        operation: 'github_auth_setup',
        step: 'import_octokit'
      }, '📦 Importing Octokit dependencies');

      let createAppAuth: any;
      let request: any;

      try {
        const authModule = await import('@octokit/auth-app');
        createAppAuth = authModule.createAppAuth;
        logger.debug({
          operation: 'github_auth_setup',
          step: 'import_auth',
          success: true
        }, '📦 Successfully imported @octokit/auth-app');
      } catch (error) {
        logger.error({
          operation: 'github_auth_setup',
          step: 'import_auth',
          error
        }, '❌ Failed to import @octokit/auth-app');
        throw new Error(`Failed to import @octokit/auth-app: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      try {
        const requestModule = await import('@octokit/request');
        request = requestModule.request;
        logger.debug({
          operation: 'github_auth_setup',
          step: 'import_request',
          success: true
        }, '📦 Successfully imported @octokit/request');
      } catch (error) {
        logger.error({
          operation: 'github_auth_setup',
          step: 'import_request',
          error
        }, '❌ Failed to import @octokit/request');
        throw new Error(`Failed to import @octokit/request: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      logger.debug({
        operation: 'github_auth_setup',
        step: 'create_auth',
        appId: appId ? `${appId.substring(0, 4)}...` : 'null',
        installationId: installationId ? `${installationId.substring(0, 4)}...` : 'null'
      }, '🔐 Creating GitHub App authentication');

      let auth: any;
      try {
        auth = createAppAuth({
          appId,
          privateKey,
          installationId
        });
        logger.debug({
          operation: 'github_auth_setup',
          step: 'create_auth',
          success: true
        }, '🔐 GitHub App authentication created successfully');
      } catch (error) {
        logger.error({
          operation: 'github_auth_setup',
          step: 'create_auth',
          error,
          appId: appId ? `${appId.substring(0, 4)}...` : 'null',
          installationId: installationId ? `${installationId.substring(0, 4)}...` : 'null'
        }, '❌ Failed to create GitHub App authentication');
        throw new Error(`Failed to create GitHub App authentication: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      logger.debug({
        operation: 'github_auth_setup',
        step: 'create_request_client'
      }, '🌐 Creating authenticated request client');

      try {
        this.requestWithAuth = request.defaults({
          request: {
            hook: auth.hook,
            retries: 3,
            retryAfter: 3
          }
        });
        
        // Cache the current settings
        this.cachedSettings = currentSettings;
        
        logger.debug({
          operation: 'github_auth_setup',
          step: 'create_request_client',
          success: true,
          retries: 3,
          retryAfter: 3
        }, '🌐 Authenticated request client created successfully');
      } catch (error) {
        logger.error({
          operation: 'github_auth_setup',
          step: 'create_request_client',
          error
        }, '❌ Failed to create authenticated request client');
        throw new Error(`Failed to create authenticated request client: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      logger.info({
        operation: 'github_auth_setup',
        step: 'complete',
        appId: appId ? `${appId.substring(0, 4)}...` : 'null',
        installationId: installationId ? `${installationId.substring(0, 4)}...` : 'null'
      }, '✅ GitHub App authentication configured successfully');
    } else {
      logger.debug({
        operation: 'github_auth_setup',
        step: 'reuse_existing',
        cachedAppId: this.cachedSettings?.appId ? `${this.cachedSettings.appId.substring(0, 4)}...` : 'null',
        cachedInstallationId: this.cachedSettings?.installationId ? `${this.cachedSettings.installationId.substring(0, 4)}...` : 'null'
      }, '♻️ Reusing existing authenticated request client (settings unchanged)');
    }
    
    return this.requestWithAuth;
  }
  
  static async getRepositoryInfo(githubUrl: string, logger: FastifyBaseLogger): Promise<GitHubRepoInfo> {
    logger.debug({
      operation: 'github_get_repo_info',
      step: 'start',
      githubUrl
    }, '🔄 Starting GitHub repository info fetch');

    logger.debug({
      operation: 'github_get_repo_info',
      step: 'parse_url',
      githubUrl
    }, '🔍 Parsing GitHub URL');

    let owner: string;
    let repo: string;
    try {
      const parsed = this.parseGitHubUrl(githubUrl);
      owner = parsed.owner;
      repo = parsed.repo;
      
      logger.debug({
        operation: 'github_get_repo_info',
        step: 'parse_url',
        owner,
        repo,
        githubUrl
      }, `📋 Parsed GitHub URL: ${owner}/${repo}`);
    } catch (error) {
      logger.error({
        operation: 'github_get_repo_info',
        step: 'parse_url',
        error,
        githubUrl
      }, '❌ Failed to parse GitHub URL');
      throw error;
    }

    logger.debug({
      operation: 'github_get_repo_info',
      step: 'get_auth_request',
      owner,
      repo
    }, '🔐 Getting authenticated request client');

    let request: any;
    try {
      request = await this.getAuthenticatedRequest(logger);
      logger.debug({
        operation: 'github_get_repo_info',
        step: 'get_auth_request',
        success: true,
        owner,
        repo
      }, '🔐 Authenticated request client obtained');
    } catch (error) {
      logger.error({
        operation: 'github_get_repo_info',
        step: 'get_auth_request',
        error,
        owner,
        repo
      }, '❌ Failed to get authenticated request client');
      throw error;
    }
    
    logger.debug({
      operation: 'github_get_repo_info',
      step: 'api_call_start',
      owner,
      repo,
      githubUrl,
      endpoint: `GET /repos/${owner}/${repo}`
    }, '🌐 Making GitHub API call to fetch repository information');
    
    try {
      const startTime = Date.now();
      
      const result = await request('GET /repos/{owner}/{repo}', {
        owner,
        repo,
        headers: {
          'X-GitHub-Api-Version': '2022-11-28'
        }
      });
      
      const duration = Date.now() - startTime;
      const data = result.data;
      
      logger.debug({
        operation: 'github_get_repo_info',
        step: 'api_call_success',
        owner,
        repo,
        duration_ms: duration,
        status: result.status,
        responseSize: JSON.stringify(data).length
      }, `🌐 GitHub API call successful (${duration}ms, ${result.status})`);
      
      logger.debug({
        operation: 'github_get_repo_info',
        step: 'process_response',
        owner,
        repo,
        repoName: data.name,
        language: data.language,
        stars: data.stargazers_count,
        forks: data.forks_count,
        defaultBranch: data.default_branch,
        hasLicense: !!data.license,
        topicsCount: data.topics?.length || 0
      }, '📋 Processing GitHub API response');
      
      const repoInfo: GitHubRepoInfo = {
        name: data.name,
        description: data.description || '',
        language: data.language || 'unknown',
        homepage: data.homepage || '',
        license: data.license?.spdx_id || '',
        defaultBranch: data.default_branch,
        stars: data.stargazers_count || 0,
        forks: data.forks_count || 0,
        topics: data.topics || []
      };
      
      logger.info({
        operation: 'github_get_repo_info',
        step: 'complete',
        owner,
        repo,
        language: repoInfo.language,
        stars: repoInfo.stars,
        duration_ms: duration
      }, `✅ Successfully fetched repository information for ${owner}/${repo}`);
      
      return repoInfo;
    } catch (error) {
      logger.error({
        operation: 'github_get_repo_info',
        step: 'api_call_failed',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          name: error instanceof Error ? error.name : 'UnknownError',
          status: (error as any)?.status,
          response: (error as any)?.response?.data
        },
        owner,
        repo,
        githubUrl,
        endpoint: `GET /repos/${owner}/${repo}`
      }, `❌ Failed to fetch repository information for ${owner}/${repo}`);
      
      // Add more specific error context
      if ((error as any)?.status) {
        logger.debug({
          operation: 'github_get_repo_info',
          step: 'error_analysis',
          httpStatus: (error as any).status,
          owner,
          repo
        }, `🔍 GitHub API returned HTTP ${(error as any).status}`);
        
        if ((error as any).status === 404) {
          throw new Error(`Repository ${owner}/${repo} not found or not accessible with current GitHub App permissions`);
        } else if ((error as any).status === 401) {
          throw new Error(`GitHub App authentication failed - invalid credentials`);
        } else if ((error as any).status === 403) {
          throw new Error(`GitHub App does not have permission to access repository ${owner}/${repo}`);
        }
      }
      
      throw error;
    }
  }
  
  static async getLatestRelease(owner: string, repo: string, logger: FastifyBaseLogger): Promise<GitHubRelease | null> {
    const request = await this.getAuthenticatedRequest(logger);
    
    logger.debug({
      operation: 'github_get_latest_release',
      owner,
      repo
    }, 'Fetching latest release from GitHub');
    
    try {
      const result = await request('GET /repos/{owner}/{repo}/releases/latest', {
        owner,
        repo,
        headers: {
          'X-GitHub-Api-Version': '2022-11-28'
        }
      });
      
      const data = result.data;
      
      logger.info({
        operation: 'github_get_latest_release',
        owner,
        repo,
        version: data.tag_name
      }, 'Successfully fetched latest release');
      
      return {
        version: data.tag_name,
        changelog: data.body || '',
        publishedAt: data.published_at,
        gitCommit: data.target_commitish || ''
      };
     
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error.status === 404) {
        logger.debug({
          operation: 'github_get_latest_release',
          owner,
          repo
        }, 'No releases found for repository');
        return null;
      }
      
      logger.error({
        operation: 'github_get_latest_release',
        error,
        owner,
        repo
      }, 'Failed to fetch latest release');
      throw error;
    }
  }
  
  static async getPackageJson(owner: string, repo: string, branch: string = 'main', logger: FastifyBaseLogger): Promise<GitHubPackageInfo | null> {
    const request = await this.getAuthenticatedRequest(logger);
    
    logger.debug({
      operation: 'github_get_package_json',
      owner,
      repo,
      branch
    }, 'Fetching package.json from GitHub');
    
    try {
      const result = await request('GET /repos/{owner}/{repo}/contents/{path}', {
        owner,
        repo,
        path: 'package.json',
        ref: branch,
        headers: {
          'X-GitHub-Api-Version': '2022-11-28'
        }
      });
      
      const data = result.data;
      
      if (data.type !== 'file' || !data.content) {
        logger.debug({
          operation: 'github_get_package_json',
          owner,
          repo,
          branch
        }, 'package.json not found or not a file');
        return null;
      }
      
      // Decode base64 content
      const content = Buffer.from(data.content, 'base64').toString('utf8');
      const packageJson = JSON.parse(content);
      
      logger.info({
        operation: 'github_get_package_json',
        owner,
        repo,
        packageName: packageJson.name,
        version: packageJson.version
      }, 'Successfully fetched package.json');
      
      return {
        name: packageJson.name,
        version: packageJson.version,
        description: packageJson.description,
        dependencies: packageJson.dependencies,
        scripts: packageJson.scripts
      };
     
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error.status === 404) {
        logger.debug({
          operation: 'github_get_package_json',
          owner,
          repo,
          branch
        }, 'package.json not found in repository');
        return null;
      }
      
      logger.error({
        operation: 'github_get_package_json',
        error,
        owner,
        repo,
        branch
      }, 'Failed to fetch package.json');
      throw error;
    }
  }
  
  static parseGitHubUrl(url: string): { owner: string; repo: string } {
    // Parse GitHub URL to extract owner/repo
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      throw new Error('Invalid GitHub URL format');
    }
    
    const owner = match[1];
    let repo = match[2];
    
    // Remove .git suffix if present
    repo = repo.replace(/\.git$/, '');
    
    // Remove any trailing path segments
    repo = repo.split('/')[0];
    
    return { owner, repo };
  }
  
  static async isConfigured(): Promise<boolean> {
    try {
      const enabled = await GlobalSettings.getBoolean('github.app.enabled', false);
      if (!enabled) return false;
      
      const appId = await GlobalSettings.get('github.app.app_id');
      const privateKey = await GlobalSettings.get('github.app.private_key_base64');
      const installationId = await GlobalSettings.get('github.app.installation_id');
      
      return !!(appId && privateKey && installationId);
    } catch {
      return false;
    }
  }
  
  static async testConnection(logger: FastifyBaseLogger): Promise<boolean> {
    try {
      const request = await this.getAuthenticatedRequest(logger);
      
      // Test with a simple API call
      await request('GET /user/installations', {
        headers: {
          'X-GitHub-Api-Version': '2022-11-28'
        }
      });
      
      logger.info({
        operation: 'github_test_connection'
      }, 'GitHub App connection test successful');
      
      return true;
    } catch (error) {
      logger.error({
        operation: 'github_test_connection',
        error
      }, 'GitHub App connection test failed');
      
      return false;
    }
  }
}
