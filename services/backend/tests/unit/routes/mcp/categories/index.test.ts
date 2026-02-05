import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// Import all route handlers
import createCategory from '../../../../../src/routes/mcp/categories/create';
import deleteCategory from '../../../../../src/routes/mcp/categories/delete';
import listCategories from '../../../../../src/routes/mcp/categories/list';
import updateCategory from '../../../../../src/routes/mcp/categories/update';

// Import dependencies that need mocking
import { getDb } from '../../../../../src/db';
import { McpCategoriesService } from '../../../../../src/services/mcpCategoriesService';
import { requirePermission } from '../../../../../src/middleware/roleMiddleware';

// Mock dependencies
vi.mock('../../../../../src/db');
vi.mock('../../../../../src/services/mcpCategoriesService');
vi.mock('../../../../../src/middleware/roleMiddleware');

// Type the mocked functions
const mockGetDb = getDb as MockedFunction<typeof getDb>;
const MockedMcpCategoriesService = McpCategoriesService as any;
const mockRequirePermission = requirePermission as MockedFunction<typeof requirePermission>;

describe('MCP Categories Routes', () => {
  let mockFastify: Partial<FastifyInstance>;
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  let mockDb: any;
  let mockService: any;
  let routeHandlers: Record<string, any>;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup mock database
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    };

    // Setup mock service
    mockService = {
      getAllCategories: vi.fn(),
      getAllCategoriesWithServerCount: vi.fn(),
      getCategoryById: vi.fn(),
      createCategory: vi.fn(),
      updateCategory: vi.fn(),
      deleteCategory: vi.fn(),
    };

    mockGetDb.mockReturnValue(mockDb);
    MockedMcpCategoriesService.mockImplementation(() => mockService);

    // Mock the requirePermission middleware to return a no-op function
    mockRequirePermission.mockReturnValue(async (request: FastifyRequest, reply: FastifyReply) => {
      // No-op middleware for testing
    });

    // Setup route handlers storage
    routeHandlers = {};

    // Setup mock Fastify instance
    mockFastify = {
      get: vi.fn((path, options, handler) => {
        routeHandlers[`GET ${path}`] = handler;
        return mockFastify as FastifyInstance;
      }),
      post: vi.fn((path, options, handler) => {
        routeHandlers[`POST ${path}`] = handler;
        return mockFastify as FastifyInstance;
      }),
      put: vi.fn((path, options, handler) => {
        routeHandlers[`PUT ${path}`] = handler;
        return mockFastify as FastifyInstance;
      }),
      delete: vi.fn((path, options, handler) => {
        routeHandlers[`DELETE ${path}`] = handler;
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
      query: {},
      body: {},
      params: {},
      user: { id: 'test-user-id', role: 'user' },
      log: {
        trace: vi.fn(),
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }
    } as any;

    // Setup mock reply
    mockReply = {
      status: vi.fn().mockReturnThis(),
      type: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  // ========================
  // LIST CATEGORIES TESTS
  // ========================
  describe('List Categories Route (GET /mcp/categories)', () => {
    beforeEach(async () => {
      await listCategories(mockFastify as FastifyInstance);
    });

    it('should register list categories route', async () => {
      await listCategories(mockFastify as FastifyInstance);
      expect(mockFastify.get).toHaveBeenCalledWith('/mcp/categories', expect.any(Object), expect.any(Function));
    });

    it('should successfully list all categories', async () => {
      const mockCategories = [
        {
          id: 'cat-1',
          name: 'Development Tools',
          description: 'Tools for software development',
          icon: 'code',
          sort_order: 1,
          server_count: 5,
          created_at: new Date('2024-01-01T00:00:00Z'),
        },
        {
          id: 'cat-2',
          name: 'Data Analysis',
          description: 'Tools for data analysis and visualization',
          icon: 'chart',
          sort_order: 2,
          server_count: 3,
          created_at: new Date('2024-01-02T00:00:00Z'),
        },
      ];

      mockService.getAllCategoriesWithServerCount.mockResolvedValue(mockCategories);

      const handler = routeHandlers['GET /mcp/categories'];
      await handler(mockRequest, mockReply);

      expect(mockService.getAllCategoriesWithServerCount).toHaveBeenCalled();
      expect(mockReply.send).toHaveBeenCalledWith(
        JSON.stringify({
          success: true,
          data: [
            {
              id: 'cat-1',
              name: 'Development Tools',
              description: 'Tools for software development',
              icon: 'code',
              sort_order: 1,
              server_count: 5,
              created_at: '2024-01-01T00:00:00.000Z',
            },
            {
              id: 'cat-2',
              name: 'Data Analysis',
              description: 'Tools for data analysis and visualization',
              icon: 'chart',
              sort_order: 2,
              server_count: 3,
              created_at: '2024-01-02T00:00:00.000Z',
            },
          ],
        })
      );
    });

    it('should return empty array when no categories exist', async () => {
      mockService.getAllCategoriesWithServerCount.mockResolvedValue([]);

      const handler = routeHandlers['GET /mcp/categories'];
      await handler(mockRequest, mockReply);

      expect(mockService.getAllCategoriesWithServerCount).toHaveBeenCalled();
      expect(mockReply.send).toHaveBeenCalledWith(
        JSON.stringify({
          success: true,
          data: [],
        })
      );
    });

    it('should handle service errors gracefully', async () => {
      const error = new Error('Database connection failed');
      mockService.getAllCategoriesWithServerCount.mockRejectedValue(error);

      const handler = routeHandlers['GET /mcp/categories'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.error).toHaveBeenCalledWith({
        operation: 'list_categories',
        error,
      }, 'Failed to list MCP categories');
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith(
        JSON.stringify({
          success: false,
          error: 'Failed to retrieve categories',
        })
      );
    });

    it('should handle categories with null values correctly', async () => {
      const mockCategories = [
        {
          id: 'cat-1',
          name: 'Development Tools',
          description: null,
          icon: null,
          sort_order: 1,
          server_count: 0,
          created_at: new Date('2024-01-01T00:00:00Z'),
        },
      ];

      mockService.getAllCategoriesWithServerCount.mockResolvedValue(mockCategories);

      const handler = routeHandlers['GET /mcp/categories'];
      await handler(mockRequest, mockReply);

      expect(mockReply.send).toHaveBeenCalledWith(
        JSON.stringify({
          success: true,
          data: [
            {
              id: 'cat-1',
              name: 'Development Tools',
              description: null,
              icon: null,
              sort_order: 1,
              server_count: 0,
              created_at: '2024-01-01T00:00:00.000Z',
            },
          ],
        })
      );
    });
  });

  // ========================
  // CREATE CATEGORY TESTS
  // ========================
  describe('Create Category Route (POST /mcp/categories)', () => {
    beforeEach(async () => {
      await createCategory(mockFastify as FastifyInstance);
    });

    it('should register create category route', async () => {
      await createCategory(mockFastify as FastifyInstance);
      expect(mockFastify.post).toHaveBeenCalledWith('/mcp/categories', expect.any(Object), expect.any(Function));
    });

    it('should successfully create a new category', async () => {
      const newCategory = {
        id: 'cat-new',
        name: 'Test Category',
        description: 'Test description',
        icon: 'test-icon',
        sort_order: 1,
        created_at: new Date('2024-01-01T00:00:00Z'),
      };

      mockService.createCategory.mockResolvedValue(newCategory);

      const mockRequestWithBody = {
        ...mockRequest,
        body: {
          name: 'Test Category',
          description: 'Test description',
          icon: 'test-icon',
          sort_order: 1
        },
        user: { id: 'test-user' },
        log: mockFastify.log
      };

      const handler = routeHandlers['POST /mcp/categories'];
      await handler(mockRequestWithBody, mockReply);

      expect(mockService.createCategory).toHaveBeenCalledWith({
        name: 'Test Category',
        description: 'Test description',
        icon: 'test-icon',
        sort_order: 1
      });
      expect(mockReply.status).toHaveBeenCalledWith(201);
      expect(mockReply.send).toHaveBeenCalledWith(
        JSON.stringify({
          success: true,
          data: {
            id: 'cat-new',
            name: 'Test Category',
            description: 'Test description',
            icon: 'test-icon',
            sort_order: 1,
            server_count: 0,
            created_at: '2024-01-01T00:00:00.000Z',
          }
        })
      );
    });

    it('should handle duplicate category name error', async () => {
      const error = new Error('UNIQUE constraint failed');
      mockService.createCategory.mockRejectedValue(error);

      const mockRequestWithBody = {
        ...mockRequest,
        body: { name: 'Duplicate Category' },
        user: { id: 'test-user' },
        log: mockFastify.log
      };
      
      const handler = routeHandlers['POST /mcp/categories'];
      await handler(mockRequestWithBody, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(409);
      expect(mockReply.send).toHaveBeenCalledWith(
        JSON.stringify({
          success: false,
          error: 'Category name already exists',
        })
      );
    });

    it('should handle general errors', async () => {
      const error = new Error('Database error');
      mockService.createCategory.mockRejectedValue(error);

      const mockRequestWithBody = {
        ...mockRequest,
        body: { name: 'Test Category' },
        user: { id: 'test-user' },
        log: mockFastify.log
      };
      
      const handler = routeHandlers['POST /mcp/categories'];
      await handler(mockRequestWithBody, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith(
        JSON.stringify({
          success: false,
          error: 'Failed to create category',
        })
      );
    });

    it('should have correct route schema', async () => {
      expect(mockFastify.post).toHaveBeenCalledWith(
        '/mcp/categories',
        expect.objectContaining({
          schema: expect.objectContaining({
            tags: ['MCP Categories'],
            summary: 'Create MCP category (Admin only)',
            description: expect.stringContaining('Create a new MCP server category'),
          }),
        }),
        expect.any(Function)
      );
    });
  });

  // ========================
  // UPDATE CATEGORY TESTS
  // ========================
  describe('Update Category Route (PUT /mcp/categories/:id)', () => {
    beforeEach(async () => {
      await updateCategory(mockFastify as FastifyInstance);
    });

    it('should register update category route', async () => {
      await updateCategory(mockFastify as FastifyInstance);
      expect(mockFastify.put).toHaveBeenCalledWith('/mcp/categories/:id', expect.any(Object), expect.any(Function));
    });

    it('should successfully update a category', async () => {
      const updatedCategory = {
        id: 'cat-1',
        name: 'Updated Category',
        description: 'Updated description',
        icon: 'updated-icon',
        sort_order: 2,
        created_at: new Date('2024-01-01T00:00:00Z'),
      };

      mockService.updateCategory.mockResolvedValue(updatedCategory);

      const mockRequestWithParams = {
        ...mockRequest,
        params: { id: 'cat-1' },
        body: {
          name: 'Updated Category',
          description: 'Updated description',
          icon: 'updated-icon',
          sort_order: 2
        },
        user: { id: 'test-user' },
        log: mockFastify.log
      };

      const handler = routeHandlers['PUT /mcp/categories/:id'];
      await handler(mockRequestWithParams, mockReply);

      expect(mockService.updateCategory).toHaveBeenCalledWith('cat-1', {
        name: 'Updated Category',
        description: 'Updated description',
        icon: 'updated-icon',
        sort_order: 2
      });
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith(
        JSON.stringify({
          success: true,
          data: {
            id: 'cat-1',
            name: 'Updated Category',
            description: 'Updated description',
            icon: 'updated-icon',
            sort_order: 2,
            server_count: 0,
            created_at: '2024-01-01T00:00:00.000Z',
          }
        })
      );
    });

    it('should handle category not found', async () => {
      mockService.updateCategory.mockResolvedValue(null);

      const mockRequestWithParams = {
        ...mockRequest,
        params: { id: 'non-existent' },
        body: { name: 'Updated Category' },
        user: { id: 'test-user' },
        log: mockFastify.log
      };
      
      const handler = routeHandlers['PUT /mcp/categories/:id'];
      await handler(mockRequestWithParams, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith(
        JSON.stringify({
          success: false,
          error: 'Category not found',
        })
      );
    });

    it('should handle duplicate name error', async () => {
      const error = new Error('UNIQUE constraint failed');
      mockService.updateCategory.mockRejectedValue(error);

      const mockRequestWithParams = {
        ...mockRequest,
        params: { id: 'cat-1' },
        body: { name: 'Duplicate Name' },
        user: { id: 'test-user' },
        log: mockFastify.log
      };
      
      const handler = routeHandlers['PUT /mcp/categories/:id'];
      await handler(mockRequestWithParams, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(409);
      expect(mockReply.send).toHaveBeenCalledWith(
        JSON.stringify({
          success: false,
          error: 'Category name already exists',
        })
      );
    });

    it('should have correct route schema', async () => {
      expect(mockFastify.put).toHaveBeenCalledWith(
        '/mcp/categories/:id',
        expect.objectContaining({
          schema: expect.objectContaining({
            tags: ['MCP Categories'],
            summary: 'Update MCP category (Admin only)',
            description: expect.stringContaining('Update an existing MCP server category'),
          }),
        }),
        expect.any(Function)
      );
    });
  });

  // ========================
  // DELETE CATEGORY TESTS
  // ========================
  describe('Delete Category Route (DELETE /mcp/categories/:id)', () => {
    beforeEach(async () => {
      await deleteCategory(mockFastify as FastifyInstance);
    });

    it('should register delete category route', async () => {
      await deleteCategory(mockFastify as FastifyInstance);
      expect(mockFastify.delete).toHaveBeenCalledWith('/mcp/categories/:id', expect.any(Object), expect.any(Function));
    });

    it('should successfully delete a category', async () => {
      mockService.deleteCategory.mockResolvedValue(true);

      const mockRequestWithParams = {
        ...mockRequest,
        params: { id: 'cat-1' },
        user: { id: 'test-user' },
        log: mockFastify.log
      };
      
      const handler = routeHandlers['DELETE /mcp/categories/:id'];
      await handler(mockRequestWithParams, mockReply);

      expect(mockService.deleteCategory).toHaveBeenCalledWith('cat-1');
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith(
        JSON.stringify({
          success: true,
          message: 'Category deleted successfully',
        })
      );
    });

    it('should handle category not found', async () => {
      mockService.deleteCategory.mockResolvedValue(false);

      const mockRequestWithParams = {
        ...mockRequest,
        params: { id: 'non-existent' },
        user: { id: 'test-user' },
        log: mockFastify.log
      };
      
      const handler = routeHandlers['DELETE /mcp/categories/:id'];
      await handler(mockRequestWithParams, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith(
        JSON.stringify({
          success: false,
          error: 'Category not found',
        })
      );
    });

    it('should handle general errors', async () => {
      const error = new Error('Database error');
      mockService.deleteCategory.mockRejectedValue(error);

      const mockRequestWithParams = {
        ...mockRequest,
        params: { id: 'cat-1' },
        user: { id: 'test-user' },
        log: mockFastify.log
      };
      
      const handler = routeHandlers['DELETE /mcp/categories/:id'];
      await handler(mockRequestWithParams, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith(
        JSON.stringify({
          success: false,
          error: 'Failed to delete category',
        })
      );
    });

    it('should have correct route schema', async () => {
      expect(mockFastify.delete).toHaveBeenCalledWith(
        '/mcp/categories/:id',
        expect.objectContaining({
          schema: expect.objectContaining({
            tags: ['MCP Categories'],
            summary: 'Delete MCP category (Admin only)',
            description: expect.stringContaining('Delete an MCP server category'),
          }),
        }),
        expect.any(Function)
      );
    });
  });
});
