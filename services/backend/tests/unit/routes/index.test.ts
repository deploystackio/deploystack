import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { registerRoutes } from '../../../src/routes/index';
import { getVersionString } from '../../../src/config/version';

// Get version dynamically from version config
const CURRENT_VERSION = getVersionString();

// Mock the route modules
vi.mock('../../../src/routes/db/status');
vi.mock('../../../src/routes/db/setup');
vi.mock('../../../src/routes/roles');
vi.mock('../../../src/routes/users');
vi.mock('../../../src/routes/globalSettings');
vi.mock('../../../src/routes/teams');
vi.mock('../../../src/routes/cloud-credentials');
vi.mock('../../../src/routes/health');
vi.mock('../../../src/routes/mcp');
vi.mock('../../../src/routes/oauth2');
vi.mock('../../../src/routes/admin');
vi.mock('../../../src/routes/gateway');
vi.mock('../../../src/routes/satellites');

// Mock the GlobalSettings helper
vi.mock('../../../src/global-settings/helpers', () => ({
  GlobalSettings: {
    getBoolean: vi.fn()
  }
}));

// Import mocked modules
import dbStatusRoute from '../../../src/routes/db/status';
import dbSetupRoute from '../../../src/routes/db/setup';
import rolesRoute from '../../../src/routes/roles';
import usersRoute from '../../../src/routes/users';
import globalSettingsRoute from '../../../src/routes/globalSettings';
import teamsRoute from '../../../src/routes/teams';
import cloudCredentialsRoute from '../../../src/routes/cloud-credentials';
import healthRoute from '../../../src/routes/health';
import mcpRoutes from '../../../src/routes/mcp';
import { oauth2DiscoveryRoutes, oauth2ApiRoutes } from '../../../src/routes/oauth2';
import adminRoutes from '../../../src/routes/admin';
import gatewayRoutes from '../../../src/routes/gateway';
import satellitesRoutes from '../../../src/routes/satellites';
import { GlobalSettings } from '../../../src/global-settings/helpers';

// Type the mocked functions
const mockDbStatusRoute = dbStatusRoute as MockedFunction<typeof dbStatusRoute>;
const mockDbSetupRoute = dbSetupRoute as MockedFunction<typeof dbSetupRoute>;
const mockRolesRoute = rolesRoute as MockedFunction<typeof rolesRoute>;
const mockUsersRoute = usersRoute as MockedFunction<typeof usersRoute>;
const mockGlobalSettingsRoute = globalSettingsRoute as MockedFunction<typeof globalSettingsRoute>;
const mockTeamsRoute = teamsRoute as MockedFunction<typeof teamsRoute>;
const mockCloudCredentialsRoute = cloudCredentialsRoute as MockedFunction<typeof cloudCredentialsRoute>;
const mockHealthRoute = healthRoute as MockedFunction<typeof healthRoute>;
const mockMcpRoutes = mcpRoutes as MockedFunction<typeof mcpRoutes>;
const mockOAuth2DiscoveryRoutes = oauth2DiscoveryRoutes as MockedFunction<typeof oauth2DiscoveryRoutes>;
const mockOAuth2ApiRoutes = oauth2ApiRoutes as MockedFunction<typeof oauth2ApiRoutes>;
const mockAdminRoutes = adminRoutes as MockedFunction<typeof adminRoutes>;
const mockGatewayRoutes = gatewayRoutes as MockedFunction<typeof gatewayRoutes>;
const mockSatellitesRoutes = satellitesRoutes as MockedFunction<typeof satellitesRoutes>;

describe('Main Routes Registration', () => {
  let mockFastify: Partial<FastifyInstance> & { db?: any };
  let mockApiInstance: Partial<FastifyInstance>;
  let routeHandlers: Record<string, any>;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup route handlers storage
    routeHandlers = {};

    // Setup mock API instance
    mockApiInstance = {
      register: vi.fn().mockResolvedValue(undefined),
    } as any;

    // Setup mock Fastify instance
    mockFastify = {
      register: vi.fn().mockImplementation(async (plugin, options) => {
        if (typeof plugin === 'function') {
          // Call the plugin function with the mock API instance
          await plugin(mockApiInstance as FastifyInstance);
        }
        return undefined;
      }),
      get: vi.fn((path, options, handler) => {
        routeHandlers[`GET ${path}`] = handler;
        return mockFastify as FastifyInstance;
      }),
      db: null, // Initially no database
      log: {
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
      },
    } as any;

    // Mock route modules to return resolved promises
    mockDbStatusRoute.mockResolvedValue(undefined);
    mockDbSetupRoute.mockResolvedValue(undefined);
    mockRolesRoute.mockResolvedValue(undefined);
    mockUsersRoute.mockResolvedValue(undefined);
    mockGlobalSettingsRoute.mockResolvedValue(undefined);
    mockTeamsRoute.mockResolvedValue(undefined);
    mockCloudCredentialsRoute.mockResolvedValue(undefined);
    mockHealthRoute.mockResolvedValue(undefined);
    mockMcpRoutes.mockResolvedValue(undefined);
    mockOAuth2DiscoveryRoutes.mockResolvedValue(undefined);
    mockOAuth2ApiRoutes.mockResolvedValue(undefined);
    mockAdminRoutes.mockResolvedValue(undefined);
    mockGatewayRoutes.mockResolvedValue(undefined);
    mockSatellitesRoutes.mockResolvedValue(undefined);
  });

  describe('Version Management', () => {
    it('should read version from version config', () => {
      expect(CURRENT_VERSION).toBeDefined();
      expect(typeof CURRENT_VERSION).toBe('string');
      expect(CURRENT_VERSION).toMatch(/^\d+\.\d+\.\d+/);
    });
  });

  describe('Route Registration', () => {
    it('should register all route modules', async () => {
      await registerRoutes(mockFastify as FastifyInstance);

      // Main server should register OAuth2 discovery routes and API routes (2 times)
      expect(mockFastify.register).toHaveBeenCalledTimes(2);

      // The API instance should register routes
      expect(mockApiInstance.register).toHaveBeenCalled();

      // Verify that the core routes are being registered
      // OAuth2 discovery routes + health route + dbStatusRoute = 3 minimum
      expect(mockApiInstance.register).toHaveBeenCalledWith(oauth2DiscoveryRoutes);
      expect(mockApiInstance.register).toHaveBeenCalledWith(healthRoute);
      expect(mockApiInstance.register).toHaveBeenCalledWith(dbStatusRoute);

      // Verify that the register function was called at least 3 times (for the routes we can confirm)
      expect(mockApiInstance.register).toHaveBeenCalledTimes(3);
    });

    it('should register health check route', async () => {
      await registerRoutes(mockFastify as FastifyInstance);

      expect(mockFastify.get).toHaveBeenCalledWith('/', expect.any(Object), expect.any(Function));
    });

    it('should register health check route with proper schema', async () => {
      await registerRoutes(mockFastify as FastifyInstance);

      const [path, options] = (mockFastify.get as any).mock.calls[0];
      expect(path).toBe('/');
      expect(options.schema).toBeDefined();
      expect(options.schema.tags).toEqual(['Health Check']);
      expect(options.schema.summary).toBe('API health check');
      expect(options.schema.response).toBeDefined();
      expect(options.schema.response[200]).toBeDefined();
    });
  });

  describe('Health Check Endpoint', () => {
    let mockRequest: Partial<FastifyRequest>;
    let mockReply: Partial<FastifyReply>;

    beforeEach(async () => {
      mockRequest = {
        log: {
          debug: vi.fn(),
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          fatal: vi.fn(),
          trace: vi.fn(),
          silent: vi.fn(),
          child: vi.fn(),
          level: 'info'
        }
      } as any;
      mockReply = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
      };

      // Reset GlobalSettings mock
      vi.mocked(GlobalSettings.getBoolean).mockResolvedValue(true);

      await registerRoutes(mockFastify as FastifyInstance);
    });

    it('should return health check with database not configured', async () => {
      mockFastify.db = null;

      const handler = routeHandlers['GET /'];
      const result = await handler(mockRequest, mockReply);

      expect(result).toEqual({
        message: 'DeployStack Backend is running.',
        status: 'Database Not Configured/Connected - Use /api/db/status and /api/db/setup',
        timestamp: expect.any(String),
        version: CURRENT_VERSION
      });

      // Verify timestamp is a valid ISO string
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
      
      // Verify GlobalSettings was called
      expect(GlobalSettings.getBoolean).toHaveBeenCalledWith('global.show_version', true);
    });

    it('should return health check with database connected', async () => {
      mockFastify.db = { /* mock database object */ } as any;

      const handler = routeHandlers['GET /'];
      const result = await handler(mockRequest, mockReply);

      expect(result).toEqual({
        message: 'DeployStack Backend is running.',
        status: 'Database Connected',
        timestamp: expect.any(String),
        version: CURRENT_VERSION
      });

      // Verify timestamp is a valid ISO string
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
      
      // Verify GlobalSettings was called
      expect(GlobalSettings.getBoolean).toHaveBeenCalledWith('global.show_version', true);
    });

    it('should return consistent timestamp format', async () => {
      const handler = routeHandlers['GET /'];
      const result = await handler(mockRequest, mockReply);

      // Verify timestamp is in ISO format
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should return correct version when show_version is true', async () => {
      vi.mocked(GlobalSettings.getBoolean).mockResolvedValue(true);

      const handler = routeHandlers['GET /'];
      const result = await handler(mockRequest, mockReply);

      expect(result.version).toBe(CURRENT_VERSION);
      expect(GlobalSettings.getBoolean).toHaveBeenCalledWith('global.show_version', true);
    });

    it('should not return version when show_version is false', async () => {
      vi.mocked(GlobalSettings.getBoolean).mockResolvedValue(false);

      const handler = routeHandlers['GET /'];
      const result = await handler(mockRequest, mockReply);

      expect(result.version).toBeUndefined();
      expect(result).not.toHaveProperty('version');
      expect(GlobalSettings.getBoolean).toHaveBeenCalledWith('global.show_version', true);
    });

    it('should handle undefined database gracefully', async () => {
      mockFastify.db = undefined as any;

      const handler = routeHandlers['GET /'];
      const result = await handler(mockRequest, mockReply);

      expect(result.status).toBe('Database Not Configured/Connected - Use /api/db/status and /api/db/setup');
      expect(GlobalSettings.getBoolean).toHaveBeenCalledWith('global.show_version', true);
    });

    it('should handle falsy database values', async () => {
      mockFastify.db = false as any;

      const handler = routeHandlers['GET /'];
      const result = await handler(mockRequest, mockReply);

      expect(result.status).toBe('Database Not Configured/Connected - Use /api/db/status and /api/db/setup');
      expect(GlobalSettings.getBoolean).toHaveBeenCalledWith('global.show_version', true);
    });

    it('should log debug information about version display', async () => {
      vi.mocked(GlobalSettings.getBoolean).mockResolvedValue(false);

      const handler = routeHandlers['GET /'];
      await handler(mockRequest, mockReply);

      expect(mockRequest.log?.debug).toHaveBeenCalledWith({
        operation: 'root_endpoint_version_check',
        showVersion: false,
        setting: 'global.show_version'
      }, 'Checking version display setting');

      expect(mockRequest.log?.debug).toHaveBeenCalledWith({
        operation: 'root_endpoint_response',
        includeVersion: false
      }, 'Version hidden from root endpoint response per global setting');
    });

    it('should log when version is included', async () => {
      vi.mocked(GlobalSettings.getBoolean).mockResolvedValue(true);

      const handler = routeHandlers['GET /'];
      const result = await handler(mockRequest, mockReply);

      expect(mockRequest.log?.debug).toHaveBeenCalledWith({
        operation: 'root_endpoint_version_check',
        showVersion: true,
        setting: 'global.show_version'
      }, 'Checking version display setting');

      expect(mockRequest.log?.debug).toHaveBeenCalledWith({
        operation: 'root_endpoint_response',
        includeVersion: true,
        version: result.version
      }, 'Including version in root endpoint response');
    });
  });

  describe('Error Handling', () => {
    it('should register routes successfully even with mock setup', async () => {
      // Test that the function completes without throwing
      const result = await registerRoutes(mockFastify as FastifyInstance);
      expect(result).toBeUndefined();

      // Verify OAuth2 discovery routes and API routes were registered (2 times)
      expect(mockFastify.register).toHaveBeenCalledTimes(2);
    });

    it('should register health check route regardless of other routes', async () => {
      await registerRoutes(mockFastify as FastifyInstance);
      
      // Verify health check route was registered
      expect(mockFastify.get).toHaveBeenCalledWith('/', expect.any(Object), expect.any(Function));
    });
  });

  describe('Route Registration Order', () => {
    it('should register routes in the correct order', async () => {
      await registerRoutes(mockFastify as FastifyInstance);

      const apiRegisterCalls = (mockApiInstance.register as any).mock.calls;

      // Verify that at least some routes are registered and in the expected order
      expect(apiRegisterCalls.length).toBeGreaterThan(0);

      // OAuth2 discovery routes are registered first, followed by API routes
      // Check that oauth2DiscoveryRoutes is registered first
      if (apiRegisterCalls.length > 0) {
        expect(apiRegisterCalls[0][0]).toBe(oauth2DiscoveryRoutes);
      }

      // Then healthRoute should be registered (as first route in API instance)
      if (apiRegisterCalls.length > 1) {
        expect(apiRegisterCalls[1][0]).toBe(healthRoute);
      }

      // Then dbStatusRoute
      if (apiRegisterCalls.length > 2) {
        expect(apiRegisterCalls[2][0]).toBe(dbStatusRoute);
      }

      // Verify that the main routes we expect are present in the calls
      const registeredRoutes = apiRegisterCalls.map((call: any) => call[0]);
      expect(registeredRoutes).toContain(oauth2DiscoveryRoutes);
      expect(registeredRoutes).toContain(healthRoute);
      expect(registeredRoutes).toContain(dbStatusRoute);
    });
  });
});
