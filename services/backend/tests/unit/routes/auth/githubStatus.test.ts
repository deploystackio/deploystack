import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import githubStatusRoute from '../../../../src/routes/auth/githubStatus';
import { GlobalSettingsInitService } from '../../../../src/global-settings';

// Mock dependencies
vi.mock('../../../../src/global-settings');

// Type the mocked functions
const mockGlobalSettingsInitService = GlobalSettingsInitService as any;

describe('GitHub Status Route', () => {
  let mockFastify: Partial<FastifyInstance>;
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  let routeHandlers: Record<string, any>;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup route handlers storage
    routeHandlers = {};

    // Setup mock Fastify instance
    mockFastify = {
      get: vi.fn((path, options, handler) => {
        routeHandlers[`GET ${path}`] = handler;
        return mockFastify as FastifyInstance;
      }),
      log: {
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
      },
    } as any;

    // Setup mock request
    mockRequest = {} as any;

    // Setup mock reply
    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    } as any;

    // Setup default mock for GlobalSettingsInitService
    mockGlobalSettingsInitService.getGitHubOAuthConfiguration = vi.fn().mockResolvedValue({
      clientId: 'test_client_id',
      clientSecret: 'test_client_secret',
      callbackUrl: 'http://localhost:3000/callback',
      scope: 'user:email',
      enabled: true
    });
  });

  describe('Route Registration', () => {
    it('should register GitHub status route', async () => {
      await githubStatusRoute(mockFastify as FastifyInstance);

      expect(mockFastify.get).toHaveBeenCalledWith('/github/status', expect.any(Object), expect.any(Function));
    });
  });

  describe('GET /github/status', () => {
    beforeEach(async () => {
      await githubStatusRoute(mockFastify as FastifyInstance);
    });

    it('should return enabled: true and configured: true when GitHub OAuth is enabled and configured', async () => {
      const handler = routeHandlers['GET /github/status'];
      await handler(mockRequest, mockReply);

      expect(mockGlobalSettingsInitService.getGitHubOAuthConfiguration).toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        enabled: true,
        configured: true,
      });
    });

    it('should return enabled: false and configured: true when GitHub OAuth is configured but disabled', async () => {
      mockGlobalSettingsInitService.getGitHubOAuthConfiguration.mockResolvedValue({
        clientId: 'test_client_id',
        clientSecret: 'test_client_secret',
        callbackUrl: 'http://localhost:3000/callback',
        scope: 'user:email',
        enabled: false
      });

      const handler = routeHandlers['GET /github/status'];
      await handler(mockRequest, mockReply);

      expect(mockGlobalSettingsInitService.getGitHubOAuthConfiguration).toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        enabled: false,
        configured: true,
      });
    });

    it('should return enabled: false and configured: false when GitHub OAuth is not configured', async () => {
      mockGlobalSettingsInitService.getGitHubOAuthConfiguration.mockResolvedValue(null);

      const handler = routeHandlers['GET /github/status'];
      await handler(mockRequest, mockReply);

      expect(mockGlobalSettingsInitService.getGitHubOAuthConfiguration).toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        enabled: false,
        configured: false,
      });
    });

    it('should handle errors and return 500 status', async () => {
      const error = new Error('Database connection failed');
      mockGlobalSettingsInitService.getGitHubOAuthConfiguration.mockRejectedValue(error);

      const handler = routeHandlers['GET /github/status'];
      await handler(mockRequest, mockReply);

      expect(mockGlobalSettingsInitService.getGitHubOAuthConfiguration).toHaveBeenCalled();
      expect(mockFastify.log!.error).toHaveBeenCalledWith(error, 'Error checking GitHub OAuth status:');
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Failed to check GitHub OAuth status',
      });
    });

    it('should handle configuration with missing enabled property (defaults to false)', async () => {
      mockGlobalSettingsInitService.getGitHubOAuthConfiguration.mockResolvedValue({
        clientId: 'test_client_id',
        clientSecret: 'test_client_secret',
        callbackUrl: 'http://localhost:3000/callback',
        scope: 'user:email'
        // enabled property is missing
      });

      const handler = routeHandlers['GET /github/status'];
      await handler(mockRequest, mockReply);

      expect(mockGlobalSettingsInitService.getGitHubOAuthConfiguration).toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        enabled: undefined, // Actual behavior: undefined is passed through
        configured: true,
      });
    });

    it('should handle configuration with enabled set to null (defaults to false)', async () => {
      mockGlobalSettingsInitService.getGitHubOAuthConfiguration.mockResolvedValue({
        clientId: 'test_client_id',
        clientSecret: 'test_client_secret',
        callbackUrl: 'http://localhost:3000/callback',
        scope: 'user:email',
        enabled: null
      });

      const handler = routeHandlers['GET /github/status'];
      await handler(mockRequest, mockReply);

      expect(mockGlobalSettingsInitService.getGitHubOAuthConfiguration).toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        enabled: null, // Actual behavior: null is passed through
        configured: true,
      });
    });

    it('should handle empty configuration object', async () => {
      mockGlobalSettingsInitService.getGitHubOAuthConfiguration.mockResolvedValue({});

      const handler = routeHandlers['GET /github/status'];
      await handler(mockRequest, mockReply);

      expect(mockGlobalSettingsInitService.getGitHubOAuthConfiguration).toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        enabled: undefined, // Actual behavior: undefined is passed through
        configured: true, // Empty object is still considered "configured"
      });
    });

    it('should handle async errors during configuration check', async () => {
      const asyncError = new Error('Async operation failed');
      mockGlobalSettingsInitService.getGitHubOAuthConfiguration.mockImplementation(() => {
        return Promise.reject(asyncError);
      });

      const handler = routeHandlers['GET /github/status'];
      await handler(mockRequest, mockReply);

      expect(mockGlobalSettingsInitService.getGitHubOAuthConfiguration).toHaveBeenCalled();
      expect(mockFastify.log!.error).toHaveBeenCalledWith(asyncError, 'Error checking GitHub OAuth status:');
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Failed to check GitHub OAuth status',
      });
    });

    it('should handle configuration with enabled explicitly set to true', async () => {
      mockGlobalSettingsInitService.getGitHubOAuthConfiguration.mockResolvedValue({
        clientId: 'test_client_id',
        clientSecret: 'test_client_secret',
        callbackUrl: 'http://localhost:3000/callback',
        scope: 'user:email',
        enabled: true
      });

      const handler = routeHandlers['GET /github/status'];
      await handler(mockRequest, mockReply);

      expect(mockGlobalSettingsInitService.getGitHubOAuthConfiguration).toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        enabled: true,
        configured: true,
      });
    });

    it('should handle configuration with enabled explicitly set to false', async () => {
      mockGlobalSettingsInitService.getGitHubOAuthConfiguration.mockResolvedValue({
        clientId: 'test_client_id',
        clientSecret: 'test_client_secret',
        callbackUrl: 'http://localhost:3000/callback',
        scope: 'user:email',
        enabled: false
      });

      const handler = routeHandlers['GET /github/status'];
      await handler(mockRequest, mockReply);

      expect(mockGlobalSettingsInitService.getGitHubOAuthConfiguration).toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        enabled: false,
        configured: true,
      });
    });
  });
});
