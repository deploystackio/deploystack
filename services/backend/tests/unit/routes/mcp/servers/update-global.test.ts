import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import updateGlobalServer from '../../../../../src/routes/mcp/servers/update-global';
import { McpCatalogService } from '../../../../../src/services/mcpCatalogService';
import { requireGlobalAdmin } from '../../../../../src/middleware/roleMiddleware';
import { getDb } from '../../../../../src/db';

// Mock dependencies
vi.mock('../../../../../src/services/mcpCatalogService');
vi.mock('../../../../../src/middleware/roleMiddleware');
vi.mock('../../../../../src/db');

describe('MCP Servers - Update Global', () => {
  let mockFastify: Partial<FastifyInstance>;
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  let routeHandlers: Record<string, any>;
  let mockMcpService: any;
  let mockDb: any;
  let mockLogger: any;
  let mockPreValidation: any;

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
      getServerById: vi.fn(),
      updateServer: vi.fn()
    };

    // Setup mock preValidation
    mockPreValidation = vi.fn();

    // Setup mocks
    vi.mocked(getDb).mockReturnValue(mockDb);
    vi.mocked(McpCatalogService).mockImplementation(() => mockMcpService);
    vi.mocked(requireGlobalAdmin).mockReturnValue(mockPreValidation);

    // Setup mock Fastify instance
    mockFastify = {
      put: vi.fn((path: string, options: any, handler?: any) => {
        if (handler) {
          routeHandlers[`PUT ${path}`] = handler;
        } else {
          routeHandlers[`PUT ${path}`] = options;
        }
        return mockFastify as FastifyInstance;
      }),
    } as any;

    // Setup mock request
    mockRequest = {
      params: { id: 'test-server-id' },
      body: {
        name: 'Updated Server Name',
        description: 'Updated description'
      },
      user: { id: 'test-user-id' },
      log: mockLogger
    } as any;

    // Setup mock reply
    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Route Registration', () => {
    it('should register update global MCP server route', async () => {
      await updateGlobalServer(mockFastify as FastifyInstance);

      expect(mockFastify.put).toHaveBeenCalledWith(
        '/mcp/servers/global/:id',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should configure route with correct schema', async () => {
      await updateGlobalServer(mockFastify as FastifyInstance);

      const putCall = (mockFastify.put as any).mock.calls.find(
        (call: any[]) => call[0] === '/mcp/servers/global/:id'
      );
      
      expect(putCall).toBeDefined();
      const [, schema] = putCall;
      
      expect(schema.schema).toBeDefined();
      expect(schema.schema.tags).toEqual(['MCP Servers']);
      expect(schema.schema.summary).toBe('Update global MCP server (Global Admin only)');
      expect(schema.schema.description).toContain('Update an existing global MCP server');
      expect(schema.schema.security).toEqual([{ cookieAuth: [] }]);
    });

    it('should have preValidation hook for global admin authentication', async () => {
      await updateGlobalServer(mockFastify as FastifyInstance);

      const putCall = (mockFastify.put as any).mock.calls.find(
        (call: any[]) => call[0] === '/mcp/servers/global/:id'
      );
      
      expect(putCall).toBeDefined();
      const [, schema] = putCall;
      
      expect(schema.preValidation).toBeDefined();
      expect(requireGlobalAdmin).toHaveBeenCalled();
    });

    it('should have proper request and response schemas', async () => {
      await updateGlobalServer(mockFastify as FastifyInstance);

      const putCall = (mockFastify.put as any).mock.calls.find(
        (call: any[]) => call[0] === '/mcp/servers/global/:id'
      );
      
      const [, schema] = putCall;
      
      expect(schema.schema.params).toBeDefined();
      expect(schema.schema.requestBody).toBeDefined();
      expect(schema.schema.requestBody.required).toBe(true);
      expect(schema.schema.requestBody.content['application/json']).toBeDefined();
      expect(schema.schema.response).toBeDefined();
      expect(schema.schema.response[200]).toBeDefined();
      expect(schema.schema.response[400]).toBeDefined();
      expect(schema.schema.response[401]).toBeDefined();
      expect(schema.schema.response[403]).toBeDefined();
      expect(schema.schema.response[404]).toBeDefined();
      expect(schema.schema.response[409]).toBeDefined();
      expect(schema.schema.response[500]).toBeDefined();
    });
  });

  describe('Authentication and Authorization', () => {
    beforeEach(async () => {
      await updateGlobalServer(mockFastify as FastifyInstance);
    });

    it('should require global admin authentication', async () => {
      expect(requireGlobalAdmin).toHaveBeenCalled();
      
      const putCall = (mockFastify.put as any).mock.calls.find(
        (call: any[]) => call[0] === '/mcp/servers/global/:id'
      );
      
      expect(putCall[1].preValidation).toBe(mockPreValidation);
    });
  });

  describe('PUT /mcp/servers/global/:id', () => {
    beforeEach(async () => {
      await updateGlobalServer(mockFastify as FastifyInstance);
    });

    it('should update global server successfully', async () => {
      const existingServer = {
        id: 'test-server-id',
        name: 'Old Server Name',
        visibility: 'global',
        owner_team_id: null
      };

      const updatedServer = {
        id: 'test-server-id',
        name: 'Updated Server Name',
        slug: 'updated-server-name',
        description: 'Updated description',
        long_description: null,
        github_url: null,
        git_branch: null,
        homepage_url: null,
        language: 'javascript',
        runtime: 'node',
        runtime_min_version: null,
        installation_methods: '[]',
        tools: '[]',
        resources: null,
        prompts: null,
        visibility: 'global',
        owner_team_id: null,
        created_by: 'user-1',
        author_name: null,
        author_contact: null,
        organization: null,
        license: null,
        default_config: null,
        environment_variables: null,
        dependencies: null,
        category_id: null,
        tags: null,
        status: 'active',
        featured: false,
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-02'),
        last_sync_at: null
      };

      mockMcpService.getServerById.mockResolvedValue(existingServer);
      mockMcpService.updateServer.mockResolvedValue(updatedServer);

      const handler = routeHandlers['PUT /mcp/servers/global/:id'];
      await handler(mockRequest, mockReply);

      expect(mockMcpService.getServerById).toHaveBeenCalledWith('test-server-id');
      expect(mockMcpService.updateServer).toHaveBeenCalledWith(
        'test-server-id',
        'test-user-id',
        'global_admin',
        {
          name: 'Updated Server Name',
          description: 'Updated description'
        }
      );

      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          id: 'test-server-id',
          name: 'Updated Server Name',
          description: 'Updated description',
          installation_methods: [],
          tools: [],
          resources: null,
          prompts: null,
          default_config: null,
          environment_variables: null,
          dependencies: null,
          tags: null,
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-02T00:00:00.000Z',
          last_sync_at: null
        })
      });
    });

    it('should return 404 when server does not exist', async () => {
      mockMcpService.getServerById.mockResolvedValue(null);

      const handler = routeHandlers['PUT /mcp/servers/global/:id'];
      await handler(mockRequest, mockReply);

      expect(mockMcpService.getServerById).toHaveBeenCalledWith('test-server-id');
      expect(mockMcpService.updateServer).not.toHaveBeenCalled();

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Server not found'
      });
    });

    it('should return 404 when server is not global', async () => {
      const teamServer = {
        id: 'test-server-id',
        name: 'Team Server',
        visibility: 'team',
        owner_team_id: 'team-1'
      };

      mockMcpService.getServerById.mockResolvedValue(teamServer);

      const handler = routeHandlers['PUT /mcp/servers/global/:id'];
      await handler(mockRequest, mockReply);

      expect(mockMcpService.getServerById).toHaveBeenCalledWith('test-server-id');
      expect(mockMcpService.updateServer).not.toHaveBeenCalled();

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Server not found or not a global server'
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'update_global_mcp_server',
          userId: 'test-user-id',
          serverId: 'test-server-id',
          serverVisibility: 'team'
        }),
        'Attempted to update non-global server through global endpoint'
      );
    });

    it('should return 404 when updateServer returns null', async () => {
      const existingServer = {
        id: 'test-server-id',
        name: 'Old Server Name',
        visibility: 'global',
        owner_team_id: null
      };

      mockMcpService.getServerById.mockResolvedValue(existingServer);
      mockMcpService.updateServer.mockResolvedValue(null);

      const handler = routeHandlers['PUT /mcp/servers/global/:id'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Server not found'
      });
    });

    it('should handle partial updates', async () => {
      const existingServer = {
        id: 'test-server-id',
        name: 'Old Server Name',
        visibility: 'global',
        owner_team_id: null
      };

      const updatedServer = {
        id: 'test-server-id',
        name: 'Updated Server Name',
        slug: 'updated-server-name',
        description: 'Old description',
        long_description: null,
        github_url: null,
        git_branch: null,
        homepage_url: null,
        language: 'javascript',
        runtime: 'node',
        runtime_min_version: null,
        installation_methods: '[]',
        tools: '[]',
        resources: null,
        prompts: null,
        visibility: 'global',
        owner_team_id: null,
        created_by: 'user-1',
        author_name: null,
        author_contact: null,
        organization: null,
        license: null,
        default_config: null,
        environment_variables: null,
        dependencies: null,
        category_id: null,
        tags: null,
        status: 'active',
        featured: false,
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-02'),
        last_sync_at: null
      };

      mockMcpService.getServerById.mockResolvedValue(existingServer);
      mockMcpService.updateServer.mockResolvedValue(updatedServer);

      const partialUpdateRequest = {
        ...mockRequest,
        body: { name: 'Updated Server Name' }
      };

      const handler = routeHandlers['PUT /mcp/servers/global/:id'];
      await handler(partialUpdateRequest, mockReply);

      expect(mockMcpService.updateServer).toHaveBeenCalledWith(
        'test-server-id',
        'test-user-id',
        'global_admin',
        { name: 'Updated Server Name' }
      );

      expect(mockReply.status).toHaveBeenCalledWith(200);
    });

    it('should handle complex update payloads', async () => {
      const existingServer = {
        id: 'test-server-id',
        name: 'Old Server Name',
        visibility: 'global',
        owner_team_id: null
      };

      const updatedServer = {
        id: 'test-server-id',
        name: 'Complex Server Update',
        slug: 'complex-server-update',
        description: 'A comprehensive server update',
        long_description: 'This is a detailed description',
        github_url: 'https://github.com/complex/server',
        git_branch: 'main',
        homepage_url: 'https://complex-server.example.com',
        language: 'typescript',
        runtime: 'node',
        runtime_min_version: '18.0.0',
        installation_methods: '[{"type": "npm", "command": "npm install"}]',
        tools: '[{"name": "tool1", "description": "First tool"}]',
        resources: '[{"type": "file", "description": "File resource"}]',
        prompts: '[{"name": "prompt1", "description": "First prompt"}]',
        visibility: 'global',
        owner_team_id: null,
        created_by: 'user-1',
        author_name: 'Test Author',
        author_contact: 'author@example.com',
        organization: 'Test Organization',
        license: 'MIT',
        default_config: '{"key": "value"}',
        environment_variables: '[{"name": "TEST_VAR", "description": "Test variable", "required": false}]',
        dependencies: '{"dep1": "^1.0.0"}',
        category_id: 'category-1',
        tags: '["tag1", "tag2"]',
        status: 'active',
        featured: true,
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-02'),
        last_sync_at: new Date('2024-01-03')
      };

      mockMcpService.getServerById.mockResolvedValue(existingServer);
      mockMcpService.updateServer.mockResolvedValue(updatedServer);

      const complexUpdateRequest = {
        ...mockRequest,
        body: {
          name: 'Complex Server Update',
          description: 'A comprehensive server update',
          long_description: 'This is a detailed description',
          github_url: 'https://github.com/complex/server',
          git_branch: 'main',
          homepage_url: 'https://complex-server.example.com',
          language: 'typescript',
          runtime: 'node',
          runtime_min_version: '18.0.0',
          installation_methods: [{ type: 'npm', command: 'npm install' }],
          tools: [{ name: 'tool1', description: 'First tool' }],
          resources: [{ type: 'file', description: 'File resource' }],
          prompts: [{ name: 'prompt1', description: 'First prompt' }],
          author_name: 'Test Author',
          author_contact: 'author@example.com',
          organization: 'Test Organization',
          license: 'MIT',
          default_config: { key: 'value' },
          environment_variables: [{ name: 'TEST_VAR', description: 'Test variable', required: false }],
          dependencies: { dep1: '^1.0.0' },
          category_id: 'category-1',
          tags: ['tag1', 'tag2'],
          status: 'active',
          featured: true
        }
      };

      const handler = routeHandlers['PUT /mcp/servers/global/:id'];
      await handler(complexUpdateRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          id: 'test-server-id',
          name: 'Complex Server Update',
          installation_methods: [{ type: 'npm', command: 'npm install' }],
          tools: [{ name: 'tool1', description: 'First tool' }],
          resources: [{ type: 'file', description: 'File resource' }],
          prompts: [{ name: 'prompt1', description: 'First prompt' }],
          default_config: { key: 'value' },
          environment_variables: [{ name: 'TEST_VAR', description: 'Test variable', required: false }],
          dependencies: { dep1: '^1.0.0' },
          tags: ['tag1', 'tag2'],
          featured: true,
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-02T00:00:00.000Z',
          last_sync_at: '2024-01-03T00:00:00.000Z'
        })
      });
    });

    it('should parse JSON fields correctly in response', async () => {
      const existingServer = {
        id: 'test-server-id',
        name: 'Old Server Name',
        visibility: 'global',
        owner_team_id: null
      };

      const updatedServer = {
        id: 'test-server-id',
        name: 'Test Server',
        slug: 'test-server',
        description: 'A test server',
        long_description: null,
        github_url: null,
        git_branch: null,
        homepage_url: null,
        language: 'javascript',
        runtime: 'node',
        runtime_min_version: null,
        installation_methods: '["npm", "yarn"]',
        tools: '[{"name": "test-tool"}]',
        resources: '[{"name": "test-resource"}]',
        prompts: '[{"name": "test-prompt"}]',
        visibility: 'global',
        owner_team_id: null,
        created_by: 'user-1',
        author_name: null,
        author_contact: null,
        organization: null,
        license: null,
        default_config: '{"key": "value"}',
        environment_variables: '[{"name": "TEST_VAR"}]',
        dependencies: '{"dep1": "^1.0.0"}',
        category_id: null,
        tags: '["tag1", "tag2"]',
        status: 'active',
        featured: false,
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-02'),
        last_sync_at: new Date('2024-01-03')
      };

      mockMcpService.getServerById.mockResolvedValue(existingServer);
      mockMcpService.updateServer.mockResolvedValue(updatedServer);

      const handler = routeHandlers['PUT /mcp/servers/global/:id'];
      await handler(mockRequest, mockReply);

      const response = (mockReply.send as any).mock.calls[0][0];
      const server = response.data;

      expect(server.installation_methods).toEqual(['npm', 'yarn']);
      expect(server.tools).toEqual([{ name: 'test-tool' }]);
      expect(server.resources).toEqual([{ name: 'test-resource' }]);
      expect(server.prompts).toEqual([{ name: 'test-prompt' }]);
      expect(server.default_config).toEqual({ key: 'value' });
      expect(server.environment_variables).toEqual([{ name: 'TEST_VAR' }]);
      expect(server.dependencies).toEqual({ dep1: '^1.0.0' });
      expect(server.tags).toEqual(['tag1', 'tag2']);
      expect(server.created_at).toBe('2024-01-01T00:00:00.000Z');
      expect(server.updated_at).toBe('2024-01-02T00:00:00.000Z');
      expect(server.last_sync_at).toBe('2024-01-03T00:00:00.000Z');
    });

    it('should handle null JSON fields correctly in response', async () => {
      const existingServer = {
        id: 'test-server-id',
        name: 'Old Server Name',
        visibility: 'global',
        owner_team_id: null
      };

      const updatedServer = {
        id: 'test-server-id',
        name: 'Test Server',
        slug: 'test-server',
        description: 'A test server',
        long_description: null,
        github_url: null,
        git_branch: null,
        homepage_url: null,
        language: 'javascript',
        runtime: 'node',
        runtime_min_version: null,
        installation_methods: '[]',
        tools: '[]',
        resources: null,
        prompts: null,
        visibility: 'global',
        owner_team_id: null,
        created_by: 'user-1',
        author_name: null,
        author_contact: null,
        organization: null,
        license: null,
        default_config: null,
        environment_variables: null,
        dependencies: null,
        category_id: null,
        tags: null,
        status: 'active',
        featured: false,
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-02'),
        last_sync_at: null
      };

      mockMcpService.getServerById.mockResolvedValue(existingServer);
      mockMcpService.updateServer.mockResolvedValue(updatedServer);

      const handler = routeHandlers['PUT /mcp/servers/global/:id'];
      await handler(mockRequest, mockReply);

      const response = (mockReply.send as any).mock.calls[0][0];
      const server = response.data;

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

  describe('Error Handling', () => {
    beforeEach(async () => {
      await updateGlobalServer(mockFastify as FastifyInstance);
    });

    it('should handle UNIQUE constraint errors (409)', async () => {
      const existingServer = {
        id: 'test-server-id',
        name: 'Old Server Name',
        visibility: 'global',
        owner_team_id: null
      };

      mockMcpService.getServerById.mockResolvedValue(existingServer);
      mockMcpService.updateServer.mockRejectedValue(new Error('UNIQUE constraint failed: mcp_servers.name'));

      const handler = routeHandlers['PUT /mcp/servers/global/:id'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(409);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Server name already exists'
      });
    });

    it('should handle "already exists" errors (409)', async () => {
      const existingServer = {
        id: 'test-server-id',
        name: 'Old Server Name',
        visibility: 'global',
        owner_team_id: null
      };

      mockMcpService.getServerById.mockResolvedValue(existingServer);
      mockMcpService.updateServer.mockRejectedValue(new Error('Server name already exists'));

      const handler = routeHandlers['PUT /mcp/servers/global/:id'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(409);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Server name already exists'
      });
    });

    it('should handle "duplicate" errors (409)', async () => {
      const existingServer = {
        id: 'test-server-id',
        name: 'Old Server Name',
        visibility: 'global',
        owner_team_id: null
      };

      mockMcpService.getServerById.mockResolvedValue(existingServer);
      mockMcpService.updateServer.mockRejectedValue(new Error('duplicate key value violates unique constraint'));

      const handler = routeHandlers['PUT /mcp/servers/global/:id'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(409);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Server name already exists'
      });
    });

    it('should handle "Server not found" errors (404)', async () => {
      const existingServer = {
        id: 'test-server-id',
        name: 'Old Server Name',
        visibility: 'global',
        owner_team_id: null
      };

      mockMcpService.getServerById.mockResolvedValue(existingServer);
      mockMcpService.updateServer.mockRejectedValue(new Error('Server not found'));

      const handler = routeHandlers['PUT /mcp/servers/global/:id'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Server not found'
      });
    });

    it('should handle "Insufficient permissions" errors (403)', async () => {
      const existingServer = {
        id: 'test-server-id',
        name: 'Old Server Name',
        visibility: 'global',
        owner_team_id: null
      };

      mockMcpService.getServerById.mockResolvedValue(existingServer);
      mockMcpService.updateServer.mockRejectedValue(new Error('Insufficient permissions'));

      const handler = routeHandlers['PUT /mcp/servers/global/:id'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Global admin permissions required'
      });
    });

    it('should handle generic errors (500)', async () => {
      const existingServer = {
        id: 'test-server-id',
        name: 'Old Server Name',
        visibility: 'global',
        owner_team_id: null
      };

      mockMcpService.getServerById.mockResolvedValue(existingServer);
      mockMcpService.updateServer.mockRejectedValue(new Error('Database connection failed'));

      const handler = routeHandlers['PUT /mcp/servers/global/:id'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to update global MCP server'
      });
    });

    it('should handle getServerById errors (500)', async () => {
      mockMcpService.getServerById.mockRejectedValue(new Error('Database error'));

      const handler = routeHandlers['PUT /mcp/servers/global/:id'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to update global MCP server'
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'update_global_mcp_server',
          userId: 'test-user-id',
          serverId: 'test-server-id',
          error: expect.any(Error)
        }),
        'Failed to update global MCP server'
      );
    });
  });

  describe('Logging', () => {
    beforeEach(async () => {
      await updateGlobalServer(mockFastify as FastifyInstance);
    });

    it('should log update operation start', async () => {
      const existingServer = {
        id: 'test-server-id',
        name: 'Old Server Name',
        visibility: 'global',
        owner_team_id: null
      };

      const updatedServer = {
        id: 'test-server-id',
        name: 'Updated Server Name',
        slug: 'updated-server-name',
        description: 'Updated description',
        long_description: null,
        github_url: null,
        git_branch: null,
        homepage_url: null,
        language: 'javascript',
        runtime: 'node',
        runtime_min_version: null,
        installation_methods: '[]',
        tools: '[]',
        resources: null,
        prompts: null,
        visibility: 'global',
        owner_team_id: null,
        created_by: 'user-1',
        author_name: null,
        author_contact: null,
        organization: null,
        license: null,
        default_config: null,
        environment_variables: null,
        dependencies: null,
        category_id: null,
        tags: null,
        status: 'active',
        featured: false,
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-02'),
        last_sync_at: null
      };

      mockMcpService.getServerById.mockResolvedValue(existingServer);
      mockMcpService.updateServer.mockResolvedValue(updatedServer);

      const handler = routeHandlers['PUT /mcp/servers/global/:id'];
      await handler(mockRequest, mockReply);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'update_global_mcp_server',
          userId: 'test-user-id',
          serverId: 'test-server-id',
          updateFields: ['name', 'description']
        }),
        'Updating global MCP server'
      );
    });

    it('should log when server not found', async () => {
      mockMcpService.getServerById.mockResolvedValue(null);

      const handler = routeHandlers['PUT /mcp/servers/global/:id'];
      await handler(mockRequest, mockReply);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'update_global_mcp_server',
          userId: 'test-user-id',
          serverId: 'test-server-id'
        }),
        'Server not found'
      );
    });

    it('should log successful update', async () => {
      const existingServer = {
        id: 'test-server-id',
        name: 'Old Server Name',
        visibility: 'global',
        owner_team_id: null
      };

      const updatedServer = {
        id: 'test-server-id',
        name: 'Updated Server Name',
        slug: 'updated-server-name',
        description: 'Updated description',
        long_description: null,
        github_url: null,
        git_branch: null,
        homepage_url: null,
        language: 'javascript',
        runtime: 'node',
        runtime_min_version: null,
        installation_methods: '[]',
        tools: '[]',
        resources: null,
        prompts: null,
        visibility: 'global',
        owner_team_id: null,
        created_by: 'user-1',
        author_name: null,
        author_contact: null,
        organization: null,
        license: null,
        default_config: null,
        environment_variables: null,
        dependencies: null,
        category_id: null,
        tags: null,
        status: 'active',
        featured: false,
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-02'),
        last_sync_at: null
      };

      mockMcpService.getServerById.mockResolvedValue(existingServer);
      mockMcpService.updateServer.mockResolvedValue(updatedServer);

      const handler = routeHandlers['PUT /mcp/servers/global/:id'];
      await handler(mockRequest, mockReply);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'update_global_mcp_server',
          userId: 'test-user-id',
          serverId: 'test-server-id',
          serverName: 'Updated Server Name',
          updatedFields: ['name', 'description']
        }),
        'Global MCP server updated successfully'
      );
    });

    it('should log errors', async () => {
      mockMcpService.getServerById.mockRejectedValue(new Error('Database error'));

      const handler = routeHandlers['PUT /mcp/servers/global/:id'];
      await handler(mockRequest, mockReply);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'update_global_mcp_server',
          userId: 'test-user-id',
          serverId: 'test-server-id',
          error: expect.any(Error)
        }),
        'Failed to update global MCP server'
      );
    });
  });

  describe('Request Validation', () => {
    beforeEach(async () => {
      await updateGlobalServer(mockFastify as FastifyInstance);
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

        const handler = routeHandlers['PUT /mcp/servers/global/:id'];
        const requestWithId = {
          ...mockRequest,
          params: { id: testId }
        };

        await handler(requestWithId, mockReply);

        expect(mockMcpService.getServerById).toHaveBeenCalledWith(testId);
      }
    });

    it('should handle empty request body', async () => {
      const existingServer = {
        id: 'test-server-id',
        name: 'Old Server Name',
        visibility: 'global',
        owner_team_id: null
      };

      const updatedServer = {
        id: 'test-server-id',
        name: 'Old Server Name',
        slug: 'old-server-name',
        description: 'Old description',
        long_description: null,
        github_url: null,
        git_branch: null,
        homepage_url: null,
        language: 'javascript',
        runtime: 'node',
        runtime_min_version: null,
        installation_methods: '[]',
        tools: '[]',
        resources: null,
        prompts: null,
        visibility: 'global',
        owner_team_id: null,
        created_by: 'user-1',
        author_name: null,
        author_contact: null,
        organization: null,
        license: null,
        default_config: null,
        environment_variables: null,
        dependencies: null,
        category_id: null,
        tags: null,
        status: 'active',
        featured: false,
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-02'),
        last_sync_at: null
      };

      mockMcpService.getServerById.mockResolvedValue(existingServer);
      mockMcpService.updateServer.mockResolvedValue(updatedServer);

      const emptyBodyRequest = {
        ...mockRequest,
        body: {}
      };

      const handler = routeHandlers['PUT /mcp/servers/global/:id'];
      await handler(emptyBodyRequest, mockReply);

      expect(mockMcpService.updateServer).toHaveBeenCalledWith(
        'test-server-id',
        'test-user-id',
        'global_admin',
        {}
      );

      expect(mockReply.status).toHaveBeenCalledWith(200);
    });

    it('should handle status updates', async () => {
      const existingServer = {
        id: 'test-server-id',
        name: 'Old Server Name',
        visibility: 'global',
        owner_team_id: null
      };

      const statusUpdates = [
        { status: 'active' },
        { status: 'deprecated' },
        { status: 'maintenance' },
        { featured: true },
        { featured: false },
        { status: 'active', featured: true }
      ];

      for (const statusUpdate of statusUpdates) {
        const updatedServer = {
          id: 'test-server-id',
          name: 'Old Server Name',
          slug: 'old-server-name',
          description: 'Old description',
          long_description: null,
          github_url: null,
          git_branch: null,
          homepage_url: null,
          language: 'javascript',
          runtime: 'node',
          runtime_min_version: null,
          installation_methods: '[]',
          tools: '[]',
          resources: null,
          prompts: null,
          visibility: 'global',
          owner_team_id: null,
          created_by: 'user-1',
          author_name: null,
          author_contact: null,
          organization: null,
          license: null,
          default_config: null,
          environment_variables: null,
          dependencies: null,
          category_id: null,
          tags: null,
          status: statusUpdate.status || 'active',
          featured: statusUpdate.featured !== undefined ? statusUpdate.featured : false,
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-02'),
          last_sync_at: null
        };

        mockMcpService.getServerById.mockResolvedValue(existingServer);
        mockMcpService.updateServer.mockResolvedValue(updatedServer);

        const statusUpdateRequest = {
          ...mockRequest,
          body: statusUpdate
        };

        const handler = routeHandlers['PUT /mcp/servers/global/:id'];
        await handler(statusUpdateRequest, mockReply);

        expect(mockMcpService.updateServer).toHaveBeenCalledWith(
          'test-server-id',
          'test-user-id',
          'global_admin',
          statusUpdate
        );

        expect(mockReply.status).toHaveBeenCalledWith(200);

        // Reset mocks for next iteration
        vi.clearAllMocks();
        mockMcpService.getServerById.mockClear();
        mockMcpService.updateServer.mockClear();
      }
    });
  });

  describe('Response Format', () => {
    beforeEach(async () => {
      await updateGlobalServer(mockFastify as FastifyInstance);
    });

    it('should return response in correct format for success', async () => {
      const existingServer = {
        id: 'test-server-id',
        name: 'Old Server Name',
        visibility: 'global',
        owner_team_id: null
      };

      const updatedServer = {
        id: 'test-server-id',
        name: 'Updated Server Name',
        slug: 'updated-server-name',
        description: 'Updated description',
        long_description: null,
        github_url: null,
        git_branch: null,
        homepage_url: null,
        language: 'javascript',
        runtime: 'node',
        runtime_min_version: null,
        installation_methods: '[]',
        tools: '[]',
        resources: null,
        prompts: null,
        visibility: 'global',
        owner_team_id: null,
        created_by: 'user-1',
        author_name: null,
        author_contact: null,
        organization: null,
        license: null,
        default_config: null,
        environment_variables: null,
        dependencies: null,
        category_id: null,
        tags: null,
        status: 'active',
        featured: false,
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-02'),
        last_sync_at: null
      };

      mockMcpService.getServerById.mockResolvedValue(existingServer);
      mockMcpService.updateServer.mockResolvedValue(updatedServer);

      const handler = routeHandlers['PUT /mcp/servers/global/:id'];
      await handler(mockRequest, mockReply);

      const sendCall = (mockReply.send as any).mock.calls[0];
      const response = sendCall[0];

      expect(response).toHaveProperty('success');
      expect(response).toHaveProperty('data');
      expect(response.success).toBe(true);
      expect(typeof response.success).toBe('boolean');
      expect(typeof response.data).toBe('object');
      expect(response.data).toHaveProperty('id');
      expect(response.data).toHaveProperty('name');
      expect(response.data).toHaveProperty('visibility');
    });

    it('should return response in correct format for errors', async () => {
      mockMcpService.getServerById.mockResolvedValue(null);

      const handler = routeHandlers['PUT /mcp/servers/global/:id'];
      await handler(mockRequest, mockReply);

      const sendCall = (mockReply.send as any).mock.calls[0];
      const response = sendCall[0];

      expect(response).toHaveProperty('success');
      expect(response).toHaveProperty('error');
      expect(response.success).toBe(false);
      expect(typeof response.success).toBe('boolean');
      expect(typeof response.error).toBe('string');
    });

    it('should set correct HTTP status codes', async () => {
      const testCases = [
        {
          description: 'success case',
          setup: () => {
            const existingServer = { id: 'test-server-id', name: 'Old Server Name', visibility: 'global', owner_team_id: null };
            const updatedServer = { 
              id: 'test-server-id', name: 'Updated Server Name', slug: 'updated-server-name', description: 'Updated description',
              long_description: null, github_url: null, git_branch: null, homepage_url: null, language: 'javascript', runtime: 'node',
              runtime_min_version: null, installation_methods: '[]', tools: '[]', resources: null, prompts: null, visibility: 'global',
              owner_team_id: null, created_by: 'user-1', author_name: null, author_contact: null, organization: null, license: null,
              default_config: null, environment_variables: null, dependencies: null, category_id: null, tags: null, status: 'active',
              featured: false, created_at: new Date('2024-01-01'), updated_at: new Date('2024-01-02'), last_sync_at: null
            };
            mockMcpService.getServerById.mockResolvedValue(existingServer);
            mockMcpService.updateServer.mockResolvedValue(updatedServer);
          },
          expectedStatus: 200
        },
        {
          description: 'server not found',
          setup: () => {
            mockMcpService.getServerById.mockResolvedValue(null);
          },
          expectedStatus: 404
        },
        {
          description: 'non-global server',
          setup: () => {
            const teamServer = { id: 'test-server-id', name: 'Team Server', visibility: 'team', owner_team_id: 'team-1' };
            mockMcpService.getServerById.mockResolvedValue(teamServer);
          },
          expectedStatus: 404
        }
      ];

      for (const testCase of testCases) {
        testCase.setup();

        const handler = routeHandlers['PUT /mcp/servers/global/:id'];
        await handler(mockRequest, mockReply);

        expect(mockReply.status).toHaveBeenCalledWith(testCase.expectedStatus);

        // Reset mocks for next iteration
        vi.clearAllMocks();
        mockMcpService.getServerById.mockClear();
        mockMcpService.updateServer.mockClear();
      }
    });
  });
});
