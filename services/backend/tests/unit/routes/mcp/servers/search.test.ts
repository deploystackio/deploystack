import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import searchServers from '../../../../../src/routes/mcp/servers/search';
import { McpCatalogService } from '../../../../../src/services/mcpCatalogService';
import { TeamService } from '../../../../../src/services/teamService';
import { getUserRole } from '../../../../../src/middleware/roleMiddleware';
import { RoleService } from '../../../../../src/services/roleService';
import { getDb } from '../../../../../src/db';

// Mock dependencies
vi.mock('../../../../../src/services/mcpCatalogService');
vi.mock('../../../../../src/services/teamService');
vi.mock('../../../../../src/services/roleService');
vi.mock('../../../../../src/middleware/roleMiddleware');
vi.mock('../../../../../src/db');

describe('MCP Servers - Search Servers', () => {
  let mockFastify: Partial<FastifyInstance>;
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  let routeHandlers: Record<string, any>;
  let mockMcpService: any;
  let mockDb: any;
  let mockLogger: any;
  let mockRoleService: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup route handlers storage
    routeHandlers = {};

    // Setup mock logger
    mockLogger = {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };

    // Setup mock database
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis()
    };

    // Setup mock MCP service that simulates JSON parsing like the real service
    mockMcpService = {
      getServersForUser: vi.fn().mockImplementation((userId, userRole, teamIds, filters) => {
        // This mock simulates the real service behavior of parsing JSON fields
        const mockServers = mockMcpService._mockServers || [];
        return Promise.resolve(mockServers.map((server: any) => ({
          ...server,
          installation_methods: typeof server.installation_methods === 'string' 
            ? JSON.parse(server.installation_methods) 
            : server.installation_methods,
          tools: typeof server.tools === 'string' 
            ? JSON.parse(server.tools) 
            : server.tools,
          resources: server.resources && typeof server.resources === 'string' 
            ? JSON.parse(server.resources) 
            : server.resources,
          prompts: server.prompts && typeof server.prompts === 'string' 
            ? JSON.parse(server.prompts) 
            : server.prompts,
          default_config: server.default_config && typeof server.default_config === 'string' 
            ? JSON.parse(server.default_config) 
            : server.default_config,
          environment_variables: server.environment_variables && typeof server.environment_variables === 'string' 
            ? JSON.parse(server.environment_variables) 
            : server.environment_variables,
          dependencies: server.dependencies && typeof server.dependencies === 'string' 
            ? JSON.parse(server.dependencies) 
            : server.dependencies,
          tags: server.tags && typeof server.tags === 'string' 
            ? JSON.parse(server.tags) 
            : server.tags
        })));
      }),
      _mockServers: []
    };

    // Setup mock role service
    mockRoleService = {
      userHasPermission: vi.fn().mockResolvedValue(true),
      getUserRole: vi.fn().mockResolvedValue({ 
        id: 'global_user', 
        name: 'Global User',
        description: 'Global user role',
        permissions: ['mcp.servers.read'],
        is_system_role: true,
        created_at: new Date(),
        updated_at: new Date()
      })
    };

    // Setup mocks
    vi.mocked(getDb).mockReturnValue(mockDb);
    vi.mocked(McpCatalogService).mockImplementation(() => mockMcpService);
    vi.mocked(RoleService).mockImplementation(() => mockRoleService);
    vi.mocked(getUserRole).mockResolvedValue({ 
      id: 'global_user', 
      name: 'Global User',
      description: 'Global user role',
      permissions: ['mcp.servers.read'],
      is_system_role: true,
      created_at: new Date(),
      updated_at: new Date()
    });
    vi.mocked(TeamService.getUserTeams).mockResolvedValue([]);

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
    } as any;

    // Setup mock request
    mockRequest = {
      query: { q: 'test search', limit: 20, offset: 0 }, // Simulate Zod defaults
      user: { id: 'test-user-id' },
      log: mockLogger
    } as any;

    // Setup mock reply
    mockReply = {
      status: vi.fn().mockReturnThis(),
      type: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Route Registration', () => {
    it('should register search MCP servers route', async () => {
      await searchServers(mockFastify as FastifyInstance);

      expect(mockFastify.get).toHaveBeenCalledWith(
        '/mcp/servers/search',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should configure route with correct schema', async () => {
      await searchServers(mockFastify as FastifyInstance);

      const getCall = (mockFastify.get as any).mock.calls.find(
        (call: any[]) => call[0] === '/mcp/servers/search'
      );
      
      expect(getCall).toBeDefined();
      const [, schema] = getCall;
      
      expect(schema.schema).toBeDefined();
      expect(schema.schema.tags).toEqual(['MCP Servers']);
      expect(schema.schema.summary).toBe('Search MCP servers');
      expect(schema.schema.description).toContain('Search MCP servers by query string');
      expect(schema.schema.security).toEqual([{ cookieAuth: [] }]);
    });

  });

  describe('GET /mcp/servers/search', () => {
    beforeEach(async () => {
      await searchServers(mockFastify as FastifyInstance);
    });

    it('should search servers successfully with valid query', async () => {
      const mockServers = [
        {
          id: 'server-1',
          name: 'Test Server',
          slug: 'test-server',
          description: 'A test server',
          long_description: null,
          github_url: null,
          git_branch: null,
          homepage_url: null,
          installation_methods: '[]',
          tools: '[]',
          resources: null,
          prompts: null,
          default_config: null,
          environment_variables: null,
          dependencies: null,
          tags: null,
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01'),
          last_sync_at: null,
          visibility: 'global',
          owner_team_id: null,
          created_by: 'user-1',
          language: 'javascript',
          runtime: 'node',
          runtime_min_version: null,
          author_name: null,
          author_contact: null,
          organization: null,
          license: null,
          category_id: null,
          status: 'active',
          featured: false
        }
      ];

      mockMcpService._mockServers = mockServers;

      const handler = routeHandlers['GET /mcp/servers/search'];
      const requestWithQuery = {
        ...mockRequest,
        query: { q: 'test', limit: 10, offset: 0 } // Simulate Zod transformation to numbers
      };

      await handler(requestWithQuery, mockReply);

      expect(mockMcpService.getServersForUser).toHaveBeenCalledWith(
        'test-user-id',
        'global_user',
        [],
        expect.objectContaining({
          search: 'test'
        })
      );

      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.type).toHaveBeenCalledWith('application/json');
      
      // Parse the JSON string response
      const sentData = (mockReply.send as any).mock.calls[0][0];
      const response = JSON.parse(sentData);
      
      expect(response).toEqual({
        success: true,
        data: {
          servers: [
            {
              id: 'server-1',
              name: 'Test Server',
              slug: 'test-server',
              description: 'A test server',
              long_description: null,
              github_url: null,
              git_branch: null,
              homepage_url: null,
              installation_methods: [],
              tools: [],
              resources: null,
              prompts: null,
              default_config: null,
              environment_variables: null,
              dependencies: null,
              tags: null,
              created_at: '2024-01-01T00:00:00.000Z',
              updated_at: '2024-01-01T00:00:00.000Z',
              last_sync_at: null,
              visibility: 'global',
              owner_team_id: null,
              created_by: 'user-1',
              language: 'javascript',
              runtime: 'node',
              runtime_min_version: null,
              author_name: null,
              author_contact: null,
              organization: null,
              license: null,
              category_id: null,
              status: 'active',
              featured: false
            }
          ],
          pagination: {
            total: 1,
            limit: 10,
            offset: 0,
            has_more: false
          },
          filters: {
            query: 'test',
            category: null,
            language: null,
            runtime: null,
            status: null,
            featured: null
          }
        }
      });
    });

    it('should handle search with filters', async () => {
      mockMcpService.getServersForUser.mockResolvedValue([]);

      const handler = routeHandlers['GET /mcp/servers/search'];
      const requestWithFilters = {
        ...mockRequest,
        query: {
          q: 'test',
          category: 'web',
          language: 'javascript',
          runtime: 'node',
          status: 'active',
          featured: 'true', // Keep as string since that's what the implementation expects
          limit: '20', // Keep as string since that's what the implementation expects
          offset: '10' // Keep as string since that's what the implementation expects
        }
      };

      await handler(requestWithFilters, mockReply);

      expect(mockMcpService.getServersForUser).toHaveBeenCalledWith(
        'test-user-id',
        'global_user',
        [],
        {
          search: 'test',
          category_id: 'web',
          language: 'javascript',
          runtime: 'node',
          status: 'active',
          featured: true
        }
      );

      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.type).toHaveBeenCalledWith('application/json');
      
      // Parse the JSON string response
      const sentData = (mockReply.send as any).mock.calls[0][0];
      const response = JSON.parse(sentData);
      
      expect(response).toEqual({
        success: true,
        data: {
          servers: [],
          pagination: {
            total: 0,
            limit: 20,
            offset: 10,
            has_more: false
          },
          filters: {
            query: 'test',
            category: 'web',
            language: 'javascript',
            runtime: 'node',
            status: 'active',
            featured: true
          }
        }
      });
    });

    it('should handle pagination correctly', async () => {
      const mockServers = Array.from({ length: 25 }, (_, i) => ({
        id: `server-${i}`,
        name: `Server ${i}`,
        slug: `server-${i}`,
        description: `Server ${i} description`,
        long_description: null,
        github_url: null,
        git_branch: null,
        homepage_url: null,
        installation_methods: '[]',
        tools: '[]',
        resources: null,
        prompts: null,
        default_config: null,
        environment_variables: null,
        dependencies: null,
        tags: null,
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
        last_sync_at: null,
        visibility: 'global',
        owner_team_id: null,
        created_by: 'user-1',
        language: 'javascript',
        runtime: 'node',
        runtime_min_version: null,
        author_name: null,
        author_contact: null,
        organization: null,
        license: null,
        category_id: null,
        status: 'active',
        featured: false
      }));

      mockMcpService.getServersForUser.mockResolvedValue(mockServers);

      const handler = routeHandlers['GET /mcp/servers/search'];
      const requestWithPagination = {
        ...mockRequest,
        query: { q: 'test', limit: 10, offset: 5 } // Simulate Zod transformation to numbers
      };

      await handler(requestWithPagination, mockReply);

      // Parse the JSON string response
      const sentData = (mockReply.send as any).mock.calls[0][0];
      const response = JSON.parse(sentData);
      expect(response.data.servers).toHaveLength(10); // slice(5, 15) = 10 items
      expect(response.data.pagination).toEqual({
        total: 25,
        limit: 10,
        offset: 5,
        has_more: true
      });
    });

    it('should handle global admin role', async () => {
      vi.mocked(getUserRole).mockResolvedValue({ 
        id: 'global_admin', 
        name: 'Global Admin',
        description: 'Global admin role',
        permissions: [],
        is_system_role: true,
        created_at: new Date(),
        updated_at: new Date()
      });
      mockMcpService.getServersForUser.mockResolvedValue([]);

      const handler = routeHandlers['GET /mcp/servers/search'];
      await handler(mockRequest, mockReply);

      expect(mockMcpService.getServersForUser).toHaveBeenCalledWith(
        'test-user-id',
        'global_admin',
        [],
        expect.any(Object)
      );
    });

    it('should handle user with teams', async () => {
      const mockTeams = [
        { 
          id: 'team-1', 
          name: 'Team 1',
          slug: 'team-1',
          owner_id: 'user-1',
          is_default: false,
          created_at: new Date(),
          updated_at: new Date()
        },
        { 
          id: 'team-2', 
          name: 'Team 2',
          slug: 'team-2',
          owner_id: 'user-1',
          is_default: false,
          created_at: new Date(),
          updated_at: new Date()
        }
      ];
      vi.mocked(TeamService.getUserTeams).mockResolvedValue(mockTeams);
      mockMcpService.getServersForUser.mockResolvedValue([]);

      const handler = routeHandlers['GET /mcp/servers/search'];
      await handler(mockRequest, mockReply);

      expect(mockMcpService.getServersForUser).toHaveBeenCalledWith(
        'test-user-id',
        'global_user',
        ['team-1', 'team-2'],
        expect.any(Object)
      );
    });

    it('should handle team service errors gracefully', async () => {
      vi.mocked(TeamService.getUserTeams).mockRejectedValue(new Error('Team service error'));
      mockMcpService.getServersForUser.mockResolvedValue([]);

      const handler = routeHandlers['GET /mcp/servers/search'];
      await handler(mockRequest, mockReply);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'search_mcp_servers',
          userId: 'test-user-id',
          teamError: expect.any(Error)
        }),
        'Failed to get user teams, continuing with empty team list'
      );

      expect(mockMcpService.getServersForUser).toHaveBeenCalledWith(
        'test-user-id',
        'global_user',
        [],
        expect.any(Object)
      );
    });

    it('should handle service errors', async () => {
      mockMcpService.getServersForUser.mockRejectedValue(new Error('Database error'));

      const handler = routeHandlers['GET /mcp/servers/search'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.type).toHaveBeenCalledWith('application/json');
      
      // Parse the JSON string response
      const sentData = (mockReply.send as any).mock.calls[0][0];
      const response = JSON.parse(sentData);
      
      expect(response).toEqual({
        success: false,
        error: 'Failed to search MCP servers'
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'search_mcp_servers',
          userId: 'test-user-id',
          error: expect.any(Error)
        }),
        'Failed to search MCP servers'
      );
    });

    it('should parse JSON fields correctly', async () => {
      const mockServer = {
        id: 'server-1',
        name: 'Test Server',
        slug: 'test-server',
        description: 'A test server',
        long_description: null,
        github_url: null,
        git_branch: null,
        homepage_url: null,
        installation_methods: '["npm", "yarn"]',
        tools: '[{"name": "test-tool"}]',
        resources: '[{"name": "test-resource"}]',
        prompts: '[{"name": "test-prompt"}]',
        default_config: '{"key": "value"}',
        environment_variables: '[{"name": "TEST_VAR"}]',
        dependencies: '{"dep1": "^1.0.0"}',
        tags: '["tag1", "tag2"]',
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
        last_sync_at: new Date('2024-01-02'),
        visibility: 'global',
        owner_team_id: null,
        created_by: 'user-1',
        language: 'javascript',
        runtime: 'node',
        runtime_min_version: null,
        author_name: null,
        author_contact: null,
        organization: null,
        license: null,
        category_id: null,
        status: 'active',
        featured: false
      };

      mockMcpService._mockServers = [mockServer];

      const handler = routeHandlers['GET /mcp/servers/search'];
      await handler(mockRequest, mockReply);

      // Parse the JSON string response
      const sentData = (mockReply.send as any).mock.calls[0][0];
      const response = JSON.parse(sentData);
      const server = response.data.servers[0];

      expect(server.installation_methods).toEqual(['npm', 'yarn']);
      expect(server.tools).toEqual([{ name: 'test-tool' }]);
      expect(server.resources).toEqual([{ name: 'test-resource' }]);
      expect(server.prompts).toEqual([{ name: 'test-prompt' }]);
      expect(server.default_config).toEqual({ key: 'value' });
      expect(server.environment_variables).toEqual([{ name: 'TEST_VAR' }]);
      expect(server.dependencies).toEqual({ dep1: '^1.0.0' });
      expect(server.tags).toEqual(['tag1', 'tag2']);
      expect(server.created_at).toBe('2024-01-01T00:00:00.000Z');
      expect(server.updated_at).toBe('2024-01-01T00:00:00.000Z');
      expect(server.last_sync_at).toBe('2024-01-02T00:00:00.000Z');
    });

    it('should handle null JSON fields correctly', async () => {
      const mockServer = {
        id: 'server-1',
        name: 'Test Server',
        slug: 'test-server',
        description: 'A test server',
        long_description: null,
        github_url: null,
        git_branch: null,
        homepage_url: null,
        installation_methods: '[]',
        tools: '[]',
        resources: null,
        prompts: null,
        default_config: null,
        environment_variables: null,
        dependencies: null,
        tags: null,
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
        last_sync_at: null,
        visibility: 'global',
        owner_team_id: null,
        created_by: 'user-1',
        language: 'javascript',
        runtime: 'node',
        runtime_min_version: null,
        author_name: null,
        author_contact: null,
        organization: null,
        license: null,
        category_id: null,
        status: 'active',
        featured: false
      };

      mockMcpService._mockServers = [mockServer];

      const handler = routeHandlers['GET /mcp/servers/search'];
      await handler(mockRequest, mockReply);

      // Parse the JSON string response
      const sentData = (mockReply.send as any).mock.calls[0][0];
      const response = JSON.parse(sentData);
      const server = response.data.servers[0];

      expect(server.installation_methods).toEqual([]);
      expect(server.tools).toEqual([]);
      expect(server.resources).toBeNull();
      expect(server.prompts).toBeNull();
      expect(server.default_config).toBeNull();
      expect(server.environment_variables).toBeNull();
      expect(server.dependencies).toBeNull();
      expect(server.tags).toBeNull();
      expect(server.last_sync_at).toBeNull();
    });
  });

  describe('Query Parameter Validation', () => {
    beforeEach(async () => {
      await searchServers(mockFastify as FastifyInstance);
    });

    it('should use default values for limit and offset', async () => {
      mockMcpService.getServersForUser.mockResolvedValue([]);

      const handler = routeHandlers['GET /mcp/servers/search'];
      const requestMinimal = {
        ...mockRequest,
        query: { q: 'test', limit: 20, offset: 0 } // Simulate Zod defaults
      };

      await handler(requestMinimal, mockReply);

      // Parse the JSON string response
      const sentData = (mockReply.send as any).mock.calls[0][0];
      const response = JSON.parse(sentData);
      expect(response.data.pagination.limit).toBe(20);
      expect(response.data.pagination.offset).toBe(0);
    });

    it('should handle featured filter transformation', async () => {
      mockMcpService.getServersForUser.mockResolvedValue([]);

      const handler = routeHandlers['GET /mcp/servers/search'];
      
      // Test featured: 'true' (as string, which gets converted to boolean)
      await handler({
        ...mockRequest,
        query: { q: 'test', featured: 'true', limit: '20', offset: '0' }
      }, mockReply);

      expect(mockMcpService.getServersForUser).toHaveBeenCalledWith(
        'test-user-id',
        'global_user',
        [],
        expect.objectContaining({ featured: true })
      );

      // Test featured: 'false' (as string, which gets converted to boolean)
      await handler({
        ...mockRequest,
        query: { q: 'test', featured: 'false', limit: '20', offset: '0' }
      }, mockReply);

      expect(mockMcpService.getServersForUser).toHaveBeenCalledWith(
        'test-user-id',
        'global_user',
        [],
        expect.objectContaining({ featured: false })
      );
    });
  });

  describe('Logging', () => {
    beforeEach(async () => {
      await searchServers(mockFastify as FastifyInstance);
    });

    it('should log search operation start', async () => {
      mockMcpService.getServersForUser.mockResolvedValue([]);

      const handler = routeHandlers['GET /mcp/servers/search'];
      await handler(mockRequest, mockReply);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'search_mcp_servers',
          userId: 'test-user-id',
          query: 'test search'
        }),
        'Searching MCP servers'
      );
    });

    it('should log search completion', async () => {
      const mockServers = [{ 
        id: 'server-1',
        name: 'Test Server',
        slug: 'test-server',
        description: 'A test server',
        long_description: null,
        github_url: null,
        git_branch: null,
        homepage_url: null,
        installation_methods: '[]',
        tools: '[]',
        resources: null,
        prompts: null,
        default_config: null,
        environment_variables: null,
        dependencies: null,
        tags: null,
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
        last_sync_at: null,
        visibility: 'global',
        owner_team_id: null,
        created_by: 'user-1',
        language: 'javascript',
        runtime: 'node',
        runtime_min_version: null,
        author_name: null,
        author_contact: null,
        organization: null,
        license: null,
        category_id: null,
        status: 'active',
        featured: false
      }];
      mockMcpService.getServersForUser.mockResolvedValue(mockServers);

      const handler = routeHandlers['GET /mcp/servers/search'];
      await handler(mockRequest, mockReply);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'search_mcp_servers',
          userId: 'test-user-id',
          totalResults: 1,
          returnedResults: 1,
          userRole: 'global_user',
          teamCount: 0
        }),
        'MCP server search completed'
      );
    });
  });
});
