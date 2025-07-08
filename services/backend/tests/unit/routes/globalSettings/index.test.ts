import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import type { FastifyInstance } from 'fastify';
import globalSettingsRoute from '../../../../src/routes/globalSettings/index';

// Mock all the route modules
vi.mock('../../../../src/routes/globalSettings/settings/list');
vi.mock('../../../../src/routes/globalSettings/settings/get');
vi.mock('../../../../src/routes/globalSettings/settings/create');
vi.mock('../../../../src/routes/globalSettings/settings/update');
vi.mock('../../../../src/routes/globalSettings/settings/delete');
vi.mock('../../../../src/routes/globalSettings/settings/search');
vi.mock('../../../../src/routes/globalSettings/settings/bulk');
vi.mock('../../../../src/routes/globalSettings/groups/list');
vi.mock('../../../../src/routes/globalSettings/groups/get');
vi.mock('../../../../src/routes/globalSettings/categories/list');
vi.mock('../../../../src/routes/globalSettings/health/check');
vi.mock('../../../../src/routes/globalSettings/github/test-connection');

// Import the mocked modules
import listSettingsRoute from '../../../../src/routes/globalSettings/settings/list';
import getSettingRoute from '../../../../src/routes/globalSettings/settings/get';
import createSettingRoute from '../../../../src/routes/globalSettings/settings/create';
import updateSettingRoute from '../../../../src/routes/globalSettings/settings/update';
import deleteSettingRoute from '../../../../src/routes/globalSettings/settings/delete';
import searchSettingsRoute from '../../../../src/routes/globalSettings/settings/search';
import bulkSettingsRoute from '../../../../src/routes/globalSettings/settings/bulk';
import listGroupsRoute from '../../../../src/routes/globalSettings/groups/list';
import getGroupSettingsRoute from '../../../../src/routes/globalSettings/groups/get';
import listCategoriesRoute from '../../../../src/routes/globalSettings/categories/list';
import healthCheckRoute from '../../../../src/routes/globalSettings/health/check';
import githubTestConnectionRoute from '../../../../src/routes/globalSettings/github/test-connection';

// Type the mocked functions
const mockListSettingsRoute = listSettingsRoute as MockedFunction<typeof listSettingsRoute>;
const mockGetSettingRoute = getSettingRoute as MockedFunction<typeof getSettingRoute>;
const mockCreateSettingRoute = createSettingRoute as MockedFunction<typeof createSettingRoute>;
const mockUpdateSettingRoute = updateSettingRoute as MockedFunction<typeof updateSettingRoute>;
const mockDeleteSettingRoute = deleteSettingRoute as MockedFunction<typeof deleteSettingRoute>;
const mockSearchSettingsRoute = searchSettingsRoute as MockedFunction<typeof searchSettingsRoute>;
const mockBulkSettingsRoute = bulkSettingsRoute as MockedFunction<typeof bulkSettingsRoute>;
const mockListGroupsRoute = listGroupsRoute as MockedFunction<typeof listGroupsRoute>;
const mockGetGroupSettingsRoute = getGroupSettingsRoute as MockedFunction<typeof getGroupSettingsRoute>;
const mockListCategoriesRoute = listCategoriesRoute as MockedFunction<typeof listCategoriesRoute>;
const mockHealthCheckRoute = healthCheckRoute as MockedFunction<typeof healthCheckRoute>;
const mockGithubTestConnectionRoute = githubTestConnectionRoute as MockedFunction<typeof githubTestConnectionRoute>;

describe('Global Settings Index Route', () => {
  let mockFastify: Partial<FastifyInstance>;
  let registerCallHistory: Array<{ plugin: any; callOrder: number }>;
  let callOrder: number;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Reset call tracking
    registerCallHistory = [];
    callOrder = 0;

    // Setup mock Fastify instance
    mockFastify = {
      register: vi.fn().mockImplementation(async (plugin) => {
        callOrder++;
        registerCallHistory.push({ plugin, callOrder });
        return undefined;
      }),
      log: {
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
      },
    } as any;

    // Mock all route modules to return resolved promises
    mockListSettingsRoute.mockResolvedValue(undefined);
    mockGetSettingRoute.mockResolvedValue(undefined);
    mockCreateSettingRoute.mockResolvedValue(undefined);
    mockUpdateSettingRoute.mockResolvedValue(undefined);
    mockDeleteSettingRoute.mockResolvedValue(undefined);
    mockSearchSettingsRoute.mockResolvedValue(undefined);
    mockBulkSettingsRoute.mockResolvedValue(undefined);
    mockListGroupsRoute.mockResolvedValue(undefined);
    mockGetGroupSettingsRoute.mockResolvedValue(undefined);
    mockListCategoriesRoute.mockResolvedValue(undefined);
    mockHealthCheckRoute.mockResolvedValue(undefined);
    mockGithubTestConnectionRoute.mockResolvedValue(undefined);
  });

  describe('Route Registration', () => {
    it('should register all route modules', async () => {
      await globalSettingsRoute(mockFastify as FastifyInstance);

      // Verify that fastify.register was called for each route module
      expect(mockFastify.register).toHaveBeenCalledTimes(12);
      
      // Verify each route module was registered
      expect(mockFastify.register).toHaveBeenCalledWith(listSettingsRoute);
      expect(mockFastify.register).toHaveBeenCalledWith(getSettingRoute);
      expect(mockFastify.register).toHaveBeenCalledWith(createSettingRoute);
      expect(mockFastify.register).toHaveBeenCalledWith(updateSettingRoute);
      expect(mockFastify.register).toHaveBeenCalledWith(deleteSettingRoute);
      expect(mockFastify.register).toHaveBeenCalledWith(searchSettingsRoute);
      expect(mockFastify.register).toHaveBeenCalledWith(bulkSettingsRoute);
      expect(mockFastify.register).toHaveBeenCalledWith(listGroupsRoute);
      expect(mockFastify.register).toHaveBeenCalledWith(getGroupSettingsRoute);
      expect(mockFastify.register).toHaveBeenCalledWith(listCategoriesRoute);
      expect(mockFastify.register).toHaveBeenCalledWith(healthCheckRoute);
      expect(mockFastify.register).toHaveBeenCalledWith(githubTestConnectionRoute);
    });

    it('should register settings routes in correct order', async () => {
      await globalSettingsRoute(mockFastify as FastifyInstance);

      // Verify settings routes are registered in the expected order
      const settingsRoutes = registerCallHistory.slice(0, 7);
      expect(settingsRoutes[0].plugin).toBe(listSettingsRoute);
      expect(settingsRoutes[1].plugin).toBe(getSettingRoute);
      expect(settingsRoutes[2].plugin).toBe(createSettingRoute);
      expect(settingsRoutes[3].plugin).toBe(updateSettingRoute);
      expect(settingsRoutes[4].plugin).toBe(deleteSettingRoute);
      expect(settingsRoutes[5].plugin).toBe(searchSettingsRoute);
      expect(settingsRoutes[6].plugin).toBe(bulkSettingsRoute);
    });

    it('should register groups routes after settings routes', async () => {
      await globalSettingsRoute(mockFastify as FastifyInstance);

      // Verify groups routes are registered in the expected order
      const groupsRoutes = registerCallHistory.slice(7, 9);
      expect(groupsRoutes[0].plugin).toBe(listGroupsRoute);
      expect(groupsRoutes[1].plugin).toBe(getGroupSettingsRoute);
      
      // Verify groups routes come after settings routes
      expect(groupsRoutes[0].callOrder).toBeGreaterThan(registerCallHistory[6].callOrder);
    });

    it('should register categories routes after groups routes', async () => {
      await globalSettingsRoute(mockFastify as FastifyInstance);

      // Verify categories route is registered after groups
      const categoriesRoute = registerCallHistory[9];
      expect(categoriesRoute.plugin).toBe(listCategoriesRoute);
      expect(categoriesRoute.callOrder).toBeGreaterThan(registerCallHistory[8].callOrder);
    });

    it('should register health routes after categories routes', async () => {
      await globalSettingsRoute(mockFastify as FastifyInstance);

      // Verify health route is registered after categories
      const healthRoute = registerCallHistory[10];
      expect(healthRoute.plugin).toBe(healthCheckRoute);
      expect(healthRoute.callOrder).toBeGreaterThan(registerCallHistory[9].callOrder);
    });

    it('should register github routes last', async () => {
      await globalSettingsRoute(mockFastify as FastifyInstance);

      // Verify github route is registered last
      const githubRoute = registerCallHistory[11];
      expect(githubRoute.plugin).toBe(githubTestConnectionRoute);
      expect(githubRoute.callOrder).toBeGreaterThan(registerCallHistory[10].callOrder);
    });

    it('should complete successfully without throwing errors', async () => {
      const result = await globalSettingsRoute(mockFastify as FastifyInstance);
      expect(result).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle errors from individual route registrations', async () => {
      const testError = new Error('Route registration failed');
      
      // Mock fastify.register to reject when called with listSettingsRoute
      (mockFastify.register as any).mockImplementation(async (plugin) => {
        if (plugin === listSettingsRoute) {
          throw testError;
        }
        return undefined;
      });

      await expect(globalSettingsRoute(mockFastify as FastifyInstance)).rejects.toThrow(testError);
    });

    it('should handle errors from middle route registrations', async () => {
      const testError = new Error('Update route registration failed');
      
      // Mock fastify.register to reject when called with updateSettingRoute
      (mockFastify.register as any).mockImplementation(async (plugin) => {
        if (plugin === updateSettingRoute) {
          throw testError;
        }
        return undefined;
      });

      await expect(globalSettingsRoute(mockFastify as FastifyInstance)).rejects.toThrow(testError);
    });

    it('should handle errors from github route registration', async () => {
      const testError = new Error('GitHub route registration failed');
      
      // Mock fastify.register to reject when called with githubTestConnectionRoute
      (mockFastify.register as any).mockImplementation(async (plugin) => {
        if (plugin === githubTestConnectionRoute) {
          throw testError;
        }
        return undefined;
      });

      await expect(globalSettingsRoute(mockFastify as FastifyInstance)).rejects.toThrow(testError);
    });

    it('should handle fastify register errors', async () => {
      const testError = new Error('Fastify register failed');
      (mockFastify.register as any).mockRejectedValue(testError);

      await expect(globalSettingsRoute(mockFastify as FastifyInstance)).rejects.toThrow(testError);
    });
  });

  describe('Route Module Verification', () => {
    it('should call each route module exactly once', async () => {
      await globalSettingsRoute(mockFastify as FastifyInstance);

      // Verify each mock was called once by checking the register calls
      expect(mockFastify.register).toHaveBeenCalledTimes(12);
      
      // Verify each route was registered exactly once
      const registerCalls = (mockFastify.register as any).mock.calls;
      const uniqueRoutes = new Set(registerCalls.map((call: any) => call[0]));
      expect(uniqueRoutes.size).toBe(12);
    });

    it('should pass correct parameters to fastify.register', async () => {
      await globalSettingsRoute(mockFastify as FastifyInstance);

      // Verify register was called with single parameter (the route function)
      const registerCalls = (mockFastify.register as any).mock.calls;
      registerCalls.forEach((call: any) => {
        expect(call).toHaveLength(1);
        expect(typeof call[0]).toBe('function');
      });
    });

    it('should maintain proper async/await chain', async () => {
      const executionOrder: string[] = [];
      
      // Mock to track execution order
      (mockFastify.register as any).mockImplementation(async (plugin) => {
        if (plugin === listSettingsRoute) executionOrder.push('listSettings');
        if (plugin === getSettingRoute) executionOrder.push('getSetting');
        if (plugin === createSettingRoute) executionOrder.push('createSetting');
        if (plugin === updateSettingRoute) executionOrder.push('updateSetting');
        if (plugin === deleteSettingRoute) executionOrder.push('deleteSetting');
        if (plugin === searchSettingsRoute) executionOrder.push('searchSettings');
        if (plugin === bulkSettingsRoute) executionOrder.push('bulkSettings');
        if (plugin === listGroupsRoute) executionOrder.push('listGroups');
        if (plugin === getGroupSettingsRoute) executionOrder.push('getGroupSettings');
        if (plugin === listCategoriesRoute) executionOrder.push('listCategories');
        if (plugin === healthCheckRoute) executionOrder.push('healthCheck');
        if (plugin === githubTestConnectionRoute) executionOrder.push('githubTestConnection');
        return undefined;
      });

      await globalSettingsRoute(mockFastify as FastifyInstance);

      expect(executionOrder).toEqual([
        'listSettings',
        'getSetting',
        'createSetting',
        'updateSetting',
        'deleteSetting',
        'searchSettings',
        'bulkSettings',
        'listGroups',
        'getGroupSettings',
        'listCategories',
        'healthCheck',
        'githubTestConnection'
      ]);
    });
  });

  describe('Plugin Interface Compliance', () => {
    it('should accept FastifyInstance as parameter', () => {
      // This test verifies the function signature is correct
      expect(globalSettingsRoute).toBeInstanceOf(Function);
      expect(globalSettingsRoute).toHaveProperty('length', 1);
    });

    it('should return Promise<void>', async () => {
      const result = await globalSettingsRoute(mockFastify as FastifyInstance);
      expect(result).toBeUndefined();
    });

    it('should work with minimal FastifyInstance interface', async () => {
      const minimalFastify = {
        register: vi.fn().mockResolvedValue(undefined),
      } as any;

      await expect(globalSettingsRoute(minimalFastify)).resolves.toBeUndefined();
      expect(minimalFastify.register).toHaveBeenCalledTimes(12);
    });
  });
});
