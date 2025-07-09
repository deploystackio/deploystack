import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import listServers from '../../../../../src/routes/mcp/servers/list';

// Mock dependencies
vi.mock('../../../../../src/services/mcpCatalogService');
vi.mock('../../../../../src/services/teamService');
vi.mock('../../../../../src/middleware/roleMiddleware');
vi.mock('../../../../../src/db');

// Import the mocked modules
import { McpCatalogService } from '../../../../../src/services/mcpCatalogService';
import { TeamService } from '../../../../../src/services/teamService';
import { getUserRole } from '../../../../../src/middleware/roleMiddleware';
import { getDb } from '../../../../../src/db';

describe('MCP Servers - List Servers', () => {
  let mockFastify: Partial<FastifyInstance>;
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  let routeHandlers: Record<string, any>;
  let mockCatalogService: any;
  let mockDb: any;
  let mockLogger: any;
  let mockGetUserRole: any;
  let mockTeamService: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup route handlers storage
    routeHandlers = {};

    // Mock logger
    mockLogger = {
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    };

    // Mock database
    mockDb = {};

    // Mock catalog service
    mockCatalogService = {
      getServersForUser: vi.fn()
    };

    // Mock team service
    mockTeamService = {
      getUserTeams: vi.fn()
    };

    // Mock getUserRole
    mockGetUserRole = vi.fn();

    // Mock the McpCatalogService constructor
    vi.mocked(McpCatalogService).mockImplementation(() => mockCatalogService);

    // Mock TeamService static methods
    vi.mocked(TeamService.getUserTeams).mockImplementation(mockTeamService.getUserTeams);

    // Mock getUserRole function
    vi.mocked(getUserRole).mockImplementation(mockGetUserRole);

    // Mock getDb
    vi.mocked(getDb).mockReturnValue(mockDb);

    // Setup mock Fastify instance
    mockFastify = {
      get: vi.fn((path: string, options: any, handler?: any) => {
        if (handler) {
          routeHandlers[`GET ${path}`] = handler;
        } else {
          routeHandlers[`GET ${path}`] = options;
        }
        return mockFastify as FastifyInstance;
      }),
      log: mockLogger
    } as any;

    // Setup mock request
    mockRequest = {
      query: {},
      user: { id: 'test-user-id', role: 'user' },
    } as any;

    // Setup mock reply
    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  describe('Route Registration', () => {
    it('should register list MCP servers route', async () => {
      await listServers(mockFastify as FastifyInstance);

      expect(mockFastify.get).toHaveBeenCalledWith(
        '/mcp/servers',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should configure route with correct schema', async () => {
      await listServers(mockFastify as FastifyInstance);

      const getCall = (mockFastify.get as any).mock.calls.find(
        (call: any[]) => call[0] === '/mcp/servers'
      );
      
      expect(getCall).toBeDefined();
      const [, schema] = getCall;
      
      expect(schema.schema).toBeDefined();
      expect(schema.schema.tags).toEqual(['MCP Servers']);
      expect(schema.schema.summary).toBe('List MCP servers');
      expect(schema.schema.description).toBe('Retrieve MCP servers visible to the current user based on their permissions with pagination support. Authentication is required. Supports filtering by category, language, runtime, status, featured flag, and search query. Results are paginated with configurable limit (1-100, default: 20) and offset (default: 0).');
      expect(schema.schema.querystring).toBeDefined();
      expect(schema.schema.response).toBeDefined();
      expect(schema.schema.response[200]).toBeDefined();
      expect(schema.schema.response[500]).toBeDefined();
    });
  });

  describe('GET /mcp/servers', () => {
    beforeEach(async () => {
      await listServers(mockFastify as FastifyInstance);
    });

    it('should return servers successfully', async () => {
      const mockServers = [
        {
          id: 'server-1',
          name: 'Test Server 1',
          slug: 'test-server-1',
          description: 'A test server',
          long_description: null,
          github_url: null,
          homepage_url: null,
          language: 'typescript',
          runtime: 'node',
          runtime_min_version: null,
          installation_methods: '[]',
          tools: '[]',
          resources: null,
          prompts: null,
          visibility: 'global' as const,
          owner_team_id: null,
          author_name: null,
          author_contact: null,
          organization: null,
          license: null,
          category_id: null,
          tags: null,
          status: 'active' as const,
          featured: false,
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01'),
          last_sync_at: null
        }
      ];

      // Mock the dependencies
      mockGetUserRole.mockResolvedValue({ id: 'global_user', name: 'Global User' });
      mockTeamService.getUserTeams.mockResolvedValue([{ id: 'team-1', name: 'Test Team' }]);
      mockCatalogService.getServersForUser.mockResolvedValue(mockServers);

      const handler = routeHandlers['GET /mcp/servers'];
      await handler(mockRequest, mockReply);

      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: {
          servers: expect.arrayContaining([
            expect.objectContaining({
              id: 'server-1',
              name: 'Test Server 1',
              created_at: '2024-01-01T00:00:00.000Z',
              updated_at: '2024-01-01T00:00:00.000Z',
              last_sync_at: null
            })
          ]),
          pagination: {
            total: 1,
            limit: 20,
            offset: 0,
            has_more: false
          }
        }
      });
    });

    it('should handle service errors gracefully', async () => {
      // Mock the dependencies to succeed initially
      mockGetUserRole.mockResolvedValue({ id: 'global_user', name: 'Global User' });
      mockTeamService.getUserTeams.mockResolvedValue([]);
      // But make the catalog service fail
      mockCatalogService.getServersForUser.mockRejectedValue(new Error('Database connection failed'));

      const handler = routeHandlers['GET /mcp/servers'];
      await handler(mockRequest, mockReply);

      expect(mockLogger.error).toHaveBeenCalledWith(
        {
          operation: 'list_servers',
          userId: 'test-user-id',
          error: expect.any(Error)
        },
        'Failed to list MCP servers'
      );

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to retrieve servers'
      });
    });

    it('should handle empty server list', async () => {
      // Mock the dependencies
      mockGetUserRole.mockResolvedValue({ id: 'global_user', name: 'Global User' });
      mockTeamService.getUserTeams.mockResolvedValue([]);
      mockCatalogService.getServersForUser.mockResolvedValue([]);

      const handler = routeHandlers['GET /mcp/servers'];
      await handler(mockRequest, mockReply);

      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: {
          servers: [],
          pagination: {
            total: 0,
            limit: 20,
            offset: 0,
            has_more: false
          }
        }
      });
    });

    it('should handle unauthenticated users', async () => {
      const unauthenticatedRequest = {
        ...mockRequest,
        user: undefined
      };

      // Get the route configuration to access preValidation
      const getCall = (mockFastify.get as any).mock.calls.find(
        (call: any[]) => call[0] === '/mcp/servers'
      );
      const [, routeConfig, handler] = getCall;

      // Execute preValidation hook first
      if (routeConfig.preValidation) {
        await routeConfig.preValidation(unauthenticatedRequest, mockReply);
      }

      // Should return 401 for unauthenticated users
      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required'
      });

      // Should not call the catalog service
      expect(mockCatalogService.getServersForUser).not.toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    beforeEach(async () => {
      await listServers(mockFastify as FastifyInstance);
    });

    it('should handle multiple concurrent requests', async () => {
      // Mock the dependencies
      mockGetUserRole.mockResolvedValue({ id: 'global_user', name: 'Global User' });
      mockTeamService.getUserTeams.mockResolvedValue([]);
      mockCatalogService.getServersForUser.mockResolvedValue([]);

      const handler = routeHandlers['GET /mcp/servers'];
      const promises = Array.from({ length: 10 }, () => 
        handler(mockRequest, mockReply)
      );

      await Promise.all(promises);

      expect(mockCatalogService.getServersForUser).toHaveBeenCalledTimes(10);
    });
  });

  describe('Route Metadata', () => {
    it('should have appropriate tags for API documentation', async () => {
      await listServers(mockFastify as FastifyInstance);

      const getCall = (mockFastify.get as any).mock.calls[0];
      const [, schema] = getCall;

      expect(schema.schema.tags).toContain('MCP Servers');
    });

    it('should have descriptive summary and description', async () => {
      await listServers(mockFastify as FastifyInstance);

      const getCall = (mockFastify.get as any).mock.calls[0];
      const [, schema] = getCall;

      expect(schema.schema.summary).toContain('List MCP servers');
      expect(schema.schema.description).toContain('visible to the current user');
    });
  });
});
