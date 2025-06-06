import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import globalSettingsRoute from '../../../../src/routes/globalSettings/index';
import { GlobalSettingsService } from '../../../../src/services/globalSettingsService';
import { validateEncryption } from '../../../../src/utils/encryption';
import { requireGlobalAdmin } from '../../../../src/middleware/roleMiddleware';

// Mock dependencies
vi.mock('../../../../src/services/globalSettingsService');
vi.mock('../../../../src/utils/encryption');
vi.mock('../../../../src/middleware/roleMiddleware');

// Type the mocked functions
const MockedGlobalSettingsService = GlobalSettingsService as any;
const mockValidateEncryption = validateEncryption as MockedFunction<typeof validateEncryption>;
const mockRequireGlobalAdmin = requireGlobalAdmin as MockedFunction<typeof requireGlobalAdmin>;

describe('Global Settings Route', () => {
  let mockFastify: Partial<FastifyInstance>;
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  let routeHandlers: Record<string, any>;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup mock GlobalSettingsService
    MockedGlobalSettingsService.getAllGroupsWithSettings = vi.fn();
    MockedGlobalSettingsService.getAll = vi.fn();
    MockedGlobalSettingsService.get = vi.fn();
    MockedGlobalSettingsService.exists = vi.fn();
    MockedGlobalSettingsService.setTyped = vi.fn();
    MockedGlobalSettingsService.update = vi.fn();
    MockedGlobalSettingsService.delete = vi.fn();
    MockedGlobalSettingsService.getByGroup = vi.fn();
    MockedGlobalSettingsService.getCategories = vi.fn();
    MockedGlobalSettingsService.search = vi.fn();

    // Setup mock middleware
    mockRequireGlobalAdmin.mockReturnValue(vi.fn());

    // Setup mock encryption
    mockValidateEncryption.mockReturnValue(true);

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
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
      },
    } as any;

    // Setup mock request
    mockRequest = {
      params: {},
      body: {},
      user: {
        id: 'admin-user-123',
        username: 'admin',
        email: 'admin@example.com',
      } as any,
      session: {
        id: 'session-123',
      } as any,
    };

    // Setup mock reply
    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  describe('Route Registration', () => {
    it('should register all global settings routes', async () => {
      await globalSettingsRoute(mockFastify as FastifyInstance);

      expect(mockFastify.get).toHaveBeenCalledWith('/api/settings/groups', expect.any(Object), expect.any(Function));
      expect(mockFastify.get).toHaveBeenCalledWith('/api/settings', expect.any(Object), expect.any(Function));
      expect(mockFastify.get).toHaveBeenCalledWith('/api/settings/:key', expect.any(Object), expect.any(Function));
      expect(mockFastify.post).toHaveBeenCalledWith('/api/settings', expect.any(Object), expect.any(Function));
      expect(mockFastify.put).toHaveBeenCalledWith('/api/settings/:key', expect.any(Object), expect.any(Function));
      expect(mockFastify.delete).toHaveBeenCalledWith('/api/settings/:key', expect.any(Object), expect.any(Function));
      expect(mockFastify.get).toHaveBeenCalledWith('/api/settings/group/:groupId', expect.any(Object), expect.any(Function));
      expect(mockFastify.get).toHaveBeenCalledWith('/api/settings/categories', expect.any(Object), expect.any(Function));
      expect(mockFastify.post).toHaveBeenCalledWith('/api/settings/search', expect.any(Object), expect.any(Function));
      expect(mockFastify.post).toHaveBeenCalledWith('/api/settings/bulk', expect.any(Object), expect.any(Function));
      expect(mockFastify.get).toHaveBeenCalledWith('/api/settings/health', expect.any(Object), expect.any(Function));
    });

    it('should configure middleware correctly', async () => {
      await globalSettingsRoute(mockFastify as FastifyInstance);

      expect(mockRequireGlobalAdmin).toHaveBeenCalled();
    });
  });

  describe('GET /api/settings/groups', () => {
    beforeEach(async () => {
      await globalSettingsRoute(mockFastify as FastifyInstance);
    });

    it('should return all groups with settings successfully', async () => {
      const mockGroups = [
        {
          id: 'group-1',
          name: 'General',
          description: 'General settings',
          settings: [
            { key: 'app.name', value: 'MyApp', type: 'string' },
          ],
        },
      ];
      MockedGlobalSettingsService.getAllGroupsWithSettings.mockResolvedValue(mockGroups);

      const handler = routeHandlers['GET /api/settings/groups'];
      await handler(mockRequest, mockReply);

      expect(MockedGlobalSettingsService.getAllGroupsWithSettings).toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: mockGroups,
      });
    });

    it('should handle service errors', async () => {
      const error = new Error('Database error');
      MockedGlobalSettingsService.getAllGroupsWithSettings.mockRejectedValue(error);

      const handler = routeHandlers['GET /api/settings/groups'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.error).toHaveBeenCalledWith(error, 'Error fetching all global setting groups with settings');
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to fetch all global setting groups with settings',
      });
    });
  });

  describe('GET /api/settings', () => {
    beforeEach(async () => {
      await globalSettingsRoute(mockFastify as FastifyInstance);
    });

    it('should return all settings successfully', async () => {
      const mockSettings = [
        { key: 'app.name', value: 'MyApp', type: 'string' },
        { key: 'app.version', value: '1.0.0', type: 'string' },
      ];
      MockedGlobalSettingsService.getAll.mockResolvedValue(mockSettings);

      const handler = routeHandlers['GET /api/settings'];
      await handler(mockRequest, mockReply);

      expect(MockedGlobalSettingsService.getAll).toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: mockSettings,
      });
    });

    it('should handle service errors', async () => {
      const error = new Error('Database error');
      MockedGlobalSettingsService.getAll.mockRejectedValue(error);

      const handler = routeHandlers['GET /api/settings'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.error).toHaveBeenCalledWith(error, 'Error fetching global settings');
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to fetch global settings',
      });
    });
  });

  describe('GET /api/settings/:key', () => {
    beforeEach(async () => {
      await globalSettingsRoute(mockFastify as FastifyInstance);
    });

    it('should return setting by key successfully', async () => {
      const mockSetting = { key: 'app.name', value: 'MyApp', type: 'string' };
      mockRequest.params = { key: 'app.name' };
      MockedGlobalSettingsService.get.mockResolvedValue(mockSetting);

      const handler = routeHandlers['GET /api/settings/:key'];
      await handler(mockRequest, mockReply);

      expect(MockedGlobalSettingsService.get).toHaveBeenCalledWith('app.name');
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: mockSetting,
      });
    });

    it('should return 404 when setting not found', async () => {
      mockRequest.params = { key: 'nonexistent' };
      MockedGlobalSettingsService.get.mockResolvedValue(null);

      const handler = routeHandlers['GET /api/settings/:key'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Setting not found',
      });
    });

    it('should handle service errors', async () => {
      const error = new Error('Database error');
      mockRequest.params = { key: 'app.name' };
      MockedGlobalSettingsService.get.mockRejectedValue(error);

      const handler = routeHandlers['GET /api/settings/:key'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.error).toHaveBeenCalledWith(error, 'Error fetching global setting');
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to fetch global setting',
      });
    });
  });

  describe('POST /api/settings', () => {
    beforeEach(async () => {
      await globalSettingsRoute(mockFastify as FastifyInstance);
    });

    it('should create new setting successfully', async () => {
      const settingData = {
        key: 'new.setting',
        value: 'test value',
        type: 'string' as const,
        description: 'Test setting',
        encrypted: false,
      };
      const createdSetting = { ...settingData, created_at: new Date(), updated_at: new Date() };
      
      mockRequest.body = settingData;
      MockedGlobalSettingsService.exists.mockResolvedValue(false);
      MockedGlobalSettingsService.setTyped.mockResolvedValue(createdSetting);

      const handler = routeHandlers['POST /api/settings'];
      await handler(mockRequest, mockReply);

      expect(MockedGlobalSettingsService.exists).toHaveBeenCalledWith('new.setting');
      expect(MockedGlobalSettingsService.setTyped).toHaveBeenCalledWith(
        'new.setting',
        'test value',
        'string',
        {
          description: 'Test setting',
          encrypted: false,
          group_id: undefined,
        }
      );
      expect(mockReply.status).toHaveBeenCalledWith(201);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: createdSetting,
        message: 'Global setting created successfully',
      });
    });

    it('should return 409 when setting already exists', async () => {
      const settingData = {
        key: 'existing.setting',
        value: 'test value',
        type: 'string' as const,
      };
      
      mockRequest.body = settingData;
      MockedGlobalSettingsService.exists.mockResolvedValue(true);

      const handler = routeHandlers['POST /api/settings'];
      await handler(mockRequest, mockReply);

      expect(MockedGlobalSettingsService.setTyped).not.toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(409);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Setting with this key already exists. Use PUT to update.',
      });
    });

    it('should handle validation errors', async () => {
      const zodError = new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'number',
          path: ['key'],
          message: 'Expected string, received number',
        },
      ]);
      
      mockRequest.body = { key: 123 };
      MockedGlobalSettingsService.setTyped.mockRejectedValue(zodError);

      const handler = routeHandlers['POST /api/settings'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Validation error',
        details: zodError.errors,
      });
    });
  });

  describe('PUT /api/settings/:key', () => {
    beforeEach(async () => {
      await globalSettingsRoute(mockFastify as FastifyInstance);
    });

    it('should update setting successfully', async () => {
      const updateData = { value: 'updated value', description: 'Updated description' };
      const updatedSetting = { key: 'app.name', ...updateData, updated_at: new Date() };
      
      mockRequest.params = { key: 'app.name' };
      mockRequest.body = updateData;
      MockedGlobalSettingsService.update.mockResolvedValue(updatedSetting);

      const handler = routeHandlers['PUT /api/settings/:key'];
      await handler(mockRequest, mockReply);

      expect(MockedGlobalSettingsService.update).toHaveBeenCalledWith('app.name', updateData);
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: updatedSetting,
        message: 'Global setting updated successfully',
      });
    });

    it('should return 404 when setting not found', async () => {
      mockRequest.params = { key: 'nonexistent' };
      mockRequest.body = { value: 'new value' };
      MockedGlobalSettingsService.update.mockResolvedValue(null);

      const handler = routeHandlers['PUT /api/settings/:key'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Setting not found',
      });
    });
  });

  describe('DELETE /api/settings/:key', () => {
    beforeEach(async () => {
      await globalSettingsRoute(mockFastify as FastifyInstance);
    });

    it('should delete setting successfully', async () => {
      mockRequest.params = { key: 'app.name' };
      MockedGlobalSettingsService.delete.mockResolvedValue(true);

      const handler = routeHandlers['DELETE /api/settings/:key'];
      await handler(mockRequest, mockReply);

      expect(MockedGlobalSettingsService.delete).toHaveBeenCalledWith('app.name');
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        message: 'Global setting deleted successfully',
      });
    });

    it('should return 404 when setting not found', async () => {
      mockRequest.params = { key: 'nonexistent' };
      MockedGlobalSettingsService.delete.mockResolvedValue(false);

      const handler = routeHandlers['DELETE /api/settings/:key'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Setting not found',
      });
    });
  });

  describe('GET /api/settings/group/:groupId', () => {
    beforeEach(async () => {
      await globalSettingsRoute(mockFastify as FastifyInstance);
    });

    it('should return settings by group successfully', async () => {
      const mockSettings = [
        { key: 'group.setting1', value: 'value1', type: 'string', group_id: 'test-group' },
        { key: 'group.setting2', value: 'value2', type: 'string', group_id: 'test-group' },
      ];
      mockRequest.params = { groupId: 'test-group' };
      MockedGlobalSettingsService.getByGroup.mockResolvedValue(mockSettings);

      const handler = routeHandlers['GET /api/settings/group/:groupId'];
      await handler(mockRequest, mockReply);

      expect(MockedGlobalSettingsService.getByGroup).toHaveBeenCalledWith('test-group');
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: mockSettings,
      });
    });
  });

  describe('GET /api/settings/categories', () => {
    beforeEach(async () => {
      await globalSettingsRoute(mockFastify as FastifyInstance);
    });

    it('should return categories successfully', async () => {
      const mockCategories = ['general', 'security', 'email'];
      MockedGlobalSettingsService.getCategories.mockResolvedValue(mockCategories);

      const handler = routeHandlers['GET /api/settings/categories'];
      await handler(mockRequest, mockReply);

      expect(MockedGlobalSettingsService.getCategories).toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: mockCategories,
      });
    });
  });

  describe('POST /api/settings/search', () => {
    beforeEach(async () => {
      await globalSettingsRoute(mockFastify as FastifyInstance);
    });

    it('should search settings successfully', async () => {
      const mockResults = [
        { key: 'app.name', value: 'MyApp', type: 'string' },
        { key: 'app.version', value: '1.0.0', type: 'string' },
      ];
      mockRequest.body = { pattern: 'app.*' };
      MockedGlobalSettingsService.search.mockResolvedValue(mockResults);

      const handler = routeHandlers['POST /api/settings/search'];
      await handler(mockRequest, mockReply);

      expect(MockedGlobalSettingsService.search).toHaveBeenCalledWith('app.*');
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: mockResults,
      });
    });
  });

  describe('POST /api/settings/bulk', () => {
    beforeEach(async () => {
      await globalSettingsRoute(mockFastify as FastifyInstance);
    });

    it('should process bulk settings successfully', async () => {
      const settingsData = [
        { key: 'bulk.setting1', value: 'value1', type: 'string' as const },
        { key: 'bulk.setting2', value: 'value2', type: 'string' as const },
      ];
      const createdSettings = settingsData.map(s => ({ ...s, created_at: new Date(), updated_at: new Date() }));
      
      mockRequest.body = { settings: settingsData };
      MockedGlobalSettingsService.setTyped
        .mockResolvedValueOnce(createdSettings[0])
        .mockResolvedValueOnce(createdSettings[1]);

      const handler = routeHandlers['POST /api/settings/bulk'];
      await handler(mockRequest, mockReply);

      expect(MockedGlobalSettingsService.setTyped).toHaveBeenCalledTimes(2);
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: createdSettings,
        errors: undefined,
        message: 'Successfully processed 2 settings',
      });
    });

    it('should handle partial failures in bulk operation', async () => {
      const settingsData = [
        { key: 'bulk.setting1', value: 'value1', type: 'string' as const },
        { key: 'bulk.setting2', value: 'value2', type: 'string' as const },
      ];
      const createdSetting = { ...settingsData[0], created_at: new Date(), updated_at: new Date() };
      
      mockRequest.body = { settings: settingsData };
      MockedGlobalSettingsService.setTyped
        .mockResolvedValueOnce(createdSetting)
        .mockRejectedValueOnce(new Error('Validation failed'));

      const handler = routeHandlers['POST /api/settings/bulk'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(207); // Multi-Status
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: [createdSetting],
        errors: [{ key: 'bulk.setting2', error: 'Validation failed' }],
        message: 'Processed 1 settings successfully, 1 failed',
      });
    });
  });

  describe('GET /api/settings/health', () => {
    beforeEach(async () => {
      await globalSettingsRoute(mockFastify as FastifyInstance);
    });

    it('should return healthy status when encryption works', async () => {
      mockValidateEncryption.mockReturnValue(true);

      const handler = routeHandlers['GET /api/settings/health'];
      await handler(mockRequest, mockReply);

      expect(mockValidateEncryption).toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: {
          encryption_working: true,
          timestamp: expect.any(String),
        },
        message: 'Global settings system is healthy',
      });
    });

    it('should return warning when encryption fails', async () => {
      mockValidateEncryption.mockReturnValue(false);

      const handler = routeHandlers['GET /api/settings/health'];
      await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: {
          encryption_working: false,
          timestamp: expect.any(String),
        },
        message: 'Warning: Encryption system is not working properly',
      });
    });

    it('should handle health check errors', async () => {
      const error = new Error('Health check failed');
      mockValidateEncryption.mockImplementation(() => {
        throw error;
      });

      const handler = routeHandlers['GET /api/settings/health'];
      await handler(mockRequest, mockReply);

      expect(mockFastify.log!.error).toHaveBeenCalledWith(error, 'Error checking settings health');
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to check settings health',
      });
    });
  });
});
