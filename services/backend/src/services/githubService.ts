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
  
  private static async getAuthenticatedRequest(logger: FastifyBaseLogger) {
    if (!this.requestWithAuth) {
      // Check if GitHub App is enabled
      const enabled = await GlobalSettings.getBoolean('github.app.enabled', false);
      if (!enabled) {
        throw new Error('GitHub App integration is not enabled');
      }
      
      // Get GitHub App settings from global settings
      const appId = await GlobalSettings.getRequired('github.app.app_id');
      const privateKeyBase64 = await GlobalSettings.getRequired('github.app.private_key_base64');
      const installationId = await GlobalSettings.getRequired('github.app.installation_id');
      
      logger.debug({
        operation: 'github_auth_setup',
        appId,
        installationId
      }, 'Setting up GitHub App authentication');
      
      // Decode private key (same as your Lambda implementation)
      const privateKey = Buffer.from(privateKeyBase64, 'base64').toString('utf8');
      
      // Dynamic import to avoid loading heavy dependencies if not needed
      const { createAppAuth } = await import('@octokit/auth-app');
      const { request } = await import('@octokit/request');
      
      const auth = createAppAuth({
        appId,
        privateKey,
        installationId
      });
      
      this.requestWithAuth = request.defaults({
        request: {
          hook: auth.hook,
          retries: 3,
          retryAfter: 3
        }
      });
      
      logger.info({
        operation: 'github_auth_setup'
      }, 'GitHub App authentication configured successfully');
    }
    
    return this.requestWithAuth;
  }
  
  static async getRepositoryInfo(githubUrl: string, logger: FastifyBaseLogger): Promise<GitHubRepoInfo> {
    const { owner, repo } = this.parseGitHubUrl(githubUrl);
    const request = await this.getAuthenticatedRequest(logger);
    
    logger.debug({
      operation: 'github_get_repo_info',
      owner,
      repo,
      githubUrl
    }, 'Fetching repository information from GitHub');
    
    try {
      const result = await request('GET /repos/{owner}/{repo}', {
        owner,
        repo,
        headers: {
          'X-GitHub-Api-Version': '2022-11-28'
        }
      });
      
      const data = result.data;
      
      logger.info({
        operation: 'github_get_repo_info',
        owner,
        repo,
        language: data.language,
        stars: data.stargazers_count
      }, 'Successfully fetched repository information');
      
      return {
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
    } catch (error) {
      logger.error({
        operation: 'github_get_repo_info',
        error,
        owner,
        repo,
        githubUrl
      }, 'Failed to fetch repository information');
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
