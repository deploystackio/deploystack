import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import type { FastifyInstance } from 'fastify';
import mcpRoutes from '../../../../src/routes/mcp/index';

// Mock all the route modules
vi.mock('../../../../src/routes/mcp/categories/list');
vi.mock('../../../../src/routes/mcp/categories/create');
vi.mock('../../../../src/routes/mcp/categories/update');
vi.mock('../../../../src/routes/mcp/categories/delete');

vi.mock('../../../../src/routes/mcp/servers/list');
vi.mock('../../../../src/routes/mcp/servers/get');
vi.mock('../../../../src/routes/mcp/servers/search');
vi.mock('../../../../src/routes/mcp/servers/tags');
vi.mock('../../../../src/routes/mcp/servers/languages');
vi.mock('../../../../src/routes/mcp/servers/runtimes');
vi.mock('../../../../src/routes/mcp/servers/create-global');
vi.mock('../../../../src/routes/mcp/servers/update-global');
vi.mock('../../../../src/routes/mcp/servers/delete-global');

vi.mock('../../../../src/routes/mcp/teams/list-servers');
vi.mock('../../../../src/routes/mcp/teams/create-server');
vi.mock('../../../../src/routes/mcp/teams/update-server');
vi.mock('../../../../src/routes/mcp/teams/delete-server');

vi.mock('../../../../src/routes/mcp/versions/list');
vi.mock('../../../../src/routes/mcp/versions/create');
vi.mock('../../../../src/routes/mcp/versions/update');

vi.mock('../../../../src/routes/mcp/github/get-repo-info');

vi.mock('../../../../src/routes/mcp/installations');
vi.mock('../../../../src/routes/mcp/user-configurations');

// Import mocked modules
import listCategories from '../../../../src/routes/mcp/categories/list';
import createCategory from '../../../../src/routes/mcp/categories/create';
import updateCategory from '../../../../src/routes/mcp/categories/update';
import deleteCategory from '../../../../src/routes/mcp/categories/delete';

import listServers from '../../../../src/routes/mcp/servers/list';
import getServer from '../../../../src/routes/mcp/servers/get';
import searchServers from '../../../../src/routes/mcp/servers/search';
import getTags from '../../../../src/routes/mcp/servers/tags';
import getLanguages from '../../../../src/routes/mcp/servers/languages';
import getRuntimes from '../../../../src/routes/mcp/servers/runtimes';
import createGlobalServer from '../../../../src/routes/mcp/servers/create-global';
import updateGlobalServer from '../../../../src/routes/mcp/servers/update-global';
import deleteGlobalServer from '../../../../src/routes/mcp/servers/delete-global';

import listTeamServers from '../../../../src/routes/mcp/teams/list-servers';
import createTeamServer from '../../../../src/routes/mcp/teams/create-server';
import updateTeamServer from '../../../../src/routes/mcp/teams/update-server';
import deleteTeamServer from '../../../../src/routes/mcp/teams/delete-server';

import listVersions from '../../../../src/routes/mcp/versions/list';
import createVersion from '../../../../src/routes/mcp/versions/create';
import updateVersion from '../../../../src/routes/mcp/versions/update';

import getRepoInfo from '../../../../src/routes/mcp/github/get-repo-info';

import installationsRoutes from '../../../../src/routes/mcp/installations';
import userConfigurationsRoutes from '../../../../src/routes/mcp/user-configurations';

// Type the mocked functions
const mockListCategories = listCategories as MockedFunction<typeof listCategories>;
const mockCreateCategory = createCategory as MockedFunction<typeof createCategory>;
const mockUpdateCategory = updateCategory as MockedFunction<typeof updateCategory>;
const mockDeleteCategory = deleteCategory as MockedFunction<typeof deleteCategory>;

const mockListServers = listServers as MockedFunction<typeof listServers>;
const mockGetServer = getServer as MockedFunction<typeof getServer>;
const mockSearchServers = searchServers as MockedFunction<typeof searchServers>;
const mockGetTags = getTags as MockedFunction<typeof getTags>;
const mockGetLanguages = getLanguages as MockedFunction<typeof getLanguages>;
const mockGetRuntimes = getRuntimes as MockedFunction<typeof getRuntimes>;
const mockCreateGlobalServer = createGlobalServer as MockedFunction<typeof createGlobalServer>;
const mockUpdateGlobalServer = updateGlobalServer as MockedFunction<typeof updateGlobalServer>;
const mockDeleteGlobalServer = deleteGlobalServer as MockedFunction<typeof deleteGlobalServer>;

const mockListTeamServers = listTeamServers as MockedFunction<typeof listTeamServers>;
const mockCreateTeamServer = createTeamServer as MockedFunction<typeof createTeamServer>;
const mockUpdateTeamServer = updateTeamServer as MockedFunction<typeof updateTeamServer>;
const mockDeleteTeamServer = deleteTeamServer as MockedFunction<typeof deleteTeamServer>;

const mockListVersions = listVersions as MockedFunction<typeof listVersions>;
const mockCreateVersion = createVersion as MockedFunction<typeof createVersion>;
const mockUpdateVersion = updateVersion as MockedFunction<typeof updateVersion>;

const mockGetRepoInfo = getRepoInfo as MockedFunction<typeof getRepoInfo>;

const mockInstallationsRoutes = installationsRoutes as MockedFunction<typeof installationsRoutes>;
const mockUserConfigurationsRoutes = userConfigurationsRoutes as MockedFunction<typeof userConfigurationsRoutes>;

describe('MCP Routes Registration', () => {
  let mockFastify: Partial<FastifyInstance>;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup mock Fastify instance
    mockFastify = {
      register: vi.fn().mockResolvedValue(undefined),
      log: {
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
      },
    } as any;

    // Mock all route modules to return resolved promises
    mockListCategories.mockResolvedValue(undefined);
    mockCreateCategory.mockResolvedValue(undefined);
    mockUpdateCategory.mockResolvedValue(undefined);
    mockDeleteCategory.mockResolvedValue(undefined);

    mockListServers.mockResolvedValue(undefined);
    mockGetServer.mockResolvedValue(undefined);
    mockSearchServers.mockResolvedValue(undefined);
    mockGetTags.mockResolvedValue(undefined);
    mockGetLanguages.mockResolvedValue(undefined);
    mockGetRuntimes.mockResolvedValue(undefined);
    mockCreateGlobalServer.mockResolvedValue(undefined);
    mockUpdateGlobalServer.mockResolvedValue(undefined);
    mockDeleteGlobalServer.mockResolvedValue(undefined);

    mockListTeamServers.mockResolvedValue(undefined);
    mockCreateTeamServer.mockResolvedValue(undefined);
    mockUpdateTeamServer.mockResolvedValue(undefined);
    mockDeleteTeamServer.mockResolvedValue(undefined);

    mockListVersions.mockResolvedValue(undefined);
    mockCreateVersion.mockResolvedValue(undefined);
    mockUpdateVersion.mockResolvedValue(undefined);

    mockGetRepoInfo.mockResolvedValue(undefined);

    mockInstallationsRoutes.mockResolvedValue(undefined);
    mockUserConfigurationsRoutes.mockResolvedValue(undefined);
  });

  describe('Route Registration', () => {
    it('should register all MCP route modules', async () => {
      await mcpRoutes(mockFastify as FastifyInstance);

      // Verify that all 23 routes are registered
      expect(mockFastify.register).toHaveBeenCalledTimes(23);
    });

    it('should register all category routes', async () => {
      await mcpRoutes(mockFastify as FastifyInstance);

      expect(mockFastify.register).toHaveBeenCalledWith(listCategories);
      expect(mockFastify.register).toHaveBeenCalledWith(createCategory);
      expect(mockFastify.register).toHaveBeenCalledWith(updateCategory);
      expect(mockFastify.register).toHaveBeenCalledWith(deleteCategory);
    });

    it('should register all server routes', async () => {
      await mcpRoutes(mockFastify as FastifyInstance);

      expect(mockFastify.register).toHaveBeenCalledWith(listServers);
      expect(mockFastify.register).toHaveBeenCalledWith(getServer);
      expect(mockFastify.register).toHaveBeenCalledWith(searchServers);
      expect(mockFastify.register).toHaveBeenCalledWith(getTags);
      expect(mockFastify.register).toHaveBeenCalledWith(getLanguages);
      expect(mockFastify.register).toHaveBeenCalledWith(getRuntimes);
    });

    it('should register all global server management routes', async () => {
      await mcpRoutes(mockFastify as FastifyInstance);

      expect(mockFastify.register).toHaveBeenCalledWith(createGlobalServer);
      expect(mockFastify.register).toHaveBeenCalledWith(updateGlobalServer);
      expect(mockFastify.register).toHaveBeenCalledWith(deleteGlobalServer);
    });

    it('should register all team server management routes', async () => {
      await mcpRoutes(mockFastify as FastifyInstance);

      expect(mockFastify.register).toHaveBeenCalledWith(listTeamServers);
      expect(mockFastify.register).toHaveBeenCalledWith(createTeamServer);
      expect(mockFastify.register).toHaveBeenCalledWith(updateTeamServer);
      expect(mockFastify.register).toHaveBeenCalledWith(deleteTeamServer);
    });

    it('should register all version management routes', async () => {
      await mcpRoutes(mockFastify as FastifyInstance);

      expect(mockFastify.register).toHaveBeenCalledWith(listVersions);
      expect(mockFastify.register).toHaveBeenCalledWith(createVersion);
      expect(mockFastify.register).toHaveBeenCalledWith(updateVersion);
    });

    it('should register all GitHub integration routes', async () => {
      await mcpRoutes(mockFastify as FastifyInstance);

      expect(mockFastify.register).toHaveBeenCalledWith(getRepoInfo);
    });

    it('should register installations routes', async () => {
      await mcpRoutes(mockFastify as FastifyInstance);

      expect(mockFastify.register).toHaveBeenCalledWith(installationsRoutes);
    });

    it('should register user configurations routes', async () => {
      await mcpRoutes(mockFastify as FastifyInstance);

      expect(mockFastify.register).toHaveBeenCalledWith(userConfigurationsRoutes);
    });
  });

  describe('Route Registration Order', () => {
    it('should register category routes first', async () => {
      await mcpRoutes(mockFastify as FastifyInstance);

      const registerCalls = (mockFastify.register as any).mock.calls;
      
      // Check that category routes are registered first (positions 0-3)
      expect(registerCalls[0][0]).toBe(listCategories);
      expect(registerCalls[1][0]).toBe(createCategory);
      expect(registerCalls[2][0]).toBe(updateCategory);
      expect(registerCalls[3][0]).toBe(deleteCategory);
    });

    it('should register server routes after categories', async () => {
      await mcpRoutes(mockFastify as FastifyInstance);

      const registerCalls = (mockFastify.register as any).mock.calls;
      
      // Check that server routes are in positions 4-9
      expect(registerCalls[4][0]).toBe(listServers);
      expect(registerCalls[5][0]).toBe(getServer);
      expect(registerCalls[6][0]).toBe(searchServers);
      expect(registerCalls[7][0]).toBe(getTags);
      expect(registerCalls[8][0]).toBe(getLanguages);
      expect(registerCalls[9][0]).toBe(getRuntimes);
    });

    it('should register global server management routes correctly', async () => {
      await mcpRoutes(mockFastify as FastifyInstance);

      const registerCalls = (mockFastify.register as any).mock.calls;
      
      // Check that global server management routes are in positions 10-12
      expect(registerCalls[10][0]).toBe(createGlobalServer);
      expect(registerCalls[11][0]).toBe(updateGlobalServer);
      expect(registerCalls[12][0]).toBe(deleteGlobalServer);
    });

    it('should register team server management routes correctly', async () => {
      await mcpRoutes(mockFastify as FastifyInstance);

      const registerCalls = (mockFastify.register as any).mock.calls;
      
      // Check that team server management routes are in positions 13-16
      expect(registerCalls[13][0]).toBe(listTeamServers);
      expect(registerCalls[14][0]).toBe(createTeamServer);
      expect(registerCalls[15][0]).toBe(updateTeamServer);
      expect(registerCalls[16][0]).toBe(deleteTeamServer);
    });

    it('should register version management routes correctly', async () => {
      await mcpRoutes(mockFastify as FastifyInstance);

      const registerCalls = (mockFastify.register as any).mock.calls;
      
      // Check that version management routes are in positions 17-19
      expect(registerCalls[17][0]).toBe(listVersions);
      expect(registerCalls[18][0]).toBe(createVersion);
      expect(registerCalls[19][0]).toBe(updateVersion);
    });

    it('should register GitHub integration routes correctly', async () => {
      await mcpRoutes(mockFastify as FastifyInstance);

      const registerCalls = (mockFastify.register as any).mock.calls;
      
      // Check that GitHub route is at position 20
      expect(registerCalls[20][0]).toBe(getRepoInfo);
    });

    it('should register installations routes correctly', async () => {
      await mcpRoutes(mockFastify as FastifyInstance);

      const registerCalls = (mockFastify.register as any).mock.calls;
      
      // Check that installations route is at position 21
      expect(registerCalls[21][0]).toBe(installationsRoutes);
    });

    it('should register user configurations routes last', async () => {
      await mcpRoutes(mockFastify as FastifyInstance);

      const registerCalls = (mockFastify.register as any).mock.calls;
      
      // Check that user configurations route is at position 22 (last)
      expect(registerCalls[22][0]).toBe(userConfigurationsRoutes);
    });
  });

  describe('Error Handling', () => {
    it('should handle registration errors gracefully', async () => {
      // Make the fastify register method throw an error
      mockFastify.register = vi.fn().mockRejectedValueOnce(new Error('Registration failed'));

      // The function should reject with the error
      await expect(mcpRoutes(mockFastify as FastifyInstance)).rejects.toThrow('Registration failed');
      
      // Verify that register was attempted
      expect(mockFastify.register).toHaveBeenCalled();
    });

    it('should handle undefined fastify instance', async () => {
      await expect(mcpRoutes(undefined as any)).rejects.toThrow();
    });

    it('should handle fastify instance without register method', async () => {
      const invalidFastify = {} as FastifyInstance;
      await expect(mcpRoutes(invalidFastify)).rejects.toThrow();
    });
  });

  describe('Module Integration', () => {
    it('should properly import and use all route modules', () => {
      // Verify that all modules are properly imported and mocked
      expect(listCategories).toBeDefined();
      expect(createCategory).toBeDefined();
      expect(updateCategory).toBeDefined();
      expect(deleteCategory).toBeDefined();

      expect(listServers).toBeDefined();
      expect(getServer).toBeDefined();
      expect(searchServers).toBeDefined();
      expect(getTags).toBeDefined();
      expect(getLanguages).toBeDefined();
      expect(getRuntimes).toBeDefined();
      expect(createGlobalServer).toBeDefined();
      expect(updateGlobalServer).toBeDefined();
      expect(deleteGlobalServer).toBeDefined();

      expect(listTeamServers).toBeDefined();
      expect(createTeamServer).toBeDefined();
      expect(updateTeamServer).toBeDefined();
      expect(deleteTeamServer).toBeDefined();

      expect(listVersions).toBeDefined();
      expect(createVersion).toBeDefined();
      expect(updateVersion).toBeDefined();

      expect(getRepoInfo).toBeDefined();

      expect(installationsRoutes).toBeDefined();
      expect(userConfigurationsRoutes).toBeDefined();
    });

    it('should call each route module with the fastify instance', async () => {
      await mcpRoutes(mockFastify as FastifyInstance);

      // Verify each module was called with the correct fastify instance
      const registerCalls = (mockFastify.register as any).mock.calls;
      
      registerCalls.forEach((call: any) => {
        expect(call).toHaveLength(1); // Only the route function should be passed
        expect(typeof call[0]).toBe('function');
      });
    });
  });

  describe('Route Function Signatures', () => {
    it('should export a default function', () => {
      expect(typeof mcpRoutes).toBe('function');
      expect(mcpRoutes.name).toBe('mcpRoutes');
    });

    it('should be an async function', () => {
      expect(mcpRoutes.constructor.name).toBe('AsyncFunction');
    });

    it('should accept a FastifyInstance parameter', async () => {
      // This test verifies the function signature is correct
      await expect(mcpRoutes(mockFastify as FastifyInstance)).resolves.toBeUndefined();
    });
  });
});
