import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import createGlobalServer from '../../../../../src/routes/mcp/servers/create-global';
import { McpCatalogService } from '../../../../../src/services/mcpCatalogService';
import { requireGlobalAdmin } from '../../../../../src/middleware/roleMiddleware';
import { getDb } from '../../../../../src/db';

// Mock dependencies
vi.mock('../../../../../src/services/mcpCatalogService');
vi.mock('../../../../../src/middleware/roleMiddleware');
vi.mock('../../../../../src/db');

describe('MCP Servers - Create Global', () => {
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
      createServer: vi.fn()
    };

    // Setup mock preValidation
    mockPreValidation = vi.fn();

    // Setup mocks
    vi.mocked(getDb).mockReturnValue(mockDb);
    vi.mocked(McpCatalogService).mockImplementation(() => mockMcpService);
    vi.mocked(requireGlobalAdmin).mockReturnValue(mockPreValidation);

    // Setup mock Fastify instance
    mockFastify = {
      post: vi.fn((path: string, options: any, handler?: any) => {
        if (handler) {
          routeHandlers[`POST ${path}`] = handler;
        } else {
          routeHandlers[`POST ${path}`] = options;
        }
        return mockFastify as FastifyInstance;
      }),
    } as any;

    // Setup mock request
    mockRequest = {
      body: {
        name: 'Test Server',
        description: 'A test global MCP server',
        language: 'javascript',
        runtime: 'node',
        claude_desktop_config: {
          mcpServers: {
            'test-server': {
              command: 'npm',
              args: ['install', 'test-server'],
              env: {}
            }
          }
        },
        tools: [{ name: 'test-tool', description: 'A test tool' }],
        featured: false
      },
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
    it('should register create global MCP server route', async () => {
      await createGlobalServer(mockFastify as FastifyInstance);

      expect(mockFastify.post).toHaveBeenCalledWith(
        '/mcp/servers/global',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should configure route with correct schema', async () => {
      await createGlobalServer(mockFastify as FastifyInstance);

      const postCall = (mockFastify.post as any).mock.calls.find(
        (call: any[]) => call[0] === '/mcp/servers/global'
      );
      
      expect(postCall).toBeDefined();
      const [, schema] = postCall;
      
      expect(schema.schema).toBeDefined();
      expect(schema.schema.tags).toEqual(['MCP Servers']);
      expect(schema.schema.summary).toBe('Create global MCP server (Global Admin only)');
      expect(schema.schema.description).toContain('Create a new global MCP server');
      expect(schema.schema.security).toEqual([{ cookieAuth: [] }]);
    });

    it('should have preValidation hook for global admin authentication', async () => {
      await createGlobalServer(mockFastify as FastifyInstance);

      const postCall = (mockFastify.post as any).mock.calls.find(
        (call: any[]) => call[0] === '/mcp/servers/global'
      );
      
      expect(postCall).toBeDefined();
      const [, schema] = postCall;
      
      expect(schema.preValidation).toBeDefined();
      expect(requireGlobalAdmin).toHaveBeenCalled();
    });

    it('should have proper request and response schemas', async () => {
      await createGlobalServer(mockFastify as FastifyInstance);

      const postCall = (mockFastify.post as any).mock.calls.find(
        (call: any[]) => call[0] === '/mcp/servers/global'
      );
      
      const [, schema] = postCall;
      
      expect(schema.schema.requestBody).toBeDefined();
      expect(schema.schema.requestBody.required).toBe(true);
      expect(schema.schema.requestBody.content['application/json']).toBeDefined();
      expect(schema.schema.response).toBeDefined();
      expect(schema.schema.response[201]).toBeDefined();
      expect(schema.schema.response[400]).toBeDefined();
      expect(schema.schema.response[401]).toBeDefined();
      expect(schema.schema.response[403]).toBeDefined();
      expect(schema.schema.response[409]).toBeDefined();
      expect(schema.schema.response[500]).toBeDefined();
    });
  });

  describe('Authentication and Authorization', () => {
    beforeEach(async () => {
      await createGlobalServer(mockFastify as FastifyInstance);
    });

    it('should require global admin authentication', async () => {
      expect(requireGlobalAdmin).toHaveBeenCalled();
      
      const postCall = (mockFastify.post as any).mock.calls.find(
        (call: any[]) => call[0] === '/mcp/servers/global'
      );
      
      expect(postCall[1].preValidation).toBe(mockPreValidation);
    });
  });

  describe('POST /mcp/servers/global', () => {
    beforeEach(async () => {
      await createGlobalServer(mockFastify as FastifyInstance);
    });

    it('should create global server successfully', async () => {
      const createdServer = {
        id: 'server-123',
        name: 'Test Server',
        slug: 'test-server',
        description: 'A test global MCP server',
        long_description: null,
        github_url: null,
        git_branch: 'main',
        homepage_url: null,
        language: 'javascript',
        runtime: 'node',
        runtime_min_version: null,
        installation_methods: '[{"type": "npm", "command": "npm install test-server"}]',
        tools: '[{"name": "test-tool", "description": "A test tool"}]',
        resources: null,
        prompts: null,
        visibility: 'global',
        owner_team_id: null,
        created_by: 'test-user-id',
        author_name: null,
        author_contact: null,
        organization: null,
        license: null,
        transport_type: 'stdio',
        template_args: null,
        template_env: null,
        team_args_schema: null,
        user_args_schema: null,
        team_env_schema: null,
        user_env_schema: null,
        dependencies: null,
        category_id: null,
        tags: null,
        status: 'active',
        featured: false,
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
        last_sync_at: null
      };

      mockMcpService.createServer.mockResolvedValue(createdServer);

      const handler = routeHandlers['POST /mcp/servers/global'];
      await handler(mockRequest, mockReply);

      expect(mockMcpService.createServer).toHaveBeenCalledWith(
        'test-user-id',
        'global_admin',
        null,
        expect.objectContaining({
          name: 'Test Server',
          description: 'A test global MCP server',
          language: 'javascript',
          runtime: 'node',
          installation_methods: [{
            client: 'claude-desktop',
            command: 'npm',
            args: ['install', 'test-server'],
            env: {}
          }],
          tools: [{ name: 'test-tool', description: 'A test tool' }],
          visibility: 'global'
        })
      );

      expect(mockReply.status).toHaveBeenCalledWith(201);
      expect(mockReply.type).toHaveBeenCalledWith('application/json');
      
      // Parse the JSON string response
      const sentData = (mockReply.send as any).mock.calls[0][0];
      const response = JSON.parse(sentData);
      
      expect(response).toEqual({
        success: true,
        data: expect.objectContaining({
          id: 'server-123',
          name: 'Test Server',
          slug: 'test-server',
          description: 'A test global MCP server',
          language: 'javascript',
          runtime: 'node',
          installation_methods: [{ type: 'npm', command: 'npm install test-server' }],
          tools: [{ name: 'test-tool', description: 'A test tool' }],
          visibility: 'global',
          owner_team_id: null,
          created_by: 'test-user-id',
          status: 'active',
          featured: false,
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
          last_sync_at: null
        })
      });
    });

    it('should create server with complex payload', async () => {
      const complexRequest = {
        ...mockRequest,
        body: {
          name: 'Complex Server',
          description: 'A comprehensive test server',
          long_description: 'This is a detailed description of the server',
          github_url: 'https://github.com/test/complex-server',
          git_branch: 'develop',
          homepage_url: 'https://complex-server.example.com',
          language: 'typescript',
          runtime: 'node',
          runtime_min_version: '18.0.0',
          claude_desktop_config: {
            mcpServers: {
              'complex-server': {
                command: 'npx',
                args: ['complex-server'],
                env: {
                  'TEST_VAR': 'test_value',
                  'API_KEY': 'secret'
                }
              }
            }
          },
          tools: [
            { name: 'complex-tool', description: 'A complex tool' },
            { name: 'another-tool', description: 'Another tool' }
          ],
          resources: [
            { type: 'file', description: 'File resource' },
            { type: 'database', description: 'Database resource' }
          ],
          prompts: [
            { name: 'test-prompt', description: 'A test prompt' }
          ],
          author_name: 'Test Author',
          author_contact: 'author@example.com',
          organization: 'Test Organization',
          license: 'MIT',
          dependencies: { lodash: '^4.17.21', express: '^4.18.0' },
          category_id: 'category-123',
          tags: ['testing', 'example', 'complex'],
          featured: true
        }
      };

      const createdServer = {
        id: 'server-456',
        name: 'Complex Server',
        slug: 'complex-server',
        description: 'A comprehensive test server',
        long_description: 'This is a detailed description of the server',
        github_url: 'https://github.com/test/complex-server',
        git_branch: 'develop',
        homepage_url: 'https://complex-server.example.com',
        language: 'typescript',
        runtime: 'node',
        runtime_min_version: '18.0.0',
        installation_methods: '[{"type": "npm", "command": "npm install complex-server", "description": "Install via npm"}, {"type": "docker", "image": "complex-server:latest", "description": "Run with Docker"}]',
        tools: '[{"name": "complex-tool", "description": "A complex tool"}, {"name": "another-tool", "description": "Another tool"}]',
        resources: '[{"type": "file", "description": "File resource"}, {"type": "database", "description": "Database resource"}]',
        prompts: '[{"name": "test-prompt", "description": "A test prompt"}]',
        visibility: 'global',
        owner_team_id: null,
        created_by: 'test-user-id',
        author_name: 'Test Author',
        author_contact: 'author@example.com',
        organization: 'Test Organization',
        license: 'MIT',
        transport_type: 'stdio',
        template_args: '["-y", "@modelcontextprotocol/server-complex"]',
        template_env: null,
        team_args_schema: null,
        user_args_schema: '[{"name": "directory_paths", "type": "repeatable_directory_paths", "description": "Directories to allow access", "user_configurable": true}]',
        team_env_schema: null,
        user_env_schema: '[{"name": "TEST_VAR", "type": "string", "description": "Test variable", "required": true, "default_value": "test", "user_configurable": true}]',
        dependencies: '{"lodash": "^4.17.21", "express": "^4.18.0"}',
        category_id: 'category-123',
        tags: '["testing", "example", "complex"]',
        status: 'active',
        featured: true,
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
        last_sync_at: null
      };

      mockMcpService.createServer.mockResolvedValue(createdServer);

      const handler = routeHandlers['POST /mcp/servers/global'];
      await handler(complexRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(201);
      expect(mockReply.type).toHaveBeenCalledWith('application/json');
      
      // Parse the JSON string response
      const sentData = (mockReply.send as any).mock.calls[0][0];
      const response = JSON.parse(sentData);
      
      expect(response).toEqual({
        success: true,
        data: expect.objectContaining({
          id: 'server-456',
          name: 'Complex Server',
          installation_methods: [
            { type: 'npm', command: 'npm install complex-server', description: 'Install via npm' },
            { type: 'docker', image: 'complex-server:latest', description: 'Run with Docker' }
          ],
          tools: [
            { name: 'complex-tool', description: 'A complex tool' },
            { name: 'another-tool', description: 'Another tool' }
          ],
          resources: [
            { type: 'file', description: 'File resource' },
            { type: 'database', description: 'Database resource' }
          ],
          prompts: [
            { name: 'test-prompt', description: 'A test prompt' }
          ],
          template_args: ['-y', '@modelcontextprotocol/server-complex'],
          user_env_schema: [
            { name: 'TEST_VAR', type: 'string', description: 'Test variable', required: true, default_value: 'test', user_configurable: true }
          ],
          dependencies: { lodash: '^4.17.21', express: '^4.18.0' },
          tags: ['testing', 'example', 'complex'],
          featured: true
        })
      });
    });

    it('should parse JSON fields correctly in response', async () => {
      const createdServer = {
        id: 'server-789',
        name: 'JSON Test Server',
        slug: 'json-test-server',
        description: 'A server for testing JSON parsing',
        long_description: null,
        github_url: null,
        git_branch: 'main',
        homepage_url: null,
        language: 'javascript',
        runtime: 'node',
        runtime_min_version: null,
        installation_methods: '["npm", "yarn"]',
        tools: '[{"name": "json-tool"}]',
        resources: '[{"name": "json-resource"}]',
        prompts: '[{"name": "json-prompt"}]',
        visibility: 'global',
        owner_team_id: null,
        created_by: 'test-user-id',
        author_name: null,
        author_contact: null,
        organization: null,
        license: null,
        transport_type: 'stdio',
        template_args: '["-y", "@modelcontextprotocol/server-json"]',
        template_env: null,
        team_args_schema: null,
        user_args_schema: '[{"name": "directory_paths", "type": "repeatable_directory_paths", "description": "Directories to allow access", "user_configurable": true}]',
        team_env_schema: null,
        user_env_schema: '[{"name": "JSON_VAR", "type": "string", "description": "JSON test variable", "user_configurable": true}]',
        dependencies: '{"dep1": "^1.0.0"}',
        category_id: null,
        tags: '["json", "test"]',
        status: 'active',
        featured: false,
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
        last_sync_at: new Date('2024-01-02')
      };

      mockMcpService.createServer.mockResolvedValue(createdServer);

      const handler = routeHandlers['POST /mcp/servers/global'];
      await handler(mockRequest, mockReply);

      // Parse the JSON string response
      const sentData = (mockReply.send as any).mock.calls[0][0];
      const response = JSON.parse(sentData);
      const server = response.data;

      expect(server.installation_methods).toEqual(['npm', 'yarn']);
      expect(server.tools).toEqual([{ name: 'json-tool' }]);
      expect(server.resources).toEqual([{ name: 'json-resource' }]);
      expect(server.prompts).toEqual([{ name: 'json-prompt' }]);
      expect(server.transport_type).toEqual('stdio');
      expect(server.user_env_schema).toEqual([{ name: 'JSON_VAR', type: 'string', description: 'JSON test variable', user_configurable: true }]);
      expect(server.dependencies).toEqual({ dep1: '^1.0.0' });
      expect(server.tags).toEqual(['json', 'test']);
      expect(server.created_at).toBe('2024-01-01T00:00:00.000Z');
      expect(server.updated_at).toBe('2024-01-01T00:00:00.000Z');
      expect(server.last_sync_at).toBe('2024-01-02T00:00:00.000Z');
    });

    it('should handle null JSON fields correctly in response', async () => {
      const createdServer = {
        id: 'server-null',
        name: 'Null Test Server',
        slug: 'null-test-server',
        description: 'A server for testing null fields',
        long_description: null,
        github_url: null,
        git_branch: 'main',
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
        created_by: 'test-user-id',
        author_name: null,
        author_contact: null,
        organization: null,
        license: null,
        transport_type: 'stdio',
        template_args: null,
        template_env: null,
        team_args_schema: null,
        user_args_schema: null,
        team_env_schema: null,
        user_env_schema: null,
        dependencies: null,
        category_id: null,
        tags: null,
        status: 'active',
        featured: false,
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
        last_sync_at: null
      };

      mockMcpService.createServer.mockResolvedValue(createdServer);

      const handler = routeHandlers['POST /mcp/servers/global'];
      await handler(mockRequest, mockReply);

      // Parse the JSON string response
      const sentData = (mockReply.send as any).mock.calls[0][0];
      const response = JSON.parse(sentData);
      const server = response.data;

      expect(server.installation_methods).toEqual([]);
      expect(server.tools).toEqual([]);
      expect(server.resources).toBeNull();
      expect(server.prompts).toBeNull();
      expect(server.transport_type).toEqual('stdio');
      expect(server.user_env_schema).toBeNull();
      expect(server.dependencies).toBeNull();
      expect(server.tags).toBeNull();
      expect(server.last_sync_at).toBeNull();
    });

    it('should force global visibility', async () => {
      const requestWithTeamVisibility = {
        ...mockRequest,
        body: {
          ...(mockRequest.body as any),
          visibility: 'team' // This should be overridden
        }
      };

      const createdServer = {
        id: 'server-global',
        name: 'Test Server',
        slug: 'test-server',
        description: 'A test global MCP server',
        long_description: null,
        github_url: null,
        git_branch: 'main',
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
        created_by: 'test-user-id',
        author_name: null,
        author_contact: null,
        organization: null,
        license: null,
        transport_type: 'stdio',
        environment_variables: null,
        dependencies: null,
        category_id: null,
        tags: null,
        status: 'active',
        featured: false,
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
        last_sync_at: null
      };

      mockMcpService.createServer.mockResolvedValue(createdServer);

      const handler = routeHandlers['POST /mcp/servers/global'];
      await handler(requestWithTeamVisibility, mockReply);

      expect(mockMcpService.createServer).toHaveBeenCalledWith(
        'test-user-id',
        'global_admin',
        null,
        expect.objectContaining({
          visibility: 'global'
        })
      );

      // Parse the JSON string response
      const sentData = (mockReply.send as any).mock.calls[0][0];
      const response = JSON.parse(sentData);
      expect(response.data.visibility).toBe('global');
      expect(response.data.owner_team_id).toBeNull();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await createGlobalServer(mockFastify as FastifyInstance);
    });

    it('should handle UNIQUE constraint errors (409)', async () => {
      mockMcpService.createServer.mockRejectedValue(new Error('UNIQUE constraint failed: mcp_servers.name'));

      const handler = routeHandlers['POST /mcp/servers/global'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(409);
      expect(mockReply.type).toHaveBeenCalledWith('application/json');
      
      // Parse the JSON string response
      const sentData = (mockReply.send as any).mock.calls[0][0];
      const response = JSON.parse(sentData);
      
      expect(response).toEqual({
        success: false,
        error: 'Server name already exists'
      });
    });

    it('should handle "already exists" errors (409)', async () => {
      mockMcpService.createServer.mockRejectedValue(new Error('Server name already exists'));

      const handler = routeHandlers['POST /mcp/servers/global'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(409);
      expect(mockReply.type).toHaveBeenCalledWith('application/json');
      
      // Parse the JSON string response
      const sentData = (mockReply.send as any).mock.calls[0][0];
      const response = JSON.parse(sentData);
      
      expect(response).toEqual({
        success: false,
        error: 'Server name already exists'
      });
    });

    it('should handle "duplicate" errors (409)', async () => {
      mockMcpService.createServer.mockRejectedValue(new Error('duplicate key value violates unique constraint'));

      const handler = routeHandlers['POST /mcp/servers/global'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(409);
      expect(mockReply.type).toHaveBeenCalledWith('application/json');
      
      // Parse the JSON string response
      const sentData = (mockReply.send as any).mock.calls[0][0];
      const response = JSON.parse(sentData);
      
      expect(response).toEqual({
        success: false,
        error: 'Server name already exists'
      });
    });

    it('should handle global admin permission errors (403)', async () => {
      mockMcpService.createServer.mockRejectedValue(new Error('Only global administrators can create global servers'));

      const handler = routeHandlers['POST /mcp/servers/global'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(403);
      expect(mockReply.type).toHaveBeenCalledWith('application/json');
      
      // Parse the JSON string response
      const sentData = (mockReply.send as any).mock.calls[0][0];
      const response = JSON.parse(sentData);
      
      expect(response).toEqual({
        success: false,
        error: 'Global admin permissions required'
      });
    });

    it('should handle generic errors (500)', async () => {
      mockMcpService.createServer.mockRejectedValue(new Error('Database connection failed'));

      const handler = routeHandlers['POST /mcp/servers/global'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.type).toHaveBeenCalledWith('application/json');
      
      // Parse the JSON string response
      const sentData = (mockReply.send as any).mock.calls[0][0];
      const response = JSON.parse(sentData);
      
      expect(response).toEqual({
        success: false,
        error: 'Failed to create global MCP server'
      });
    });

    it('should handle JSON parsing errors in response (500)', async () => {
      const createdServerWithInvalidJson = {
        id: 'server-invalid',
        name: 'Invalid JSON Server',
        slug: 'invalid-json-server',
        description: 'A server with invalid JSON',
        long_description: null,
        github_url: null,
        git_branch: 'main',
        homepage_url: null,
        language: 'javascript',
        runtime: 'node',
        runtime_min_version: null,
        installation_methods: 'invalid json',
        tools: '[]',
        resources: null,
        prompts: null,
        visibility: 'global',
        owner_team_id: null,
        created_by: 'test-user-id',
        author_name: null,
        author_contact: null,
        organization: null,
        license: null,
        transport_type: 'stdio',
        environment_variables: null,
        dependencies: null,
        category_id: null,
        tags: null,
        status: 'active',
        featured: false,
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
        last_sync_at: null
      };

      mockMcpService.createServer.mockResolvedValue(createdServerWithInvalidJson);

      const handler = routeHandlers['POST /mcp/servers/global'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.type).toHaveBeenCalledWith('application/json');
      
      // Parse the JSON string response
      const sentData = (mockReply.send as any).mock.calls[0][0];
      const response = JSON.parse(sentData);
      
      expect(response).toEqual({
        success: false,
        error: 'Failed to format server response'
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'create_global_mcp_server',
          userId: 'test-user-id',
          serverId: 'server-invalid',
          jsonError: expect.any(Error)
        }),
        'Failed to parse JSON fields in response'
      );
    });
  });

  describe('Logging', () => {
    beforeEach(async () => {
      await createGlobalServer(mockFastify as FastifyInstance);
    });

    it('should log creation operation start', async () => {
      const createdServer = {
        id: 'server-log',
        name: 'Test Server',
        slug: 'test-server',
        description: 'A test global MCP server',
        long_description: null,
        github_url: null,
        git_branch: 'main',
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
        created_by: 'test-user-id',
        author_name: null,
        author_contact: null,
        organization: null,
        license: null,
        transport_type: 'stdio',
        environment_variables: null,
        dependencies: null,
        category_id: null,
        tags: null,
        status: 'active',
        featured: false,
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
        last_sync_at: null
      };

      mockMcpService.createServer.mockResolvedValue(createdServer);

      const handler = routeHandlers['POST /mcp/servers/global'];
      await handler(mockRequest, mockReply);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'create_global_mcp_server',
          userId: 'test-user-id',
          serverName: 'Test Server',
          language: 'javascript',
          runtime: 'node',
          featured: false
        }),
        'Creating global MCP server'
      );
    });

    it('should log successful creation', async () => {
      const createdServer = {
        id: 'server-success',
        name: 'Success Server',
        slug: 'success-server',
        description: 'A successful server',
        long_description: null,
        github_url: null,
        git_branch: 'main',
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
        created_by: 'test-user-id',
        author_name: null,
        author_contact: null,
        organization: null,
        license: null,
        template_args: null,
        template_env: null,
        team_args_schema: null,
        user_args_schema: null,
        team_env_schema: null,
        user_env_schema: null,
        dependencies: null,
        category_id: null,
        tags: null,
        status: 'active',
        featured: true,
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
        last_sync_at: null
      };

      mockMcpService.createServer.mockResolvedValue(createdServer);

      const featuredRequest = {
        ...mockRequest,
        body: {
          ...(mockRequest.body as any),
          featured: true
        }
      };

      const handler = routeHandlers['POST /mcp/servers/global'];
      await handler(featuredRequest, mockReply);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'create_global_mcp_server',
          userId: 'test-user-id',
          serverId: 'server-success',
          serverSlug: 'success-server',
          serverName: 'Success Server',
          featured: true
        }),
        'Global MCP server created successfully'
      );
    });

    it('should log errors', async () => {
      mockMcpService.createServer.mockRejectedValue(new Error('Database error'));

      const handler = routeHandlers['POST /mcp/servers/global'];
      await handler(mockRequest, mockReply);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'create_global_mcp_server',
          userId: 'test-user-id',
          serverName: 'Test Server',
          error: expect.any(Error)
        }),
        'Failed to create global MCP server'
      );
    });
  });

  describe('Request Validation', () => {
    beforeEach(async () => {
      await createGlobalServer(mockFastify as FastifyInstance);
    });

    it('should handle minimal valid request', async () => {
      const minimalRequest = {
        ...mockRequest,
        body: {
          name: 'Minimal Server',
          description: 'A minimal server',
          language: 'python',
          runtime: 'python',
          claude_desktop_config: {
            mcpServers: {
              'minimal-server': {
                command: 'python',
                args: ['-m', 'minimal_server'],
                env: {}
              }
            }
          },
          tools: [{ name: 'minimal-tool', description: 'A minimal tool' }]
        }
      };

      const createdServer = {
        id: 'server-minimal',
        name: 'Minimal Server',
        slug: 'minimal-server',
        description: 'A minimal server',
        long_description: null,
        github_url: null,
        git_branch: 'main',
        homepage_url: null,
        language: 'python',
        runtime: 'python',
        runtime_min_version: null,
        installation_methods: '[{"type": "pip"}]',
        tools: '[{"name": "minimal-tool", "description": "A minimal tool"}]',
        resources: null,
        prompts: null,
        visibility: 'global',
        owner_team_id: null,
        created_by: 'test-user-id',
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
        updated_at: new Date('2024-01-01'),
        last_sync_at: null
      };

      mockMcpService.createServer.mockResolvedValue(createdServer);

      const handler = routeHandlers['POST /mcp/servers/global'];
      await handler(minimalRequest, mockReply);

      expect(mockMcpService.createServer).toHaveBeenCalledWith(
        'test-user-id',
        'global_admin',
        null,
        expect.objectContaining({
          name: 'Minimal Server',
          description: 'A minimal server',
          language: 'python',
          runtime: 'python',
          installation_methods: [{
            client: 'claude-desktop',
            command: 'python',
            args: ['-m', 'minimal_server'],
            env: {}
          }],
          tools: [{ name: 'minimal-tool', description: 'A minimal tool' }],
          visibility: 'global'
        })
      );

      expect(mockReply.status).toHaveBeenCalledWith(201);
    });

    it('should handle different runtime and language combinations', async () => {
      const combinations = [
        { language: 'javascript', runtime: 'node' },
        { language: 'typescript', runtime: 'node' },
        { language: 'python', runtime: 'python' },
        { language: 'go', runtime: 'go' },
        { language: 'rust', runtime: 'rust' }
      ];

      for (const combo of combinations) {
        const comboRequest = {
          ...mockRequest,
          body: {
            ...(mockRequest.body as any),
            language: combo.language,
            runtime: combo.runtime
          }
        };

        const createdServer = {
          id: `server-${combo.language}`,
          name: 'Test Server',
          slug: 'test-server',
          description: 'A test global MCP server',
          long_description: null,
          github_url: null,
          git_branch: 'main',
          homepage_url: null,
          language: combo.language,
          runtime: combo.runtime,
          runtime_min_version: null,
          installation_methods: '[]',
          tools: '[]',
          resources: null,
          prompts: null,
          visibility: 'global',
          owner_team_id: null,
          created_by: 'test-user-id',
          author_name: null,
          author_contact: null,
          organization: null,
          license: null,
          transport_type: 'stdio',
          template_args: null,
          template_env: null,
          team_args_schema: null,
          user_args_schema: null,
          team_env_schema: null,
          user_env_schema: null,
          dependencies: null,
          category_id: null,
          tags: null,
          status: 'active',
          featured: false,
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01'),
          last_sync_at: null
        };

        mockMcpService.createServer.mockResolvedValue(createdServer);

        const handler = routeHandlers['POST /mcp/servers/global'];
        await handler(comboRequest, mockReply);

        expect(mockMcpService.createServer).toHaveBeenCalledWith(
          'test-user-id',
          'global_admin',
          null,
          expect.objectContaining({
            language: combo.language,
            runtime: combo.runtime,
            visibility: 'global'
          })
        );

        // Reset mocks for next iteration
        vi.clearAllMocks();
        mockMcpService.createServer.mockClear();
      }
    });
  });

  describe('Response Format', () => {
    beforeEach(async () => {
      await createGlobalServer(mockFastify as FastifyInstance);
    });

    it('should return response in correct format for success', async () => {
      const createdServer = {
        id: 'server-format',
        name: 'Format Test Server',
        slug: 'format-test-server',
        description: 'A server for testing response format',
        long_description: null,
        github_url: null,
        git_branch: 'main',
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
        created_by: 'test-user-id',
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
        updated_at: new Date('2024-01-01'),
        last_sync_at: null
      };

      mockMcpService.createServer.mockResolvedValue(createdServer);

      const handler = routeHandlers['POST /mcp/servers/global'];
      await handler(mockRequest, mockReply);

      // Parse the JSON string response
      const sentData = (mockReply.send as any).mock.calls[0][0];
      const response = JSON.parse(sentData);

      expect(response).toHaveProperty('success');
      expect(response).toHaveProperty('data');
      expect(response.success).toBe(true);
      expect(typeof response.success).toBe('boolean');
      expect(typeof response.data).toBe('object');
      expect(response.data).toHaveProperty('id');
      expect(response.data).toHaveProperty('name');
      expect(response.data).toHaveProperty('visibility');
      expect(response.data.visibility).toBe('global');
    });

    it('should return response in correct format for errors', async () => {
      mockMcpService.createServer.mockRejectedValue(new Error('Test error'));

      const handler = routeHandlers['POST /mcp/servers/global'];
      await handler(mockRequest, mockReply);

      // Parse the JSON string response
      const sentData = (mockReply.send as any).mock.calls[0][0];
      const response = JSON.parse(sentData);

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
            const createdServer = {
              id: 'server-201',
              name: 'Success Server',
              slug: 'success-server',
              description: 'A successful server',
              long_description: null,
              github_url: null,
              git_branch: 'main',
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
              created_by: 'test-user-id',
              author_name: null,
              author_contact: null,
              organization: null,
              license: null,
              transport_type: 'stdio',
              environment_variables: null,
              dependencies: null,
              category_id: null,
              tags: null,
              status: 'active',
              featured: false,
              created_at: new Date('2024-01-01'),
              updated_at: new Date('2024-01-01'),
              last_sync_at: null
            };
            mockMcpService.createServer.mockResolvedValue(createdServer);
          },
          expectedStatus: 201
        },
        {
          description: 'conflict error',
          setup: () => {
            mockMcpService.createServer.mockRejectedValue(new Error('Server name already exists'));
          },
          expectedStatus: 409
        },
        {
          description: 'permission error',
          setup: () => {
            mockMcpService.createServer.mockRejectedValue(new Error('Only global administrators can create global servers'));
          },
          expectedStatus: 403
        },
        {
          description: 'generic error',
          setup: () => {
            mockMcpService.createServer.mockRejectedValue(new Error('Database error'));
          },
          expectedStatus: 500
        }
      ];

      for (const testCase of testCases) {
        testCase.setup();

        const handler = routeHandlers['POST /mcp/servers/global'];
        await handler(mockRequest, mockReply);

        expect(mockReply.status).toHaveBeenCalledWith(testCase.expectedStatus);

        // Reset mocks for next iteration
        vi.clearAllMocks();
        mockMcpService.createServer.mockClear();
      }
    });
  });
});
