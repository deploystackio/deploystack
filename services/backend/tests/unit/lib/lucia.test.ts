import { describe, it, expect, vi, beforeEach, afterEach, type MockedFunction } from 'vitest';
import { Lucia } from 'lucia';
import { DrizzlePostgreSQLAdapter } from '@lucia-auth/adapter-drizzle';
import { GitHub } from 'arctic';
import { getLucia, getGithubAuth, resetLucia, resetGithubAuth } from '../../../src/lib/lucia';
import { getDbStatus, getDb, authUser, authSession } from '../../../src/db';

// Mock dependencies
vi.mock('lucia');
vi.mock('@lucia-auth/adapter-drizzle');
vi.mock('arctic');
vi.mock('../../../src/db', () => ({
  getDbStatus: vi.fn(),
  getDb: vi.fn(),
  authUser: {
    id: 'id',
    username: 'username',
    email: 'email',
    first_name: 'first_name',
    last_name: 'last_name',
    auth_type: 'auth_type',
    github_id: 'github_id',
  },
  authSession: {
    id: 'id',
    user_id: 'user_id',
    expires_at: 'expires_at',
  },
}));

// Type the mocked modules
const mockLucia = vi.mocked(Lucia);
const mockDrizzlePostgreSQLAdapter = vi.mocked(DrizzlePostgreSQLAdapter);
const mockGitHub = vi.mocked(GitHub);
const mockGetDbStatus = getDbStatus as MockedFunction<typeof getDbStatus>;
const mockGetDb = getDb as MockedFunction<typeof getDb>;

describe('Lucia Authentication Library', () => {
  let mockDb: any;
  let mockLuciaInstance: any;
  let mockGithubInstance: any;
  let mockAdapter: any;
  let originalEnv: NodeJS.ProcessEnv;
  let consoleLogSpy: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Store original environment
    originalEnv = { ...process.env };

    // Setup console.log spy
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Setup mock database
    mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    // Setup mock Lucia instance
    mockLuciaInstance = {
      createSession: vi.fn(),
      validateSession: vi.fn(),
      invalidateSession: vi.fn(),
      createSessionCookie: vi.fn(),
      createBlankSessionCookie: vi.fn(),
    };

    // Setup mock GitHub instance
    mockGithubInstance = {
      createAuthorizationURL: vi.fn(),
      validateAuthorizationCode: vi.fn(),
    };

    // Setup mock adapter
    mockAdapter = {
      getSessionAndUser: vi.fn(),
      getUserSessions: vi.fn(),
      setSession: vi.fn(),
      updateSessionExpiration: vi.fn(),
      deleteSession: vi.fn(),
      deleteUserSessions: vi.fn(),
      deleteExpiredSessions: vi.fn(),
    };

    // Setup default mocks
    mockGetDbStatus.mockReturnValue({
      dialect: 'postgresql',
      type: 'postgresql',
      configured: true,
      initialized: true,
    });
    mockGetDb.mockReturnValue(mockDb);
    mockDrizzlePostgreSQLAdapter.mockReturnValue(mockAdapter);
    mockLucia.mockReturnValue(mockLuciaInstance);
    mockGitHub.mockReturnValue(mockGithubInstance);

    // Reset Lucia and GitHub instances before each test
    resetLucia();
    resetGithubAuth();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;

    // Restore console.log
    consoleLogSpy.mockRestore();

    // Reset all mocks
    vi.clearAllMocks();
  });

  describe('getLucia', () => {
    it('should create and return Lucia instance successfully', () => {
      const lucia = getLucia();

      expect(mockGetDbStatus).toHaveBeenCalled();
      expect(mockGetDb).toHaveBeenCalled();
      expect(mockDrizzlePostgreSQLAdapter).toHaveBeenCalledWith(
        mockDb,
        expect.anything(),
        expect.anything()
      );
      expect(mockLucia).toHaveBeenCalledWith(mockAdapter, expect.objectContaining({
        sessionCookie: expect.objectContaining({
          name: 'session',
          expires: false,
          attributes: expect.objectContaining({
            path: '/',
          }),
        }),
        getUserAttributes: expect.any(Function),
        getSessionAttributes: expect.any(Function),
      }));
      expect(lucia).toBe(mockLuciaInstance);
    });

    it('should return cached instance on subsequent calls', () => {
      const lucia1 = getLucia();
      const lucia2 = getLucia();

      expect(lucia1).toBe(lucia2);
      expect(mockLucia).toHaveBeenCalledTimes(1);
    });

    it('should throw error when database is not configured', () => {
      mockGetDbStatus.mockReturnValue({
        dialect: 'postgresql',
        type: 'postgresql',
        configured: false,
        initialized: true,
      });

      expect(() => getLucia()).toThrow(
        'Database not configured or initialized. Ensure database is set up before using Lucia.'
      );
    });

    it('should throw error when database is not initialized', () => {
      mockGetDbStatus.mockReturnValue({
        dialect: 'postgresql',
        type: 'postgresql',
        configured: true,
        initialized: false,
      });

      expect(() => getLucia()).toThrow(
        'Database not configured or initialized. Ensure database is set up before using Lucia.'
      );
    });

    it('should throw error for unsupported database dialect', () => {
      mockGetDbStatus.mockReturnValue({
        dialect: 'sqlite' as any,
        type: 'sqlite' as any,
        configured: true,
        initialized: true,
      });

      expect(() => getLucia()).toThrow('Unsupported database type for authentication: sqlite. DeployStack now requires PostgreSQL.');
    });

    // Note: Tests for missing authUser/authSession tables are skipped
    // because Vitest doesn't support dynamically changing module-level mocks.
    // The actual error handling for these cases is still present in lucia.ts.

    it('should configure session cookie for production environment', () => {
      process.env.NODE_ENV = 'production';

      getLucia();

      expect(mockLucia).toHaveBeenCalledWith(mockAdapter, expect.objectContaining({
        sessionCookie: expect.objectContaining({
          attributes: expect.objectContaining({
            secure: true,
            sameSite: 'none',
            domain: undefined,
          }),
        }),
      }));
    });

    it('should configure session cookie for development environment', () => {
      process.env.NODE_ENV = 'development';

      getLucia();

      expect(mockLucia).toHaveBeenCalledWith(mockAdapter, expect.objectContaining({
        sessionCookie: expect.objectContaining({
          attributes: expect.objectContaining({
            secure: false,
            sameSite: 'lax',
            domain: 'localhost',
          }),
        }),
      }));
    });

    it('should not log in test mode', () => {
      process.env.NODE_ENV = 'test';

      getLucia();

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should log in non-test mode', () => {
      process.env.NODE_ENV = 'development';

      // Mock process.stdout.write to capture structured logging
      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      getLucia();

      // Check that structured logging was called
      expect(stdoutSpy).toHaveBeenCalledWith(
        expect.stringContaining('Lucia adapter created for PostgreSQL database')
      );

      stdoutSpy.mockRestore();
    });

    it('should configure getUserAttributes correctly', () => {
      getLucia();

      const luciaConfig = mockLucia.mock.calls[0]?.[1];
      expect(luciaConfig).toBeDefined();
      const getUserAttributes = luciaConfig?.getUserAttributes;
      expect(getUserAttributes).toBeDefined();

      const mockAttributes = {
        username: 'testuser',
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User',
        auth_type: 'email_signup' as const,
        github_id: '12345',
      };

      const result = getUserAttributes!(mockAttributes);

      expect(result).toEqual({
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        authType: 'email_signup',
        githubId: '12345',
      });
    });

    it('should configure getSessionAttributes correctly', () => {
      getLucia();

      const luciaConfig = mockLucia.mock.calls[0]?.[1];
      expect(luciaConfig).toBeDefined();
      const getSessionAttributes = luciaConfig?.getSessionAttributes;
      expect(getSessionAttributes).toBeDefined();

      const result = getSessionAttributes!({} as any);

      expect(result).toEqual({});
    });
  });

  describe('getGithubAuth', () => {
    it('should create and return GitHub instance with environment variables', async () => {
      // Mock GlobalSettingsInitService
      const mockGlobalSettingsInitService = {
        getGitHubOAuthConfiguration: vi.fn().mockResolvedValue({
          clientId: 'test_client_id',
          clientSecret: 'test_client_secret',
          callbackUrl: 'http://localhost:3000/callback'
        })
      };

      vi.doMock('../../../src/global-settings', () => ({
        GlobalSettingsInitService: mockGlobalSettingsInitService
      }));

      const github = await getGithubAuth();

      expect(mockGitHub).toHaveBeenCalledWith(
        'test_client_id',
        'test_client_secret',
        'http://localhost:3000/callback'
      );
      expect(github).toBe(mockGithubInstance);
    });

    it('should create GitHub instance with default values when env vars are missing', async () => {
      // Mock GlobalSettingsInitService returning null (not configured)
      const mockGlobalSettingsInitService = {
        getGitHubOAuthConfiguration: vi.fn().mockResolvedValue(null)
      };

      vi.doMock('../../../src/global-settings', () => ({
        GlobalSettingsInitService: mockGlobalSettingsInitService
      }));

      const github = await getGithubAuth();

      expect(mockGitHub).toHaveBeenCalledWith(
        'not_configured',
        'not_configured',
        'http://localhost:3000/api/auth/github/callback'
      );
      expect(github).toBe(mockGithubInstance);
    });

    it('should return cached instance on subsequent calls', async () => {
      // Mock GlobalSettingsInitService
      const mockGlobalSettingsInitService = {
        getGitHubOAuthConfiguration: vi.fn().mockResolvedValue({
          clientId: 'test_client_id',
          clientSecret: 'test_client_secret',
          callbackUrl: 'http://localhost:3000/callback'
        })
      };

      vi.doMock('../../../src/global-settings', () => ({
        GlobalSettingsInitService: mockGlobalSettingsInitService
      }));

      const github1 = await getGithubAuth();
      const github2 = await getGithubAuth();

      expect(github1).toBe(github2);
      expect(mockGitHub).toHaveBeenCalledTimes(1);
    });
  });

  describe('resetLucia', () => {
    it('should reset Lucia instance', () => {
      // Create initial instance
      const lucia1 = getLucia();
      expect(lucia1).toBe(mockLuciaInstance);

      // Reset and create new instance
      resetLucia();
      const lucia2 = getLucia();

      expect(lucia2).toBe(mockLuciaInstance);
      expect(mockLucia).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', () => {
      mockGetDb.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      expect(() => getLucia()).toThrow('Database connection failed');
    });

    // Note: Test for schema retrieval errors skipped - same reason as missing table tests above

    it('should handle adapter creation errors gracefully', () => {
      mockDrizzlePostgreSQLAdapter.mockImplementation(() => {
        throw new Error('Adapter creation failed');
      });

      expect(() => getLucia()).toThrow('Adapter creation failed');
    });

    it('should handle Lucia instantiation errors gracefully', () => {
      mockLucia.mockImplementation(() => {
        throw new Error('Lucia initialization failed');
      });

      expect(() => getLucia()).toThrow('Lucia initialization failed');
    });
  });

  describe('Environment Configuration', () => {
    it('should handle missing NODE_ENV gracefully', () => {
      delete process.env.NODE_ENV;

      getLucia();

      expect(mockLucia).toHaveBeenCalledWith(mockAdapter, expect.objectContaining({
        sessionCookie: expect.objectContaining({
          attributes: expect.objectContaining({
            secure: false,
            sameSite: 'lax',
            domain: 'localhost',
          }),
        }),
      }));
    });

    it('should handle custom NODE_ENV values', () => {
      process.env.NODE_ENV = 'staging';

      getLucia();

      expect(mockLucia).toHaveBeenCalledWith(mockAdapter, expect.objectContaining({
        sessionCookie: expect.objectContaining({
          attributes: expect.objectContaining({
            secure: false,
            sameSite: 'lax',
            domain: 'localhost',
          }),
        }),
      }));
    });
  });

  describe('Type Safety', () => {
    it('should handle null values in user attributes', () => {
      getLucia();

      const luciaConfig = mockLucia.mock.calls[0]?.[1];
      expect(luciaConfig).toBeDefined();
      const getUserAttributes = luciaConfig?.getUserAttributes;
      expect(getUserAttributes).toBeDefined();

      const mockAttributes = {
        username: 'testuser',
        email: 'test@example.com',
        first_name: null,
        last_name: null,
        auth_type: 'github' as const,
        github_id: null,
      };

      const result = getUserAttributes!(mockAttributes);

      expect(result).toEqual({
        username: 'testuser',
        email: 'test@example.com',
        firstName: null,
        lastName: null,
        authType: 'github',
        githubId: null,
      });
    });

    it('should handle different auth types', () => {
      getLucia();

      const luciaConfig = mockLucia.mock.calls[0]?.[1];
      expect(luciaConfig).toBeDefined();
      const getUserAttributes = luciaConfig?.getUserAttributes;
      expect(getUserAttributes).toBeDefined();

      const emailSignupAttributes = {
        username: 'testuser',
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User',
        auth_type: 'email_signup' as const,
        github_id: null,
      };

      const githubAttributes = {
        username: 'githubuser',
        email: 'github@example.com',
        first_name: 'GitHub',
        last_name: 'User',
        auth_type: 'github' as const,
        github_id: '12345',
      };

      const emailResult = getUserAttributes!(emailSignupAttributes) as any;
      const githubResult = getUserAttributes!(githubAttributes) as any;

      expect(emailResult.authType).toBe('email_signup');
      expect(emailResult.githubId).toBeNull();

      expect(githubResult.authType).toBe('github');
      expect(githubResult.githubId).toBe('12345');
    });
  });
});
