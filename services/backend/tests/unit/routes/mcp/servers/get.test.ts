import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import getServer from '../../../../../src/routes/mcp/servers/get';
import { McpCatalogService } from '../../../../../src/services/mcpCatalogService';
import { TeamService } from '../../../../../src/services/teamService';
import { getUserRole, requireAuthentication } from '../../../../../src/middleware/roleMiddleware';
import { getDb } from '../../../../../src/db';

// Mock dependencies
vi.mock('../../../../../src/services/mcpCatalogService');
vi.mock('../../../../../src/services/teamService');
vi.mock('../../../../../src/middleware/roleMiddleware');
vi.mock('../../../../../src/db');

describe('MCP Servers - Get Server', () => {
  let mockFastify: Partial<FastifyInstance>;
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  let routeHandlers: Record<string, any>;
  let mockMcpService: any;
  let mockDb: any;
  let mockLogger: any;
  let mockAuthMiddleware: any;

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

    // Setup mock MCP service
    mockMcpService = {
      getServerById: vi.fn()
    };

    // Setup mocks
    vi.mocked(getDb).mockReturnValue(mockDb);
    vi.mocked(McpCatalogService).mockImplementation(() => mockMcpService);
    vi.mocked(getUserRole).mockResolvedValue({ 
      id: 'global_user', 
      name: 'Global User',
      description: 'Global user role',
      permissions: [],
      is_system_role: true,
      created_at: new Date(),
      updated_at: new Date()
    });
    vi.mocked(TeamService.getUserTeams).mockResolvedValue([]);

    // Setup mock Fastify instance
    mockFastify = {
      get: vi.fn((path: string, options: any, handler?: any) => {
        if (handler) {
          // Store the handler when both options and handler are provided
          routeHandlers[`GET ${path}`] = handler;
        } else {
          // When only options are provided, it should contain the handler
          routeHandlers[`GET ${path}`] = options;
        }
        return mockFastify as FastifyInstance;
      }),
    } as any;

    // Setup mock request
    mockRequest = {
      params: { id: 'test-server-id' },
      user: { id: 'test-user-id' },
      log: mockLogger
    } as any;

    // Setup mock authentication middleware
    mockAuthMiddleware = vi.fn(async (request: any, reply: any) => {
      if (!request.user) {
        const errorResponse = {
          success: false,
          error: 'Authentication required'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(401).type('application/json').send(jsonString);
      }
    });

    // Setup mock reply with proper method chaining
    mockReply = {
      status: vi.fn().mockReturnThis(),
      type: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    // Mock the requireAuthentication function
    vi.mocked(requireAuthentication).mockReturnValue(mockAuthMiddleware);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Route Registration', () => {
    it('should register get MCP server route', async () => {
      await getServer(mockFastify as FastifyInstance);

      expect(mockFastify.get).toHaveBeenCalledWith(
        '/mcp/servers/:id',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should configure route with correct schema', async () => {
      await getServer(mockFastify as FastifyInstance);

      const getCall = (mockFastify.get as any).mock.calls.find(
        (call: any[]) => call[0] === '/mcp/servers/:id'
      );
      
      expect(getCall).toBeDefined();
      const [, schema] = getCall;
      
      expect(schema.schema).toBeDefined();
      expect(schema.schema.tags).toEqual(['MCP Servers']);
      expect(schema.schema.summary).toBe('Get MCP server by ID');
      expect(schema.schema.description).toContain('Retrieve a specific MCP server by its ID');
      expect(schema.schema.security).toEqual([{ cookieAuth: [] }]);
    });

    it('should have preValidation hook for authentication', async () => {
      await getServer(mockFastify as FastifyInstance);

      const getCall = (mockFastify.get as any).mock.calls.find(
        (call: any[]) => call[0] === '/mcp/servers/:id'
      );
      
      expect(getCall).toBeDefined();
      const [, options] = getCall;
      
      expect(options.preValidation).toBeDefined();
      expect(typeof options.preValidation).toBe('function');
    });
  });

  describe('Authentication', () => {
    beforeEach(async () => {
      await getServer(mockFastify as FastifyInstance);
    });

    it('should require authentication', async () => {
      const getCall = (mockFastify.get as any).mock.calls.find(
        (call: any[]) => call[0] === '/mcp/servers/:id'
      );
      const preValidation = getCall[1].preValidation;

      const unauthenticatedRequest = { user: null };
      await preValidation(unauthenticatedRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.type).toHaveBeenCalledWith('application/json');
      expect(mockReply.send).toHaveBeenCalledWith(
        JSON.stringify({
          success: false,
          error: 'Authentication required'
        })
      );
    });

    it('should allow authenticated users', async () => {
      const getCall = (mockFastify.get as any).mock.calls.find(
        (call: any[]) => call[0] === '/mcp/servers/:id'
      );
      const preValidation = getCall[1].preValidation;

      const authenticatedRequest = { user: { id: 'test-user' } };
      const result = await preValidation(authenticatedRequest, mockReply);

      expect(result).toBeUndefined(); // No return means validation passed
      expect(mockReply.status).not.toHaveBeenCalled();
    });
  });

  describe('GET /mcp/servers/:id', () => {
    beforeEach(async () => {
      await getServer(mockFastify as FastifyInstance);
    });

    it('should get server successfully when server exists and user has access', async () => {
      const mockServer = {
        id: 'server-1',
        name: 'Test Server',
        slug: 'test-server',
        description: 'A test server',
        packages: JSON.stringify([]), // Database format - JSON string
        remotes: null,
        resources: null,
        prompts: null,
        dependencies: null,
        tags: null,
        template_args: JSON.stringify([]),
        template_env: JSON.stringify([]),
        template_headers: JSON.stringify([]),
        template_url_query_params: JSON.stringify([]),
        team_args_schema: JSON.stringify([]),
        team_env_schema: JSON.stringify([]),
        team_headers_schema: JSON.stringify([]),
        team_url_query_params_schema: JSON.stringify([]),
        user_args_schema: JSON.stringify([]),
        user_env_schema: null,
        user_headers_schema: null,
        user_url_query_params_schema: null,
        transport_type: 'stdio',
        created_at: new Date('2024-01-01'), // Database format - Date object
        updated_at: new Date('2024-01-01'), // Database format - Date object
        last_sync_at: null,
        visibility: 'global',
        owner_team_id: null,
        created_by: 'user-1',
        language: 'javascript',
        runtime: 'node',
        status: 'active',
        featured: false,
        auto_install_new_default_team: false,
        requires_oauth: false,
        source: 'manual'
      };

      mockMcpService.getServerById.mockResolvedValue(mockServer);

      const handler = routeHandlers['GET /mcp/servers/:id'];
      await handler(mockRequest, mockReply);

      expect(mockMcpService.getServerById).toHaveBeenCalledWith('test-server-id');
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.type).toHaveBeenCalledWith('application/json');
      expect(mockReply.send).toHaveBeenCalledWith(
        JSON.stringify({
          success: true,
          data: {
            id: 'server-1',
            name: 'Test Server',
            slug: 'test-server',
            description: 'A test server',
            long_description: null,
            repository_url: null,
            repository_source: null,
            repository_id: null,
            repository_subfolder: null,
            git_branch: null,
            website_url: null,
            icon_url: null,
            github_account_id: null,
            github_stars: null,
            language: 'javascript',
            runtime: 'node',
            packages: [],
            remotes: null,
            resources: null,
            prompts: null,
            visibility: 'global',
            owner_team_id: null,
            created_by: 'user-1',
            author_name: null,
            author_contact: null,
            organization: null,
            license: null,
            transport_type: 'stdio',
            template_args: [],
            template_env: [],
            template_headers: [],
            template_url_query_params: [],
            team_args_schema: [],
            team_env_schema: [],
            team_headers_schema: [],
            team_url_query_params_schema: [],
            user_args_schema: [],
            user_env_schema: null,
            user_headers_schema: null,
            user_url_query_params_schema: null,
            dependencies: null,
            category_id: null,
            tags: null,
            status: 'active',
            featured: false,
            auto_install_new_default_team: false,
            requires_oauth: false,
            source: 'manual',
            official_name: null,
            synced_from_official_registry: false,
            official_registry_server_id: null,
            official_registry_version_id: null,
            official_registry_published_at: null,
            official_registry_updated_at: null,
            created_at: '2024-01-01T00:00:00.000Z',
            updated_at: '2024-01-01T00:00:00.000Z',
            last_sync_at: null
          }
        })
      );
    });

    it('should return 404 when server does not exist', async () => {
      mockMcpService.getServerById.mockResolvedValue(null);

      const handler = routeHandlers['GET /mcp/servers/:id'];
      await handler(mockRequest, mockReply);

      expect(mockMcpService.getServerById).toHaveBeenCalledWith('test-server-id');
      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.type).toHaveBeenCalledWith('application/json');
      expect(mockReply.send).toHaveBeenCalledWith(
        JSON.stringify({
          success: false,
          error: 'Server not found'
        })
      );
    });

    it('should allow global admin to access any server', async () => {
      vi.mocked(getUserRole).mockResolvedValue({ 
        id: 'global_admin', 
        name: 'Global Admin',
        description: 'Global admin role',
        permissions: [],
        is_system_role: true,
        created_at: new Date(),
        updated_at: new Date()
      });

      const mockServer = {
        id: 'server-1',
        name: 'Team Server',
        slug: 'team-server',
        description: 'A team server',
        packages: JSON.stringify([]), // Database format - JSON string
        remotes: null,
        resources: null,
        prompts: null,
        dependencies: null,
        tags: null,
        template_args: JSON.stringify([]),
        template_env: JSON.stringify([]),
        template_headers: JSON.stringify([]),
        template_url_query_params: JSON.stringify([]),
        team_args_schema: JSON.stringify([]),
        team_env_schema: JSON.stringify([]),
        team_headers_schema: JSON.stringify([]),
        team_url_query_params_schema: JSON.stringify([]),
        user_args_schema: JSON.stringify([]),
        user_env_schema: null,
        user_headers_schema: null,
        user_url_query_params_schema: null,
        transport_type: 'stdio',
        created_at: new Date('2024-01-01'), // Database format - Date object
        updated_at: new Date('2024-01-01'), // Database format - Date object
        last_sync_at: null,
        visibility: 'team',
        owner_team_id: 'team-1',
        created_by: 'user-1',
        language: 'javascript',
        runtime: 'node',
        status: 'active',
        featured: false,
        auto_install_new_default_team: false,
        requires_oauth: false,
        source: 'manual'
      };

      mockMcpService.getServerById.mockResolvedValue(mockServer);

      const handler = routeHandlers['GET /mcp/servers/:id'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.type).toHaveBeenCalledWith('application/json');
      expect(mockReply.send).toHaveBeenCalledWith(
        JSON.stringify({
          success: true,
          data: {
            id: 'server-1',
            name: 'Team Server',
            slug: 'team-server',
            description: 'A team server',
            long_description: null,
            repository_url: null,
            repository_source: null,
            repository_id: null,
            repository_subfolder: null,
            git_branch: null,
            website_url: null,
            icon_url: null,
            github_account_id: null,
            github_stars: null,
            language: 'javascript',
            runtime: 'node',
            packages: [],
            remotes: null,
            resources: null,
            prompts: null,
            visibility: 'team',
            owner_team_id: 'team-1',
            created_by: 'user-1',
            author_name: null,
            author_contact: null,
            organization: null,
            license: null,
            transport_type: 'stdio',
            template_args: [],
            template_env: [],
            template_headers: [],
            template_url_query_params: [],
            team_args_schema: [],
            team_env_schema: [],
            team_headers_schema: [],
            team_url_query_params_schema: [],
            user_args_schema: [],
            user_env_schema: null,
            user_headers_schema: null,
            user_url_query_params_schema: null,
            dependencies: null,
            category_id: null,
            tags: null,
            status: 'active',
            featured: false,
            auto_install_new_default_team: false,
            requires_oauth: false,
            source: 'manual',
            official_name: null,
            synced_from_official_registry: false,
            official_registry_server_id: null,
            official_registry_version_id: null,
            official_registry_published_at: null,
            official_registry_updated_at: null,
            created_at: '2024-01-01T00:00:00.000Z',
            updated_at: '2024-01-01T00:00:00.000Z',
            last_sync_at: null
          }
        })
      );
    });

    it('should allow access to global servers for any authenticated user', async () => {
      const mockServer = {
        id: 'server-1',
        name: 'Global Server',
        slug: 'global-server',
        description: 'A global server',
        packages: JSON.stringify([]), // Database format - JSON string
        remotes: null,
        resources: null,
        prompts: null,
        dependencies: null,
        tags: null,
        template_args: JSON.stringify([]),
        template_env: JSON.stringify([]),
        template_headers: JSON.stringify([]),
        template_url_query_params: JSON.stringify([]),
        team_args_schema: JSON.stringify([]),
        team_env_schema: JSON.stringify([]),
        team_headers_schema: JSON.stringify([]),
        team_url_query_params_schema: JSON.stringify([]),
        user_args_schema: JSON.stringify([]),
        user_env_schema: null,
        user_headers_schema: null,
        user_url_query_params_schema: null,
        transport_type: 'stdio',
        created_at: new Date('2024-01-01'), // Database format - Date object
        updated_at: new Date('2024-01-01'), // Database format - Date object
        last_sync_at: null,
        visibility: 'global',
        owner_team_id: null,
        created_by: 'user-1',
        language: 'javascript',
        runtime: 'node',
        status: 'active',
        featured: false,
        auto_install_new_default_team: false,
        requires_oauth: false,
        source: 'manual'
      };

      mockMcpService.getServerById.mockResolvedValue(mockServer);

      const handler = routeHandlers['GET /mcp/servers/:id'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.type).toHaveBeenCalledWith('application/json');
      expect(mockReply.send).toHaveBeenCalledWith(
        JSON.stringify({
          success: true,
          data: {
            id: 'server-1',
            name: 'Global Server',
            slug: 'global-server',
            description: 'A global server',
            long_description: null,
            repository_url: null,
            repository_source: null,
            repository_id: null,
            repository_subfolder: null,
            git_branch: null,
            website_url: null,
            icon_url: null,
            github_account_id: null,
            github_stars: null,
            language: 'javascript',
            runtime: 'node',
            packages: [],
            remotes: null,
            resources: null,
            prompts: null,
            visibility: 'global',
            owner_team_id: null,
            created_by: 'user-1',
            author_name: null,
            author_contact: null,
            organization: null,
            license: null,
            transport_type: 'stdio',
            template_args: [],
            template_env: [],
            template_headers: [],
            template_url_query_params: [],
            team_args_schema: [],
            team_env_schema: [],
            team_headers_schema: [],
            team_url_query_params_schema: [],
            user_args_schema: [],
            user_env_schema: null,
            user_headers_schema: null,
            user_url_query_params_schema: null,
            dependencies: null,
            category_id: null,
            tags: null,
            status: 'active',
            featured: false,
            auto_install_new_default_team: false,
            requires_oauth: false,
            source: 'manual',
            official_name: null,
            synced_from_official_registry: false,
            official_registry_server_id: null,
            official_registry_version_id: null,
            official_registry_published_at: null,
            official_registry_updated_at: null,
            created_at: '2024-01-01T00:00:00.000Z',
            updated_at: '2024-01-01T00:00:00.000Z',
            last_sync_at: null
          }
        })
      );
    });

    it('should allow team members to access their team servers', async () => {
      const mockTeams = [
        { 
          id: 'team-1', 
          name: 'Team 1',
          slug: 'team-1',
          owner_id: 'user-1',
          is_default: false,
          created_at: new Date(),
          updated_at: new Date()
        }
      ];
      vi.mocked(TeamService.getUserTeams).mockResolvedValue(mockTeams);

      const mockServer = {
        id: 'server-1',
        name: 'Team Server',
        slug: 'team-server',
        description: 'A team server',
        packages: JSON.stringify([]), // Database format - JSON string
        remotes: null,
        resources: null,
        prompts: null,
        dependencies: null,
        tags: null,
        template_args: JSON.stringify([]),
        template_env: JSON.stringify([]),
        template_headers: JSON.stringify([]),
        template_url_query_params: JSON.stringify([]),
        team_args_schema: JSON.stringify([]),
        team_env_schema: JSON.stringify([]),
        team_headers_schema: JSON.stringify([]),
        team_url_query_params_schema: JSON.stringify([]),
        user_args_schema: JSON.stringify([]),
        user_env_schema: null,
        user_headers_schema: null,
        user_url_query_params_schema: null,
        transport_type: 'stdio',
        created_at: new Date('2024-01-01'), // Database format - Date object
        updated_at: new Date('2024-01-01'), // Database format - Date object
        last_sync_at: null,
        visibility: 'team',
        owner_team_id: 'team-1',
        created_by: 'user-1',
        language: 'javascript',
        runtime: 'node',
        status: 'active',
        featured: false,
        auto_install_new_default_team: false,
        requires_oauth: false,
        source: 'manual'
      };

      mockMcpService.getServerById.mockResolvedValue(mockServer);

      const handler = routeHandlers['GET /mcp/servers/:id'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.type).toHaveBeenCalledWith('application/json');
      expect(mockReply.send).toHaveBeenCalledWith(
        JSON.stringify({
          success: true,
          data: {
            id: 'server-1',
            name: 'Team Server',
            slug: 'team-server',
            description: 'A team server',
            long_description: null,
            repository_url: null,
            repository_source: null,
            repository_id: null,
            repository_subfolder: null,
            git_branch: null,
            website_url: null,
            icon_url: null,
            github_account_id: null,
            github_stars: null,
            language: 'javascript',
            runtime: 'node',
            packages: [],
            remotes: null,
            resources: null,
            prompts: null,
            visibility: 'team',
            owner_team_id: 'team-1',
            created_by: 'user-1',
            author_name: null,
            author_contact: null,
            organization: null,
            license: null,
            transport_type: 'stdio',
            template_args: [],
            template_env: [],
            template_headers: [],
            template_url_query_params: [],
            team_args_schema: [],
            team_env_schema: [],
            team_headers_schema: [],
            team_url_query_params_schema: [],
            user_args_schema: [],
            user_env_schema: null,
            user_headers_schema: null,
            user_url_query_params_schema: null,
            dependencies: null,
            category_id: null,
            tags: null,
            status: 'active',
            featured: false,
            auto_install_new_default_team: false,
            requires_oauth: false,
            source: 'manual',
            official_name: null,
            synced_from_official_registry: false,
            official_registry_server_id: null,
            official_registry_version_id: null,
            official_registry_published_at: null,
            official_registry_updated_at: null,
            created_at: '2024-01-01T00:00:00.000Z',
            updated_at: '2024-01-01T00:00:00.000Z',
            last_sync_at: null
          }
        })
      );
    });

    it('should deny access to team servers for non-members', async () => {
      const mockTeams = [
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

      const mockServer = {
        id: 'server-1',
        name: 'Team Server',
        slug: 'team-server',
        description: 'A team server',
        packages: JSON.stringify([]), // Database format - JSON string
        remotes: null,
        resources: null,
        prompts: null,
        dependencies: null,
        tags: null,
        template_args: JSON.stringify([]),
        template_env: JSON.stringify([]),
        template_headers: JSON.stringify([]),
        template_url_query_params: JSON.stringify([]),
        team_args_schema: JSON.stringify([]),
        team_env_schema: JSON.stringify([]),
        team_headers_schema: JSON.stringify([]),
        team_url_query_params_schema: JSON.stringify([]),
        user_args_schema: JSON.stringify([]),
        user_env_schema: null,
        user_headers_schema: null,
        user_url_query_params_schema: null,
        transport_type: 'stdio',
        created_at: new Date('2024-01-01'), // Database format - Date object
        updated_at: new Date('2024-01-01'), // Database format - Date object
        last_sync_at: null,
        visibility: 'team',
        owner_team_id: 'team-1', // User is not a member of team-1
        created_by: 'user-1',
        language: 'javascript',
        runtime: 'node',
        status: 'active',
        featured: false,
        auto_install_new_default_team: false,
        requires_oauth: false,
        source: 'manual'
      };

      mockMcpService.getServerById.mockResolvedValue(mockServer);

      const handler = routeHandlers['GET /mcp/servers/:id'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.type).toHaveBeenCalledWith('application/json');
      expect(mockReply.send).toHaveBeenCalledWith(
        JSON.stringify({
          success: false,
          error: 'Server not found'
        })
      );
    });

    it('should handle team service errors gracefully', async () => {
      vi.mocked(TeamService.getUserTeams).mockRejectedValue(new Error('Team service error'));

      const mockServer = {
        id: 'server-1',
        name: 'Global Server',
        slug: 'global-server',
        description: 'A global server',
        packages: JSON.stringify([]), // Database format - JSON string
        remotes: null,
        resources: null,
        prompts: null,
        dependencies: null,
        tags: null,
        template_args: JSON.stringify([]),
        template_env: JSON.stringify([]),
        template_headers: JSON.stringify([]),
        template_url_query_params: JSON.stringify([]),
        team_args_schema: JSON.stringify([]),
        team_env_schema: JSON.stringify([]),
        team_headers_schema: JSON.stringify([]),
        team_url_query_params_schema: JSON.stringify([]),
        user_args_schema: JSON.stringify([]),
        user_env_schema: null,
        user_headers_schema: null,
        user_url_query_params_schema: null,
        transport_type: 'stdio',
        created_at: new Date('2024-01-01'), // Database format - Date object
        updated_at: new Date('2024-01-01'), // Database format - Date object
        last_sync_at: null,
        visibility: 'global',
        owner_team_id: null,
        created_by: 'user-1',
        language: 'javascript',
        runtime: 'node',
        status: 'active',
        featured: false
      };

      mockMcpService.getServerById.mockResolvedValue(mockServer);

      const handler = routeHandlers['GET /mcp/servers/:id'];
      await handler(mockRequest, mockReply);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'get_mcp_server',
          userId: 'test-user-id',
          serverId: 'test-server-id',
          teamError: expect.any(Error)
        }),
        'Failed to get user teams, continuing with empty team list'
      );

      // Should still work for global servers
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.type).toHaveBeenCalledWith('application/json');
    });

    it('should handle service errors', async () => {
      mockMcpService.getServerById.mockRejectedValue(new Error('Database error'));

      const handler = routeHandlers['GET /mcp/servers/:id'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.type).toHaveBeenCalledWith('application/json');
      expect(mockReply.send).toHaveBeenCalledWith(
        JSON.stringify({
          success: false,
          error: 'Failed to get MCP server'
        })
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'get_mcp_server',
          userId: 'test-user-id',
          serverId: 'test-server-id',
          error: expect.any(Error)
        }),
        'Failed to get MCP server'
      );
    });

    it('should parse JSON fields correctly', async () => {
      const mockServer = {
        id: 'server-1',
        name: 'Test Server',
        slug: 'test-server',
        description: 'A test server',
        packages: JSON.stringify(['npm', 'yarn']), // Database format - JSON string
        remotes: null,
        resources: JSON.stringify([{ name: 'test-resource' }]), // Database format - JSON string
        prompts: JSON.stringify([{ name: 'test-prompt' }]), // Database format - JSON string
        dependencies: JSON.stringify({ dep1: '^1.0.0' }), // Database format - JSON string
        tags: JSON.stringify(['tag1', 'tag2']), // Database format - JSON string
        template_args: JSON.stringify([]),
        template_env: JSON.stringify([]),
        template_headers: JSON.stringify([]),
        template_url_query_params: JSON.stringify([]),
        team_args_schema: JSON.stringify([]),
        team_env_schema: JSON.stringify([]),
        team_headers_schema: JSON.stringify([]),
        team_url_query_params_schema: JSON.stringify([]),
        user_args_schema: JSON.stringify([]),
        user_env_schema: null,
        user_headers_schema: null,
        user_url_query_params_schema: null,
        transport_type: 'stdio',
        created_at: new Date('2024-01-01'), // Database format - Date object
        updated_at: new Date('2024-01-01'), // Database format - Date object
        last_sync_at: new Date('2024-01-02'), // Database format - Date object
        visibility: 'global',
        owner_team_id: null,
        created_by: 'user-1',
        language: 'javascript',
        runtime: 'node',
        status: 'active',
        featured: false
      };

      mockMcpService.getServerById.mockResolvedValue(mockServer);

      const handler = routeHandlers['GET /mcp/servers/:id'];
      await handler(mockRequest, mockReply);

      const jsonResponse = (mockReply.send as any).mock.calls[0][0];
      const response = JSON.parse(jsonResponse);
      const server = response.data;

      expect(server.packages).toEqual(['npm', 'yarn']);
      expect(server.resources).toEqual([{ name: 'test-resource' }]);
      expect(server.prompts).toEqual([{ name: 'test-prompt' }]);
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
        packages: JSON.stringify([]), // Database format - JSON string
        remotes: null,
        resources: null,
        prompts: null,
        dependencies: null,
        tags: null,
        template_args: JSON.stringify([]),
        template_env: JSON.stringify([]),
        template_headers: JSON.stringify([]),
        template_url_query_params: JSON.stringify([]),
        team_args_schema: JSON.stringify([]),
        team_env_schema: JSON.stringify([]),
        team_headers_schema: JSON.stringify([]),
        team_url_query_params_schema: JSON.stringify([]),
        user_args_schema: JSON.stringify([]),
        user_env_schema: null,
        user_headers_schema: null,
        user_url_query_params_schema: null,
        transport_type: 'stdio',
        created_at: new Date('2024-01-01'), // Database format - Date object
        updated_at: new Date('2024-01-01'), // Database format - Date object
        last_sync_at: null,
        visibility: 'global',
        owner_team_id: null,
        created_by: 'user-1',
        language: 'javascript',
        runtime: 'node',
        status: 'active',
        featured: false
      };

      mockMcpService.getServerById.mockResolvedValue(mockServer);

      const handler = routeHandlers['GET /mcp/servers/:id'];
      await handler(mockRequest, mockReply);

      const jsonResponse = (mockReply.send as any).mock.calls[0][0];
      const response = JSON.parse(jsonResponse);
      const server = response.data;

      expect(server.packages).toEqual([]);
      expect(server.resources).toBeNull();
      expect(server.prompts).toBeNull();
      expect(server.dependencies).toBeNull();
      expect(server.tags).toBeNull();
      expect(server.last_sync_at).toBeNull();
    });

    it('should handle different server ID formats', async () => {
      const testIds = [
        'uuid-123-456-789',
        'simple-id',
        '12345',
        'server_with_underscores',
        'server-with-dashes'
      ];

      for (const testId of testIds) {
        mockMcpService.getServerById.mockResolvedValue(null);

        const handler = routeHandlers['GET /mcp/servers/:id'];
        const requestWithId = {
          ...mockRequest,
          params: { id: testId }
        };

        await handler(requestWithId, mockReply);

        expect(mockMcpService.getServerById).toHaveBeenCalledWith(testId);
      }
    });
  });

  describe('Access Control Logic', () => {
    beforeEach(async () => {
      await getServer(mockFastify as FastifyInstance);
    });

    it('should correctly determine access for different user roles and server types', async () => {
      const testCases = [
        {
          description: 'global admin accessing global server',
          userRole: 'global_admin',
          serverVisibility: 'global',
          serverOwnerTeamId: null,
          userTeams: [],
          expectedAccess: true
        },
        {
          description: 'global admin accessing team server',
          userRole: 'global_admin',
          serverVisibility: 'team',
          serverOwnerTeamId: 'team-1',
          userTeams: [],
          expectedAccess: true
        },
        {
          description: 'regular user accessing global server',
          userRole: 'global_user',
          serverVisibility: 'global',
          serverOwnerTeamId: null,
          userTeams: [],
          expectedAccess: true
        },
        {
          description: 'team member accessing their team server',
          userRole: 'global_user',
          serverVisibility: 'team',
          serverOwnerTeamId: 'team-1',
          userTeams: ['team-1'],
          expectedAccess: true
        },
        {
          description: 'non-team member accessing team server',
          userRole: 'global_user',
          serverVisibility: 'team',
          serverOwnerTeamId: 'team-1',
          userTeams: ['team-2'],
          expectedAccess: false
        }
      ];

      for (const testCase of testCases) {
        // Setup mocks for this test case
        vi.mocked(getUserRole).mockResolvedValue({ 
          id: testCase.userRole, 
          name: testCase.userRole,
          description: `${testCase.userRole} role`,
          permissions: [],
          is_system_role: true,
          created_at: new Date(),
          updated_at: new Date()
        });

        const mockTeams = testCase.userTeams.map(teamId => ({
          id: teamId,
          name: `Team ${teamId}`,
          slug: teamId,
          owner_id: 'user-1',
          is_default: false,
          created_at: new Date(),
          updated_at: new Date()
        }));
        vi.mocked(TeamService.getUserTeams).mockResolvedValue(mockTeams);

        const mockServer = {
          id: 'server-1',
          name: 'Test Server',
          slug: 'test-server',
          description: 'A test server',
          packages: JSON.stringify([]), // Database format - JSON string
          remotes: null,
          resources: null,
          prompts: null,
          dependencies: null,
          tags: null,
          template_args: JSON.stringify([]),
          template_env: JSON.stringify([]),
          template_headers: JSON.stringify([]),
          team_args_schema: JSON.stringify([]),
          team_env_schema: JSON.stringify([]),
          team_headers_schema: JSON.stringify([]),
          user_args_schema: JSON.stringify([]),
          user_env_schema: null,
          user_headers_schema: null,
          transport_type: 'stdio',
          created_at: new Date('2024-01-01'), // Database format - Date object
          updated_at: new Date('2024-01-01'), // Database format - Date object
          last_sync_at: null,
          visibility: testCase.serverVisibility as 'global' | 'team',
          owner_team_id: testCase.serverOwnerTeamId,
          created_by: 'user-1',
          language: 'javascript',
          runtime: 'node',
          status: 'active' as const,
          featured: false,
          auto_install_new_default_team: false
        };

        mockMcpService.getServerById.mockResolvedValue(mockServer);

        const handler = routeHandlers['GET /mcp/servers/:id'];
        await handler(mockRequest, mockReply);

        if (testCase.expectedAccess) {
          expect(mockReply.status).toHaveBeenCalledWith(200);
          expect(mockReply.type).toHaveBeenCalledWith('application/json');
        } else {
          expect(mockReply.status).toHaveBeenCalledWith(404);
          expect(mockReply.type).toHaveBeenCalledWith('application/json');
          expect(mockReply.send).toHaveBeenCalledWith(
            JSON.stringify({
              success: false,
              error: 'Server not found'
            })
          );
        }

        // Reset mocks for next iteration
        vi.clearAllMocks();
        mockMcpService.getServerById.mockClear();
      }
    });
  });

  describe('Logging', () => {
    beforeEach(async () => {
      await getServer(mockFastify as FastifyInstance);
    });

    it('should log get operation start', async () => {
      mockMcpService.getServerById.mockResolvedValue(null);

      const handler = routeHandlers['GET /mcp/servers/:id'];
      await handler(mockRequest, mockReply);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'get_mcp_server',
          userId: 'test-user-id',
          serverId: 'test-server-id'
        }),
        'Getting MCP server by ID'
      );
    });

    it('should log when server not found', async () => {
      mockMcpService.getServerById.mockResolvedValue(null);

      const handler = routeHandlers['GET /mcp/servers/:id'];
      await handler(mockRequest, mockReply);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'get_mcp_server',
          userId: 'test-user-id',
          serverId: 'test-server-id',
          userRole: 'global_user'
        }),
        'MCP server not found'
      );
    });

    it('should log access denied', async () => {
      const mockServer = {
        id: 'server-1',
        name: 'Team Server',
        slug: 'team-server',
        description: 'A team server',
        packages: JSON.stringify([]), // Database format - JSON string
        remotes: null,
        resources: null,
        prompts: null,
        dependencies: null,
        tags: null,
        template_args: JSON.stringify([]),
        template_env: JSON.stringify([]),
        template_headers: JSON.stringify([]),
        template_url_query_params: JSON.stringify([]),
        team_args_schema: JSON.stringify([]),
        team_env_schema: JSON.stringify([]),
        team_headers_schema: JSON.stringify([]),
        team_url_query_params_schema: JSON.stringify([]),
        user_args_schema: JSON.stringify([]),
        user_env_schema: null,
        user_headers_schema: null,
        user_url_query_params_schema: null,
        transport_type: 'stdio',
        created_at: new Date('2024-01-01'), // Database format - Date object
        updated_at: new Date('2024-01-01'), // Database format - Date object
        last_sync_at: null,
        visibility: 'team',
        owner_team_id: 'team-1',
        created_by: 'user-1',
        language: 'javascript',
        runtime: 'node',
        status: 'active',
        featured: false
      };

      mockMcpService.getServerById.mockResolvedValue(mockServer);

      const handler = routeHandlers['GET /mcp/servers/:id'];
      await handler(mockRequest, mockReply);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'get_mcp_server',
          userId: 'test-user-id',
          serverId: 'test-server-id',
          userRole: 'global_user',
          serverVisibility: 'team',
          serverOwnerTeamId: 'team-1',
          userTeamIds: []
        }),
        'Access denied to MCP server'
      );
    });

    it('should log successful access', async () => {
      const mockServer = {
        id: 'server-1',
        name: 'Global Server',
        slug: 'global-server',
        description: 'A global server',
        packages: JSON.stringify([]), // Database format - JSON string
        remotes: null,
        resources: null,
        prompts: null,
        dependencies: null,
        tags: null,
        template_args: JSON.stringify([]),
        template_env: JSON.stringify([]),
        template_headers: JSON.stringify([]),
        template_url_query_params: JSON.stringify([]),
        team_args_schema: JSON.stringify([]),
        team_env_schema: JSON.stringify([]),
        team_headers_schema: JSON.stringify([]),
        team_url_query_params_schema: JSON.stringify([]),
        user_args_schema: JSON.stringify([]),
        user_env_schema: null,
        user_headers_schema: null,
        user_url_query_params_schema: null,
        transport_type: 'stdio',
        created_at: new Date('2024-01-01'), // Database format - Date object
        updated_at: new Date('2024-01-01'), // Database format - Date object
        last_sync_at: null,
        visibility: 'global',
        owner_team_id: null,
        created_by: 'user-1',
        language: 'javascript',
        runtime: 'node',
        status: 'active',
        featured: false
      };

      mockMcpService.getServerById.mockResolvedValue(mockServer);

      const handler = routeHandlers['GET /mcp/servers/:id'];
      await handler(mockRequest, mockReply);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'get_mcp_server',
          userId: 'test-user-id',
          serverId: 'test-server-id',
          userRole: 'global_user',
          serverVisibility: 'global',
          teamCount: 0
        }),
        'MCP server access granted'
      );
    });
  });
});
