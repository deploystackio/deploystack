import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import getRepoInfo from '../../../../../src/routes/mcp/github/get-repo-info';

// Mock GitHubService to avoid actual API calls
vi.mock('../../../../../src/services/githubService', () => ({
  GitHubService: {
    getRepositoryInfo: vi.fn(),
    parseGitHubUrl: vi.fn(),
    getPackageJson: vi.fn(),
    getLatestRelease: vi.fn()
  }
}));

import { GitHubService } from '../../../../../src/services/githubService';

describe('GET /mcp/github/repo-info', () => {
  let server: FastifyInstance;

  beforeEach(async () => {
    server = Fastify();
    await server.register(getRepoInfo);
    await server.ready();
    
    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await server.close();
  });

  describe('Route Registration', () => {
    it('should register the GET route correctly', async () => {
      const routes = server.printRoutes();
      expect(routes).toContain('repo-info (GET, HEAD)');
    });

    it('should have correct route configuration', () => {
      const route = server.hasRoute({
        method: 'GET',
        url: '/mcp/github/repo-info'
      });
      expect(route).toBe(true);
    });
  });

  describe('Request Handling', () => {
    it('should return 400 Bad Request when URL parameter is missing', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/mcp/github/repo-info'
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return correct error response structure for missing URL', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/mcp/github/repo-info'
      });

      const payload = JSON.parse(response.payload);
      expect(payload).toHaveProperty('success', false);
      expect(payload).toHaveProperty('error');
      expect(typeof payload.error).toBe('string');
    });

    it('should return 400 for invalid GitHub URL', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/mcp/github/repo-info?url=https://invalid-url.com/repo'
      });

      expect(response.statusCode).toBe(400);
      const payload = JSON.parse(response.payload);
      expect(payload).toEqual({
        success: false,
        error: 'Invalid GitHub URL. Please provide a valid GitHub repository URL.'
      });
    });

    it('should return 200 for valid GitHub URL', async () => {
      // Mock successful repository info response
      const mockRepoInfo = {
        name: 'test-repo',
        description: 'Test repository',
        defaultBranch: 'main',
        homepage: 'https://example.com',
        license: 'MIT',
        language: 'TypeScript',
        topics: ['test', 'typescript'],
        stars: 100,
        forks: 20
      };

      const mockPackageInfo = {
        name: 'test-package',
        dependencies: { express: '^4.18.0' },
        engines: { node: '>=14.0.0' }
      };

      const mockLatestRelease = {
        version: '1.0.0'
      };

      vi.mocked(GitHubService.getRepositoryInfo).mockResolvedValue(mockRepoInfo);
      vi.mocked(GitHubService.parseGitHubUrl).mockReturnValue({ owner: 'test-owner', repo: 'test-repo' });
      vi.mocked(GitHubService.getPackageJson).mockResolvedValue(mockPackageInfo);
      vi.mocked(GitHubService.getLatestRelease).mockResolvedValue(mockLatestRelease);

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/github/repo-info?url=https://github.com/test-owner/test-repo'
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload).toHaveProperty('success', true);
      expect(payload).toHaveProperty('data');
      expect(payload.data).toHaveProperty('name', 'test-repo');
      expect(payload.data).toHaveProperty('description', 'Test repository');
      expect(payload.data).toHaveProperty('github_url', 'https://github.com/test-owner/test-repo');
    });

    it('should handle request with branch parameter', async () => {
      const mockRepoInfo = {
        name: 'test-repo',
        description: 'Test repository',
        defaultBranch: 'main',
        homepage: null,
        license: null,
        language: 'JavaScript',
        topics: [],
        stars: 0,
        forks: 0
      };

      vi.mocked(GitHubService.getRepositoryInfo).mockResolvedValue(mockRepoInfo);
      vi.mocked(GitHubService.parseGitHubUrl).mockReturnValue({ owner: 'test-owner', repo: 'test-repo' });
      vi.mocked(GitHubService.getPackageJson).mockRejectedValue(new Error('Not found'));
      vi.mocked(GitHubService.getLatestRelease).mockRejectedValue(new Error('Not found'));

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/github/repo-info?url=https://github.com/test-owner/test-repo&branch=develop'
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.data).toHaveProperty('git_branch', 'develop');
    });
  });

  describe('Error Handling', () => {
    it('should handle GitHub API 404 errors gracefully', async () => {
      vi.mocked(GitHubService.getRepositoryInfo).mockRejectedValue({
        status: 404,
        message: 'Not Found'
      });

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/github/repo-info?url=https://github.com/test-owner/non-existent-repo'
      });

      expect(response.statusCode).toBe(400);
      const payload = JSON.parse(response.payload);
      expect(payload).toEqual({
        success: false,
        error: 'Repository not found. Please check the URL and ensure the repository is public.'
      });
    });

    it('should handle GitHub API 403 errors gracefully', async () => {
      vi.mocked(GitHubService.getRepositoryInfo).mockRejectedValue({
        status: 403,
        message: 'Forbidden'
      });

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/github/repo-info?url=https://github.com/test-owner/private-repo'
      });

      expect(response.statusCode).toBe(400);
      const payload = JSON.parse(response.payload);
      expect(payload).toEqual({
        success: false,
        error: 'Access denied. The repository may be private or GitHub API rate limit exceeded.'
      });
    });

    it('should handle general errors gracefully', async () => {
      vi.mocked(GitHubService.getRepositoryInfo).mockRejectedValue(new Error('Network error'));

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/github/repo-info?url=https://github.com/test-owner/test-repo'
      });

      expect(response.statusCode).toBe(500);
      const payload = JSON.parse(response.payload);
      expect(payload).toEqual({
        success: false,
        error: 'Failed to fetch repository information. Please try again later.'
      });
    });

    it('should handle malformed requests gracefully', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/mcp/github/repo-info?url=not-a-url'
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Data Structure', () => {
    it('should return correct data structure for successful response', async () => {
      const mockRepoInfo = {
        name: 'test-repo',
        description: 'Test repository',
        defaultBranch: 'main',
        homepage: 'https://example.com',
        license: 'MIT',
        language: 'TypeScript',
        topics: ['test', 'typescript'],
        stars: 100,
        forks: 20
      };

      vi.mocked(GitHubService.getRepositoryInfo).mockResolvedValue(mockRepoInfo);
      vi.mocked(GitHubService.parseGitHubUrl).mockReturnValue({ owner: 'test-owner', repo: 'test-repo' });
      vi.mocked(GitHubService.getPackageJson).mockRejectedValue(new Error('Not found'));
      vi.mocked(GitHubService.getLatestRelease).mockRejectedValue(new Error('Not found'));

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/github/repo-info?url=https://github.com/test-owner/test-repo'
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      
      expect(payload).toHaveProperty('success', true);
      expect(payload).toHaveProperty('data');
      
      const data = payload.data;
      expect(data).toHaveProperty('name');
      expect(data).toHaveProperty('description');
      expect(data).toHaveProperty('github_url');
      expect(data).toHaveProperty('git_branch');
      expect(data).toHaveProperty('homepage_url');
      expect(data).toHaveProperty('author_name');
      expect(data).toHaveProperty('organization');
      expect(data).toHaveProperty('license');
      expect(data).toHaveProperty('language');
      expect(data).toHaveProperty('runtime');
      expect(data).toHaveProperty('tags');
      expect(data).toHaveProperty('installation_methods');
      expect(data).toHaveProperty('dependencies');
      expect(data).toHaveProperty('latest_version');
      expect(data).toHaveProperty('stars');
      expect(data).toHaveProperty('forks');
    });

    it('should infer correct runtime for TypeScript', async () => {
      const mockRepoInfo = {
        name: 'test-repo',
        description: 'Test repository',
        defaultBranch: 'main',
        homepage: null,
        license: null,
        language: 'TypeScript',
        topics: [],
        stars: 0,
        forks: 0
      };

      vi.mocked(GitHubService.getRepositoryInfo).mockResolvedValue(mockRepoInfo);
      vi.mocked(GitHubService.parseGitHubUrl).mockReturnValue({ owner: 'test-owner', repo: 'test-repo' });
      vi.mocked(GitHubService.getPackageJson).mockRejectedValue(new Error('Not found'));
      vi.mocked(GitHubService.getLatestRelease).mockRejectedValue(new Error('Not found'));

      const response = await server.inject({
        method: 'GET',
        url: '/mcp/github/repo-info?url=https://github.com/test-owner/test-repo'
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.data).toHaveProperty('runtime', 'node');
    });
  });

  describe('HTTP Method Restrictions', () => {
    it('should not accept POST requests', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/mcp/github/repo-info'
      });

      expect(response.statusCode).toBe(404);
    });

    it('should not accept PUT requests', async () => {
      const response = await server.inject({
        method: 'PUT',
        url: '/mcp/github/repo-info'
      });

      expect(response.statusCode).toBe(404);
    });

    it('should not accept DELETE requests', async () => {
      const response = await server.inject({
        method: 'DELETE',
        url: '/mcp/github/repo-info'
      });

      expect(response.statusCode).toBe(404);
    });

    it('should not accept PATCH requests', async () => {
      const response = await server.inject({
        method: 'PATCH',
        url: '/mcp/github/repo-info'
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
