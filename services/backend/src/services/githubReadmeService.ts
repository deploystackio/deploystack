/* eslint-disable @typescript-eslint/no-explicit-any */
import { GlobalSettings } from '../global-settings';
import type { FastifyBaseLogger } from 'fastify';
import DOMPurify from 'isomorphic-dompurify';

export interface GitHubReadmeResult {
  content: string;
  encoding: 'utf8';
}

// Maximum README size: 2MB (prevents DoS attacks)
const MAX_README_SIZE_BYTES = 2 * 1024 * 1024;

// DOMPurify configuration optimized for GitHub Markdown
const SANITIZE_CONFIG = {
  // Allow common markdown/HTML tags
  ALLOWED_TAGS: [
    // Text formatting
    'p', 'br', 'strong', 'em', 'u', 's', 'del', 'ins',
    // Headings
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    // Lists
    'ul', 'ol', 'li', 'dl', 'dt', 'dd',
    // Links and code
    'a', 'code', 'pre', 'blockquote',
    // Images
    'img', 'picture', 'source',
    // Tables
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th',
    // Containers
    'div', 'span', 'section', 'article',
    // GitHub-specific
    'details', 'summary',
    // Other
    'hr', 'sup', 'sub'
  ],
  
  // Allow safe attributes
  ALLOWED_ATTR: [
    'href', 'src', 'alt', 'title', 'class', 'id',
    'width', 'height', 'align', 
    'colspan', 'rowspan',
    'type', 'start', 'reversed',
    'open' // for <details> tag
  ],
  
  // Only allow safe URL protocols (prevents javascript: attacks)
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  
  // Keep content of removed tags (don't lose text)
  KEEP_CONTENT: true,
  
  // Security settings
  ALLOW_DATA_ATTR: false, // No data-* attributes
  ALLOW_UNKNOWN_PROTOCOLS: false, // Block unknown protocols
  SANITIZE_DOM: true, // Enable DOM Clobbering protection
  FORCE_BODY: false, // Don't force body wrapper
};

export class GitHubReadmeService {
  
  /**
   * Get the appropriate request client based on GitHub App configuration
   */
  private static async getRequest(logger: FastifyBaseLogger) {
    const enabled = await GlobalSettings.getBoolean('github.app.enabled', false);
    
    logger.debug({
      operation: 'github_readme_get_request',
      githubAppEnabled: enabled
    }, `Getting GitHub request client (GitHub App ${enabled ? 'enabled' : 'disabled'})`);

    if (enabled) {
      return await this.getAuthenticatedRequest(logger);
    } else {
      return await this.getUnauthenticatedRequest(logger);
    }
  }

  /**
   * Get unauthenticated request client for public GitHub API
   */
  private static async getUnauthenticatedRequest(logger: FastifyBaseLogger) {
    logger.debug({
      operation: 'github_readme_unauthenticated_setup',
      step: 'start'
    }, 'Setting up unauthenticated GitHub API client for README');

    try {
      const requestModule = await import('@octokit/request');
      const request = requestModule.request;
      
      const unauthenticatedClient = request.defaults({
        headers: {
          'User-Agent': 'DeployStack-App',
          'X-GitHub-Api-Version': '2022-11-28'
        },
        request: {
          retries: 3,
          retryAfter: 3
        }
      });

      logger.debug({
        operation: 'github_readme_unauthenticated_setup',
        step: 'complete'
      }, 'Unauthenticated GitHub API client configured for README');

      return unauthenticatedClient;
    } catch (error) {
      logger.error({
        operation: 'github_readme_unauthenticated_setup',
        step: 'failed',
        error
      }, 'Failed to create unauthenticated GitHub API client for README');
      throw new Error(`Failed to create unauthenticated GitHub API client: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get authenticated request client using GitHub App
   */
  private static async getAuthenticatedRequest(logger: FastifyBaseLogger) {
    logger.debug({
      operation: 'github_readme_auth_setup',
      step: 'start'
    }, 'Setting up authenticated GitHub API client for README');

    const enabled = await GlobalSettings.getBoolean('github.app.enabled', false);
    if (!enabled) {
      logger.error({
        operation: 'github_readme_auth_setup',
        step: 'check_enabled',
        enabled: false
      }, 'GitHub App integration is not enabled');
      throw new Error('GitHub App integration is not enabled');
    }

    const appId = await GlobalSettings.getRequired('github.app.app_id');
    const privateKeyBase64 = await GlobalSettings.getRequired('github.app.private_key_base64');
    const installationId = await GlobalSettings.getRequired('github.app.installation_id');
    
    logger.debug({
      operation: 'github_readme_auth_setup',
      step: 'get_settings',
      appId: appId ? `${appId.substring(0, 4)}...` : 'null',
      hasPrivateKey: !!privateKeyBase64,
      installationId: installationId ? `${installationId.substring(0, 4)}...` : 'null'
    }, 'GitHub App settings retrieved for README service');

    let privateKey: string;
    try {
      privateKey = Buffer.from(privateKeyBase64, 'base64').toString('utf8');
    } catch (error) {
      logger.error({
        operation: 'github_readme_auth_setup',
        step: 'decode_private_key',
        error
      }, 'Failed to decode private key from base64');
      throw new Error(`Failed to decode private key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const authModule = await import('@octokit/auth-app');
    const createAppAuth = authModule.createAppAuth;
    
    const requestModule = await import('@octokit/request');
    const request = requestModule.request;
    
    const auth = createAppAuth({
      appId,
      privateKey,
      installationId
    });
    
    const requestWithAuth = request.defaults({
      request: {
        hook: auth.hook,
        retries: 3,
        retryAfter: 3
      }
    });
    
    logger.debug({
      operation: 'github_readme_auth_setup',
      step: 'complete'
    }, 'Authenticated GitHub API client configured for README');
    
    return requestWithAuth;
  }

  /**
   * Parse GitHub URL to extract owner and repository name
   */
  private static parseGitHubUrl(url: string): { owner: string; repo: string } {
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      throw new Error('Invalid GitHub URL format');
    }
    
    const owner = match[1];
    let repo = match[2];
    
    repo = repo.replace(/\.git$/, '');
    repo = repo.split('/')[0];
    
    return { owner, repo };
  }

  /**
   * Fetch README content from a GitHub repository
   * 
   * @param githubUrl - Full GitHub repository URL
   * @param branch - Optional branch name (defaults to 'main')
   * @param logger - Fastify logger instance
   * @returns Object with decoded content and encoding, or null if README not found
   */
  static async getReadmeContent(
    githubUrl: string,
    branch: string = 'main',
    logger: FastifyBaseLogger
  ): Promise<GitHubReadmeResult | null> {
    const startTime = Date.now();
    
    logger.debug({
      operation: 'github_readme_get_content',
      step: 'start',
      githubUrl,
      branch
    }, 'Starting README content fetch');

    let owner: string;
    let repo: string;
    
    try {
      const parsed = this.parseGitHubUrl(githubUrl);
      owner = parsed.owner;
      repo = parsed.repo;
      
      logger.debug({
        operation: 'github_readme_get_content',
        step: 'parse_url',
        owner,
        repo,
        githubUrl
      }, `Parsed GitHub URL: ${owner}/${repo}`);
    } catch (error) {
      logger.error({
        operation: 'github_readme_get_content',
        step: 'parse_url',
        error,
        githubUrl
      }, 'Failed to parse GitHub URL');
      throw error;
    }

    let request: any;
    try {
      request = await this.getRequest(logger);
    } catch (error) {
      logger.error({
        operation: 'github_readme_get_content',
        step: 'get_request_client',
        error,
        owner,
        repo
      }, 'Failed to get GitHub request client');
      throw error;
    }

    logger.debug({
      operation: 'github_readme_get_content',
      step: 'api_call_start',
      owner,
      repo,
      branch,
      endpoint: `GET /repos/${owner}/${repo}/readme`
    }, 'Making GitHub API call to fetch README');

    try {
      const params: any = {
        owner,
        repo,
        headers: {
          'X-GitHub-Api-Version': '2022-11-28'
        }
      };

      if (branch && branch !== 'main') {
        params.ref = branch;
      }

      const result = await request('GET /repos/{owner}/{repo}/readme', params);
      const data = result.data;
      
      if (data.type !== 'file' || !data.content || data.encoding !== 'base64') {
        logger.error({
          operation: 'github_readme_get_content',
          step: 'invalid_response',
          owner,
          repo,
          type: data.type,
          hasContent: !!data.content,
          encoding: data.encoding
        }, 'Invalid README response from GitHub');
        return null;
      }

      // Decode base64 content
      const decodedContent = Buffer.from(data.content, 'base64').toString('utf8');
      
      // Size validation (prevents DoS attacks)
      const sizeInBytes = Buffer.byteLength(decodedContent, 'utf8');
      if (sizeInBytes > MAX_README_SIZE_BYTES) {
        logger.warn({
          operation: 'github_readme_get_content',
          step: 'size_validation_failed',
          owner,
          repo,
          size_mb: (sizeInBytes / (1024 * 1024)).toFixed(2),
          max_mb: 2,
          github_url: githubUrl
        }, `README exceeds maximum size (${(sizeInBytes / (1024 * 1024)).toFixed(2)}MB), skipping`);
        
        return null;
      }
      
      logger.debug({
        operation: 'github_readme_get_content',
        step: 'size_validation_passed',
        owner,
        repo,
        size_bytes: sizeInBytes,
        size_kb: (sizeInBytes / 1024).toFixed(2)
      }, 'README size validation passed');
      
      // Sanitize HTML content for security (prevents XSS attacks)
      logger.debug({
        operation: 'github_readme_get_content',
        step: 'sanitization_start',
        owner,
        repo,
        original_size: decodedContent.length
      }, 'Starting README sanitization');
      
      const sanitizedContent = DOMPurify.sanitize(decodedContent, SANITIZE_CONFIG);
      
      // Calculate how much content was removed
      const removalBytes = decodedContent.length - sanitizedContent.length;
      const removalPercentage = ((removalBytes / decodedContent.length) * 100);
      
      // Log warning if significant content was removed (possible malicious content)
      if (removalPercentage > 10) {
        logger.warn({
          operation: 'github_readme_get_content',
          step: 'high_sanitization_removal',
          owner,
          repo,
          removal_percentage: removalPercentage.toFixed(2),
          removal_bytes: removalBytes,
          github_url: githubUrl
        }, `High sanitization removal rate detected: ${removalPercentage.toFixed(2)}% of content removed`);
      }
      
      const duration = Date.now() - startTime;
      
      logger.debug({
        operation: 'github_readme_get_content',
        step: 'complete',
        owner,
        repo,
        original_size: decodedContent.length,
        sanitized_size: sanitizedContent.length,
        removal_bytes: removalBytes,
        removal_percentage: removalPercentage.toFixed(2),
        duration_ms: duration,
        readme_name: data.name
      }, `Successfully fetched and sanitized README for ${owner}/${repo}`);
      
      return {
        content: sanitizedContent,
        encoding: 'utf8'
      };
      
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      if (error.status === 404) {
        logger.debug({
          operation: 'github_readme_get_content',
          step: 'not_found',
          owner,
          repo,
          branch,
          duration_ms: duration
        }, 'README not found in repository');
        return null;
      }
      
      if (error.status === 401) {
        logger.error({
          operation: 'github_readme_get_content',
          step: 'auth_failed',
          owner,
          repo,
          duration_ms: duration
        }, 'GitHub authentication failed');
        throw new Error('GitHub App authentication failed - invalid credentials');
      }
      
      if (error.status === 403) {
        logger.error({
          operation: 'github_readme_get_content',
          step: 'insufficient_permissions',
          owner,
          repo,
          duration_ms: duration
        }, `Insufficient permissions to access repository ${owner}/${repo}`);
        throw new Error(`Insufficient permissions to access repository ${owner}/${repo}`);
      }
      
      logger.error({
        operation: 'github_readme_get_content',
        step: 'api_call_failed',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          status: error.status
        },
        owner,
        repo,
        branch,
        githubUrl,
        duration_ms: duration
      }, `Failed to fetch README for ${owner}/${repo}`);
      
      throw error;
    }
  }
}
