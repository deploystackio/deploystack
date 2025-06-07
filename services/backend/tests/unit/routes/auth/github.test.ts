import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import githubAuthRoutes from '../../../../src/routes/auth/github';
import { getLucia, getGithubAuth } from '../../../../src/lib/lucia';
import { getDb, getSchema } from '../../../../src/db';
import { generateId } from 'lucia';
import { generateState } from 'arctic';
import { GlobalSettingsInitService } from '../../../../src/global-settings';

// Mock dependencies
vi.mock('../../../../src/lib/lucia');
vi.mock('../../../../src/db');
vi.mock('lucia');
vi.mock('arctic');
vi.mock('../../../../src/global-settings');

// Mock fetch globally
global.fetch = vi.fn();

// Type the mocked functions
const mockGetLucia = getLucia as MockedFunction<typeof getLucia>;
const mockGetGithubAuth = getGithubAuth as MockedFunction<typeof getGithubAuth>;
const mockGetDb = getDb as MockedFunction<typeof getDb>;
const mockGetSchema = getSchema as MockedFunction<typeof getSchema>;
const mockGenerateId = generateId as MockedFunction<typeof generateId>;
const mockGenerateState = generateState as MockedFunction<typeof generateState>;
const mockGlobalSettingsInitService = GlobalSettingsInitService as any;
const mockFetch = fetch as MockedFunction<typeof fetch>;

describe('GitHub Auth Routes', () => {
  let mockFastify: Partial<FastifyInstance>;
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  let mockDb: any;
  let mockSchema: any;
  let mockLucia: any;
  let mockGithubAuth: any;
  let routeHandlers: Record<string, any>;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup mock database
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    };

    mockDb = {
      select: vi.fn().mockReturnValue(mockQuery),
      insert: vi.fn().mockReturnValue(mockQuery),
      update: vi.fn().mockReturnValue(mockQuery),
    };

    // Setup mock schema
    mockSchema = {
      authUser: {
        id: 'id',
        username: 'username',
        email: 'email',
        auth_type: 'auth_type',
        first_name: 'first_name',
        last_name: 'last_name',
        github_id: 'github_id',
      },
    };

    mockGetDb.mockReturnValue(mockDb);
    mockGetSchema.mockReturnValue(mockSchema);

    // Setup mock Lucia
    mockLucia = {
      createSession: vi.fn().mockResolvedValue({ id: 'session-123' }),
      createSessionCookie: vi.fn().mockReturnValue({
        name: 'session',
        value: 'session-cookie-value',
        attributes: { httpOnly: true, secure: true },
      }),
    };
    mockGetLucia.mockReturnValue(mockLucia);

    // Setup mock GitHub auth
    mockGithubAuth = {
      createAuthorizationURL: vi.fn().mockResolvedValue(new URL('https://github.com/login/oauth/authorize?state=test-state')),
      validateAuthorizationCode: vi.fn().mockResolvedValue({ accessToken: 'github-access-token' }),
    };
    mockGetGithubAuth.mockReturnValue(mockGithubAuth);

    // Setup other mocks
    mockGenerateId.mockReturnValue('user-123');
    mockGenerateState.mockReturnValue('test-state');
    mockGlobalSettingsInitService.isLoginEnabled = vi.fn().mockResolvedValue(true);

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
    mockRequest = {
      query: {
        code: 'github-auth-code',
        state: 'test-state',
      },
      cookies: {
        oauth_state: 'test-state',
      },
    };

    // Setup mock reply
    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      setCookie: vi.fn().mockReturnThis(),
      redirect: vi.fn().mockReturnThis(),
    };

    // Setup mock fetch responses
    mockFetch.mockImplementation((input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === 'https://api.github.com/user') {
        return Promise.resolve({
          json: () => Promise.resolve({
            id: 12345,
            login: 'testuser',
            name: 'Test User',
          }),
        } as Response);
      }
      if (url === 'https://api.github.com/user/emails') {
        return Promise.resolve({
          json: () => Promise.resolve([
            { email: 'test@example.com', primary: true, verified: true },
          ]),
        } as Response);
      }
      return Promise.reject(new Error('Unknown URL'));
    });
  });

  describe('Route Registration', () => {
    it('should register GitHub auth routes', async () => {
      await githubAuthRoutes(mockFastify as FastifyInstance);

      expect(mockFastify.get).toHaveBeenCalledWith('/login', expect.any(Object), expect.any(Function));
      expect(mockFastify.get).toHaveBeenCalledWith('/callback', expect.any(Object), expect.any(Function));
    });
  });

  describe('GET /login', () => {
    beforeEach(async () => {
      await githubAuthRoutes(mockFastify as FastifyInstance);
    });

    it('should redirect to GitHub OAuth URL', async () => {
      const handler = routeHandlers['GET /login'];
      await handler(mockRequest, mockReply);

      expect(mockGlobalSettingsInitService.isLoginEnabled).toHaveBeenCalled();
      expect(mockGenerateState).toHaveBeenCalled();
      expect(mockGithubAuth.createAuthorizationURL).toHaveBeenCalledWith('test-state', ['user:email']);
      expect(mockReply.setCookie).toHaveBeenCalledWith('oauth_state', 'test-state', expect.any(Object));
      expect(mockReply.redirect).toHaveBeenCalledWith('https://github.com/login/oauth/authorize?state=test-state');
    });

    it('should return 403 when login is disabled', async () => {
      mockGlobalSettingsInitService.isLoginEnabled.mockResolvedValue(false);

      const handler = routeHandlers['GET /login'];
      await handler(mockRequest, mockReply);

      expect(mockGlobalSettingsInitService.isLoginEnabled).toHaveBeenCalled();
      expect(mockGenerateState).not.toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Login is currently disabled by administrator.',
      });
    });
  });

  describe('GET /callback', () => {
    beforeEach(async () => {
      await githubAuthRoutes(mockFastify as FastifyInstance);
    });

    it('should handle GitHub callback for existing user', async () => {
      const existingUserQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: 'existing-user-123' }]),
      };

      mockDb.select.mockReturnValue(existingUserQuery);

      const handler = routeHandlers['GET /callback'];
      await handler(mockRequest, mockReply);

      expect(mockGlobalSettingsInitService.isLoginEnabled).toHaveBeenCalled();
      expect(mockGithubAuth.validateAuthorizationCode).toHaveBeenCalledWith('github-auth-code');
      expect(mockFetch).toHaveBeenCalledWith('https://api.github.com/user', expect.any(Object));
      expect(mockFetch).toHaveBeenCalledWith('https://api.github.com/user/emails', expect.any(Object));
      expect(mockLucia.createSession).toHaveBeenCalledWith('existing-user-123', {});
      expect(mockReply.setCookie).toHaveBeenCalledWith('session', 'session-cookie-value', expect.any(Object));
      expect(mockReply.redirect).toHaveBeenCalled();
    });

    it('should link GitHub account to existing email user', async () => {
      const noGithubUserQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]), // No GitHub user found
      };

      const existingEmailUserQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: 'email-user-123' }]), // Email user found
      };

      const updateQuery = {
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
      };

      mockDb.select
        .mockReturnValueOnce(noGithubUserQuery)
        .mockReturnValueOnce(existingEmailUserQuery);
      mockDb.update.mockReturnValue(updateQuery);

      const handler = routeHandlers['GET /callback'];
      await handler(mockRequest, mockReply);

      expect(mockDb.update).toHaveBeenCalled();
      expect(updateQuery.set).toHaveBeenCalledWith({ github_id: '12345' });
      expect(mockLucia.createSession).toHaveBeenCalledWith('email-user-123', {});
      expect(mockReply.redirect).toHaveBeenCalled();
    });

    it('should create new user for new GitHub account', async () => {
      const emptyQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]), // No users found
      };

      const insertQuery = {
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockResolvedValue(undefined),
      };

      mockDb.select.mockReturnValue(emptyQuery);
      mockDb.insert.mockReturnValue(insertQuery);

      const handler = routeHandlers['GET /callback'];
      await handler(mockRequest, mockReply);

      expect(mockGenerateId).toHaveBeenCalledWith(15);
      expect(mockDb.insert).toHaveBeenCalled();
      expect(insertQuery.values).toHaveBeenCalledWith({
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        auth_type: 'github',
        first_name: 'Test',
        last_name: 'User',
        github_id: '12345',
      });
      expect(mockLucia.createSession).toHaveBeenCalledWith('user-123', {});
      expect(mockReply.redirect).toHaveBeenCalled();
    });

    it('should return 403 when login is disabled', async () => {
      mockGlobalSettingsInitService.isLoginEnabled.mockResolvedValue(false);

      const handler = routeHandlers['GET /callback'];
      await handler(mockRequest, mockReply);

      expect(mockGlobalSettingsInitService.isLoginEnabled).toHaveBeenCalled();
      expect(mockGithubAuth.validateAuthorizationCode).not.toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Login is currently disabled by administrator.',
      });
    });

    it('should return 400 for invalid state parameter', async () => {
      mockRequest.cookies = { oauth_state: 'different-state' };

      const handler = routeHandlers['GET /callback'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.warn).toHaveBeenCalledWith('Invalid OAuth state parameter during GitHub callback.');
      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Invalid OAuth state. CSRF attempt?',
      });
    });

    it('should return 400 for missing state parameter', async () => {
      mockRequest.cookies = {};

      const handler = routeHandlers['GET /callback'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Invalid OAuth state. CSRF attempt?',
      });
    });

    it('should return 400 when GitHub email is not available', async () => {
      mockFetch.mockImplementation((input: string | URL | Request) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url === 'https://api.github.com/user') {
          return Promise.resolve({
            json: () => Promise.resolve({ id: 12345, login: 'testuser' }),
          } as Response);
        }
        if (url === 'https://api.github.com/user/emails') {
          return Promise.resolve({
            json: () => Promise.resolve([]), // No emails
          } as Response);
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      const handler = routeHandlers['GET /callback'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.error).toHaveBeenCalledWith('GitHub user email not available or not verified.');
      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'GitHub email not available. Please ensure your email is public and verified on GitHub.',
      });
    });

    it('should return 500 when auth tables are missing', async () => {
      mockGetSchema.mockReturnValue({ authUser: null });

      const handler = routeHandlers['GET /callback'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'An unexpected error occurred during GitHub login.',
      });
    });

    it('should return 400 for OAuth errors', async () => {
      mockGithubAuth.validateAuthorizationCode.mockRejectedValue(new Error('OAuth invalid_grant'));

      const handler = routeHandlers['GET /callback'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.error).toHaveBeenCalledWith(expect.any(Error), 'Error during GitHub OAuth callback:');
      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'GitHub OAuth error: OAuth invalid_grant',
      });
    });

    it('should return 409 for unique constraint errors', async () => {
      const emptyQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };

      const insertQuery = {
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockRejectedValue(new Error('UNIQUE constraint failed')),
      };

      mockDb.select.mockReturnValue(emptyQuery);
      mockDb.insert.mockReturnValue(insertQuery);

      const handler = routeHandlers['GET /callback'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(409);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'A user with this GitHub account or email already exists in a conflicting way.',
      });
    });

    it('should handle unexpected errors', async () => {
      mockGithubAuth.validateAuthorizationCode.mockRejectedValue(new Error('Unexpected error'));

      const handler = routeHandlers['GET /callback'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.error).toHaveBeenCalledWith(expect.any(Error), 'Error during GitHub OAuth callback:');
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'An unexpected error occurred during GitHub login.',
      });
    });

    it('should clear oauth_state cookie after validation', async () => {
      const emptyQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };

      mockDb.select.mockReturnValue(emptyQuery);

      const handler = routeHandlers['GET /callback'];
      await handler(mockRequest, mockReply);

      expect(mockReply.setCookie).toHaveBeenCalledWith('oauth_state', '', { maxAge: -1, path: '/' });
    });

    it('should handle GitHub user without name', async () => {
      mockFetch.mockImplementation((input: string | URL | Request) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url === 'https://api.github.com/user') {
          return Promise.resolve({
            json: () => Promise.resolve({
              id: 12345,
              login: 'testuser',
              // No name field
            }),
          } as Response);
        }
        if (url === 'https://api.github.com/user/emails') {
          return Promise.resolve({
            json: () => Promise.resolve([
              { email: 'test@example.com', primary: true, verified: true },
            ]),
          } as Response);
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      const emptyQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };

      const insertQuery = {
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockResolvedValue(undefined),
      };

      mockDb.select.mockReturnValue(emptyQuery);
      mockDb.insert.mockReturnValue(insertQuery);

      const handler = routeHandlers['GET /callback'];
      await handler(mockRequest, mockReply);

      expect(insertQuery.values).toHaveBeenCalledWith({
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        auth_type: 'github',
        first_name: null,
        last_name: null,
        github_id: '12345',
      });
    });
  });
});
