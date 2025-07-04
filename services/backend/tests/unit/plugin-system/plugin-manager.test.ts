import { describe, it, expect, vi, beforeEach, afterEach, type Mocked } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import { PluginManager } from '../../../src/plugin-system/plugin-manager';
import { 
  PluginLoadError, 
  PluginDuplicateError, 
  PluginNotFoundError 
} from '../../../src/plugin-system/errors';
import type { 
  Plugin, 
  PluginConfiguration, 
  PluginPackage,
  GlobalSettingDefinitionForPlugin,
  GlobalSettingGroupForPlugin
} from '../../../src/plugin-system/types';
import type { FastifyInstance } from 'fastify';
import type { AnyDatabase } from '../../../src/db';
import { GlobalSettingsService } from '../../../src/services/globalSettingsService';

// Mock modules
vi.mock('node:fs');
vi.mock('node:fs/promises');
vi.mock('../../../src/services/globalSettingsService');

// Mock PluginRouteManager
vi.mock('../../../src/plugin-system/route-manager', () => ({
  PluginRouteManager: vi.fn().mockImplementation((app, pluginId) => ({
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    head: vi.fn(),
    options: vi.fn(),
    getPluginId: vi.fn().mockReturnValue(pluginId),
    getNamespace: vi.fn().mockReturnValue(`/api/plugin/${pluginId}`),
  }))
}));

// Helper to create a mock plugin
const createMockPlugin = (id: string, name: string, version = '1.0.0'): Mocked<Plugin> => ({
  meta: { id, name, version, description: `Mock plugin ${id}` },
  initialize: vi.fn().mockResolvedValue(undefined),
  shutdown: vi.fn().mockResolvedValue(undefined),
  reinitialize: vi.fn().mockResolvedValue(undefined),
  databaseExtension: undefined,
  globalSettingsExtension: undefined,
});

describe('PluginManager', () => {
  let pluginManager: PluginManager;
  let mockApp: Mocked<FastifyInstance>;
  let mockDb: Mocked<AnyDatabase>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetAllMocks();

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockApp = {
      decorate: vi.fn(),
      addHook: vi.fn(),
      register: vi.fn(),
      log: {
        child: vi.fn().mockReturnValue({
          info: vi.fn(),
          error: vi.fn(),
          warn: vi.fn(),
          debug: vi.fn(),
          trace: vi.fn(),
          fatal: vi.fn(),
        }),
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        trace: vi.fn(),
        fatal: vi.fn(),
      },
    } as unknown as Mocked<FastifyInstance>;

    mockDb = {} as Mocked<AnyDatabase>;

    pluginManager = new PluginManager();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('Constructor and Basic Configuration', () => {
    it('should initialize with default empty paths and options', () => {
      expect(pluginManager['pluginPaths']).toEqual([]);
      expect(pluginManager['pluginOptions'].size).toBe(0);
    });

    it('should initialize with provided paths', () => {
      const config: PluginConfiguration = { paths: ['/path/to/plugins'] };
      const pm = new PluginManager(config);
      expect(pm['pluginPaths']).toEqual(['/path/to/plugins']);
    });

    it('should set the Fastify app instance', () => {
      pluginManager.setApp(mockApp);
      expect(pluginManager['app']).toBe(mockApp);
    });

    it('should set the database instance', () => {
      pluginManager.setDatabase(mockDb);
      expect(pluginManager['db']).toBe(mockDb);
      pluginManager.setDatabase(null);
      expect(pluginManager['db']).toBeNull();
    });
  });

  describe('Plugin Registration and Retrieval', () => {
    it('should register a plugin', () => {
      const plugin = createMockPlugin('plugin1', 'Plugin One');
      pluginManager.registerPlugin(plugin);
      expect(pluginManager.getPlugin('plugin1')).toBe(plugin);
      expect(pluginManager.getAllPlugins()).toEqual([plugin]);
    });

    it('should throw PluginDuplicateError when registering a duplicate plugin', () => {
      const plugin1 = createMockPlugin('plugin1', 'Plugin One');
      pluginManager.registerPlugin(plugin1);
      const plugin2 = createMockPlugin('plugin1', 'Plugin One Duplicate');
      
      expect(() => {
        pluginManager.registerPlugin(plugin2);
      }).toThrow(PluginDuplicateError);
    });

    it('should get a plugin by ID', () => {
      const plugin = createMockPlugin('plugin1', 'Plugin One');
      pluginManager.registerPlugin(plugin);
      expect(pluginManager.getPlugin('plugin1')).toBe(plugin);
    });

    it('should throw PluginNotFoundError when getting a non-existent plugin', () => {
      expect(() => {
        pluginManager.getPlugin('non-existent');
      }).toThrow(PluginNotFoundError);
    });

    it('should get all plugins', () => {
      const plugin1 = createMockPlugin('plugin1', 'Plugin One');
      const plugin2 = createMockPlugin('plugin2', 'Plugin Two');
      pluginManager.registerPlugin(plugin1);
      pluginManager.registerPlugin(plugin2);
      expect(pluginManager.getAllPlugins()).toEqual(expect.arrayContaining([plugin1, plugin2]));
      expect(pluginManager.getAllPlugins().length).toBe(2);
    });
  });

  describe('Plugin Configuration', () => {
    it('should initialize with plugin options from config', () => {
      const config: PluginConfiguration = {
        paths: ['/path/to/plugins'],
        plugins: {
          'plugin1': { enabled: true, config: { setting1: 'value1' } },
          'plugin2': { enabled: false, config: { setting2: 'value2' } }
        }
      };
      const pm = new PluginManager(config);
      expect(pm.isPluginEnabled('plugin1')).toBe(true);
      expect(pm.isPluginEnabled('plugin2')).toBe(false);
      expect(pm.getPluginConfig('plugin1')).toEqual({ setting1: 'value1' });
      expect(pm.getPluginConfig('plugin2')).toEqual({ setting2: 'value2' });
    });

    it('should add plugin paths', () => {
      pluginManager.addPluginPath('/new/path');
      expect(pluginManager['pluginPaths']).toContain('/new/path');
      
      // Should not add duplicate paths
      pluginManager.addPluginPath('/new/path');
      expect(pluginManager['pluginPaths'].filter(p => p === '/new/path')).toHaveLength(1);
    });

    it('should return true for enabled plugins by default', () => {
      expect(pluginManager.isPluginEnabled('any-plugin')).toBe(true);
    });

    it('should return undefined for non-existent plugin config', () => {
      expect(pluginManager.getPluginConfig('non-existent')).toBeUndefined();
    });
  });

  describe('Plugin Loading', () => {
    const mockFs = fs as Mocked<typeof fs>;
    const mockFsPromises = fsPromises as Mocked<typeof fsPromises>;

    beforeEach(() => {
      pluginManager.setApp(mockApp);
    });

    it('should load a plugin from a path', async () => {
      const mockPluginClass = vi.fn().mockImplementation(() => createMockPlugin('test-plugin', 'Test Plugin'));
      const mockPluginPackage: PluginPackage = { default: mockPluginClass };
      
      // Mock dynamic import
      vi.doMock('/path/to/plugin.js', () => mockPluginPackage);
      
      const plugin = await pluginManager.loadPlugin('/path/to/plugin.js');
      expect(plugin.meta.id).toBe('test-plugin');
      expect(pluginManager.getPlugin('test-plugin')).toBe(plugin);
    });

    it('should throw PluginLoadError when plugin has no default export', async () => {
      const mockPluginPackage = { notDefault: vi.fn() };
      vi.doMock('/path/to/bad-plugin.js', () => mockPluginPackage);
      
      await expect(pluginManager.loadPlugin('/path/to/bad-plugin.js')).rejects.toThrow(PluginLoadError);
    });

    it('should throw PluginDuplicateError when loading duplicate plugin', async () => {
      const plugin = createMockPlugin('duplicate-plugin', 'Duplicate Plugin');
      pluginManager.registerPlugin(plugin);
      
      const mockPluginClass = vi.fn().mockImplementation(() => createMockPlugin('duplicate-plugin', 'Another Plugin'));
      const mockPluginPackage: PluginPackage = { default: mockPluginClass };
      vi.doMock('/path/to/duplicate.js', () => mockPluginPackage);
      
      await expect(pluginManager.loadPlugin('/path/to/duplicate.js')).rejects.toThrow(PluginDuplicateError);
    });

    it('should skip disabled plugins during loading', async () => {
      const config: PluginConfiguration = {
        plugins: { 'disabled-plugin': { enabled: false } }
      };
      const pm = new PluginManager(config);
      pm.setApp(mockApp);
      
      const mockPluginClass = vi.fn().mockImplementation(() => createMockPlugin('disabled-plugin', 'Disabled Plugin'));
      const mockPluginPackage: PluginPackage = { default: mockPluginClass };
      vi.doMock('/path/to/disabled.js', () => mockPluginPackage);
      
      const plugin = await pm.loadPlugin('/path/to/disabled.js');
      expect(plugin.meta.id).toBe('disabled-plugin');
      expect(pm.getAllPlugins()).toHaveLength(0); // Should not be registered
    });

    it('should handle import errors gracefully', async () => {
      vi.doMock('/path/to/error-plugin.js', () => {
        throw new Error('Import failed');
      });
      
      await expect(pluginManager.loadPlugin('/path/to/error-plugin.js')).rejects.toThrow(PluginLoadError);
    });
  });

  describe('Plugin Discovery', () => {
    const mockFs = fs as Mocked<typeof fs>;
    const mockFsPromises = fsPromises as Mocked<typeof fsPromises>;

    beforeEach(() => {
      pluginManager.setApp(mockApp);
      pluginManager.addPluginPath('/plugins');
    });

    it('should create plugin directory if it does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockImplementation(() => '');
      
      await pluginManager.discoverPlugins();
      
      expect(mockFs.mkdirSync).toHaveBeenCalledWith('/plugins', { recursive: true });
    });

    it('should discover plugins in directories with package.json', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFsPromises.stat.mockResolvedValueOnce({ isDirectory: () => true } as any);
      mockFsPromises.readdir.mockResolvedValue(['plugin1', 'plugin2'] as any);
      mockFsPromises.stat
        .mockResolvedValueOnce({ isDirectory: () => true } as any)
        .mockResolvedValueOnce({ isDirectory: () => true } as any);
      mockFsPromises.access
        .mockResolvedValueOnce(undefined) // package.json exists for plugin1
        .mockResolvedValueOnce(undefined) // index.ts exists for plugin1
        .mockRejectedValueOnce(new Error('No package.json')) // plugin2 has no package.json
        .mockResolvedValueOnce(undefined) // package.json exists for plugin2
        .mockResolvedValueOnce(undefined); // index.ts exists for plugin2
      
      // Mock __dirname to simulate running from source
      const originalDirname = global.__dirname;
      global.__dirname = '/src/plugin-system';
      
      const mockPluginClass = vi.fn().mockImplementation(() => createMockPlugin('discovered-plugin', 'Discovered Plugin'));
      const mockPluginPackage: PluginPackage = { default: mockPluginClass };
      vi.doMock('/plugins/plugin1/index.ts', () => mockPluginPackage);
      
      await pluginManager.discoverPlugins();
      
      global.__dirname = originalDirname;
    });

    it('should handle file-based plugin loading', async () => {
      pluginManager.addPluginPath('/plugins/single-plugin.js');
      
      mockFs.existsSync.mockReturnValue(true);
      mockFsPromises.stat.mockResolvedValue({ isDirectory: () => false } as any);
      
      const mockPluginClass = vi.fn().mockImplementation(() => createMockPlugin('file-plugin', 'File Plugin'));
      const mockPluginPackage: PluginPackage = { default: mockPluginClass };
      vi.doMock('/plugins/single-plugin.js', () => mockPluginPackage);
      
      await pluginManager.discoverPlugins();
    });

    it('should handle discovery errors gracefully', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFsPromises.stat.mockRejectedValue(new Error('Stat failed'));
      
      // Should not throw, just log error
      await expect(pluginManager.discoverPlugins()).resolves.not.toThrow();
    });

    it('should try alternative file extensions when main file not found', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFsPromises.stat.mockResolvedValueOnce({ isDirectory: () => true } as any);
      mockFsPromises.readdir.mockResolvedValue(['plugin1'] as any);
      mockFsPromises.stat.mockResolvedValueOnce({ isDirectory: () => true } as any);
      mockFsPromises.access
        .mockResolvedValueOnce(undefined) // package.json exists
        .mockRejectedValueOnce(new Error('index.ts not found')) // main file not found
        .mockResolvedValueOnce(undefined); // alternative file found
      
      const mockPluginClass = vi.fn().mockImplementation(() => createMockPlugin('alt-plugin', 'Alt Plugin'));
      const mockPluginPackage: PluginPackage = { default: mockPluginClass };
      vi.doMock('/plugins/plugin1/index.js', () => mockPluginPackage);
      
      await pluginManager.discoverPlugins();
    });
  });

  describe('Database Extensions', () => {
    it('should get plugins with database extensions', () => {
      const plugin1 = createMockPlugin('plugin1', 'Plugin 1');
      const plugin2 = createMockPlugin('plugin2', 'Plugin 2');
      const plugin3 = createMockPlugin('plugin3', 'Plugin 3');
      
      plugin1.databaseExtension = { tableDefinitions: {} };
      plugin3.databaseExtension = { tableDefinitions: {} };
      
      pluginManager.registerPlugin(plugin1);
      pluginManager.registerPlugin(plugin2);
      pluginManager.registerPlugin(plugin3);
      
      const dbExtensions = pluginManager.getDatabaseExtensions();
      expect(dbExtensions).toHaveLength(2);
      expect(dbExtensions).toContain(plugin1);
      expect(dbExtensions).toContain(plugin3);
      expect(dbExtensions).not.toContain(plugin2);
    });
  });

  describe('Global Settings Extensions', () => {
    const mockGlobalSettingsService = GlobalSettingsService as Mocked<typeof GlobalSettingsService>;

    beforeEach(() => {
      pluginManager.setApp(mockApp);
    });

    it('should get plugin global setting groups', () => {
      const plugin1 = createMockPlugin('plugin1', 'Plugin 1');
      const plugin2 = createMockPlugin('plugin2', 'Plugin 2');
      
      const group1: GlobalSettingGroupForPlugin = {
        id: 'group1',
        name: 'Group 1',
        description: 'First group',
        icon: 'icon1',
        sort_order: 1
      };
      
      const group2: GlobalSettingGroupForPlugin = {
        id: 'group2',
        name: 'Group 2',
        description: 'Second group',
        icon: 'icon2',
        sort_order: 2
      };
      
      plugin1.globalSettingsExtension = { groups: [group1], settings: [] };
      plugin2.globalSettingsExtension = { groups: [group2], settings: [] };
      
      pluginManager.registerPlugin(plugin1);
      pluginManager.registerPlugin(plugin2);
      
      const groups = pluginManager.getPluginGlobalSettingGroups();
      expect(groups).toHaveLength(2);
      expect(groups).toContain(group1);
      expect(groups).toContain(group2);
    });

    it('should handle duplicate group IDs', () => {
      const plugin1 = createMockPlugin('plugin1', 'Plugin 1');
      const plugin2 = createMockPlugin('plugin2', 'Plugin 2');
      
      const group1: GlobalSettingGroupForPlugin = {
        id: 'duplicate',
        name: 'Group 1',
        description: 'First group',
        icon: 'icon1',
        sort_order: 1
      };
      
      const group2: GlobalSettingGroupForPlugin = {
        id: 'duplicate',
        name: 'Group 2',
        description: 'Second group',
        icon: 'icon2',
        sort_order: 2
      };
      
      plugin1.globalSettingsExtension = { groups: [group1], settings: [] };
      plugin2.globalSettingsExtension = { groups: [group2], settings: [] };
      
      pluginManager.registerPlugin(plugin1);
      pluginManager.registerPlugin(plugin2);
      
      const groups = pluginManager.getPluginGlobalSettingGroups();
      expect(groups).toHaveLength(1);
      expect(groups[0]).toBe(group1); // First one should be kept
    });

    it('should get plugin global setting definitions', () => {
      const plugin1 = createMockPlugin('plugin1', 'Plugin 1');
      const plugin2 = createMockPlugin('plugin2', 'Plugin 2');
      
      const setting1: GlobalSettingDefinitionForPlugin = {
        key: 'setting1',
        defaultValue: 'value1',
        type: 'string',
        description: 'Setting 1',
        encrypted: false,
        groupId: 'group1'
      };
      
      const setting2: GlobalSettingDefinitionForPlugin = {
        key: 'setting2',
        defaultValue: 42,
        type: 'number',
        description: 'Setting 2',
        encrypted: false,
        groupId: 'group2'
      };
      
      plugin1.globalSettingsExtension = { groups: [], settings: [setting1] };
      plugin2.globalSettingsExtension = { groups: [], settings: [setting2] };
      
      pluginManager.registerPlugin(plugin1);
      pluginManager.registerPlugin(plugin2);
      
      const definitions = pluginManager.getPluginGlobalSettingDefinitions();
      expect(definitions).toHaveLength(2);
      expect(definitions[0]).toEqual({ pluginId: 'plugin1', definition: setting1 });
      expect(definitions[1]).toEqual({ pluginId: 'plugin2', definition: setting2 });
    });

    it('should initialize plugin global settings', async () => {
      const plugin = createMockPlugin('plugin1', 'Plugin 1');
      
      const setting: GlobalSettingDefinitionForPlugin = {
        key: 'test-setting',
        defaultValue: 'test-value',
        type: 'string',
        description: 'Test setting',
        encrypted: false,
        groupId: 'test-group'
      };
      
      plugin.globalSettingsExtension = { groups: [], settings: [setting] };
      pluginManager.registerPlugin(plugin);
      
      mockGlobalSettingsService.getAll.mockResolvedValue([]);
      mockGlobalSettingsService.setTyped.mockResolvedValue({} as any);
      
      await pluginManager.initializePluginGlobalSettings();
      
      expect(mockGlobalSettingsService.setTyped).toHaveBeenCalledWith(
        'test-setting',
        'test-value',
        'string',
        {
          description: 'Test setting',
          encrypted: false,
          group_id: 'test-group'
        }
      );
    });

    it('should skip duplicate setting keys during initialization', async () => {
      const plugin = createMockPlugin('plugin1', 'Plugin 1');
      
      const setting: GlobalSettingDefinitionForPlugin = {
        key: 'existing-setting',
        defaultValue: 'new-value',
        type: 'string',
        description: 'New setting',
        encrypted: false,
        groupId: 'group1'
      };
      
      plugin.globalSettingsExtension = { groups: [], settings: [setting] };
      pluginManager.registerPlugin(plugin);
      
      mockGlobalSettingsService.getAll.mockResolvedValue([
        { key: 'existing-setting', value: 'old-value' }
      ] as any);
      
      await pluginManager.initializePluginGlobalSettings();
      
      expect(mockGlobalSettingsService.setTyped).not.toHaveBeenCalled();
    });

    it('should handle errors during global settings initialization', async () => {
      const plugin = createMockPlugin('plugin1', 'Plugin 1');
      
      const setting: GlobalSettingDefinitionForPlugin = {
        key: 'error-setting',
        defaultValue: 'error-value',
        type: 'string',
        description: 'Error setting',
        encrypted: false,
        groupId: 'error-group'
      };
      
      plugin.globalSettingsExtension = { groups: [], settings: [setting] };
      pluginManager.registerPlugin(plugin);
      
      mockGlobalSettingsService.getAll.mockRejectedValue(new Error('Get all error'));
      
      // Should not throw, just log error
      await expect(pluginManager.initializePluginGlobalSettings()).resolves.not.toThrow();
    });
  });

  describe('Plugin Lifecycle', () => {
    let plugin1: Mocked<Plugin>, plugin2: Mocked<Plugin>;

    beforeEach(() => {
      plugin1 = createMockPlugin('p1', 'Plugin1');
      plugin2 = createMockPlugin('p2', 'Plugin2');
      pluginManager.registerPlugin(plugin1);
      pluginManager.registerPlugin(plugin2);
      pluginManager.setApp(mockApp);
      pluginManager.setDatabase(mockDb);
    });

    describe('initializePlugins', () => {
      it('should initialize all loaded plugins', async () => {
        // Debug: Check if plugins are registered
        expect(pluginManager.getAllPlugins()).toHaveLength(2);
        expect(pluginManager.getAllPlugins()).toContain(plugin1);
        expect(pluginManager.getAllPlugins()).toContain(plugin2);
        
        // Mock the logger creation to avoid any issues
        const mockLogger = {
          child: vi.fn().mockReturnValue({
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn(),
            trace: vi.fn(),
            fatal: vi.fn(),
            level: 'info',
            silent: false,
          }),
          info: vi.fn(),
          error: vi.fn(),
          warn: vi.fn(),
          debug: vi.fn(),
          trace: vi.fn(),
          fatal: vi.fn(),
          level: 'info',
          silent: false,
        };
        
        // Override the logger property
        pluginManager['logger'] = mockLogger as any;
        
        await pluginManager.initializePlugins();
        
        expect(pluginManager['initialized']).toBe(true);
        expect(plugin1.initialize).toHaveBeenCalledWith(mockDb, expect.any(Object));
        expect(plugin2.initialize).toHaveBeenCalledWith(mockDb, expect.any(Object));
      });

      it('should register routes for plugins that have them', async () => {
        plugin1.registerRoutes = vi.fn().mockResolvedValue(undefined);
        
        // Mock the logger creation to avoid any issues
        const mockLogger = {
          child: vi.fn().mockReturnValue({
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn(),
            trace: vi.fn(),
            fatal: vi.fn(),
            level: 'info',
            silent: false,
          }),
          info: vi.fn(),
          error: vi.fn(),
          warn: vi.fn(),
          debug: vi.fn(),
          trace: vi.fn(),
          fatal: vi.fn(),
          level: 'info',
          silent: false,
        };
        
        // Override the logger property
        pluginManager['logger'] = mockLogger as any;
        
        await pluginManager.initializePlugins();
        
        expect(plugin1.registerRoutes).toHaveBeenCalledWith(
          expect.any(Object), // PluginRouteManager
          mockDb,
          expect.any(Object) // logger
        );
      });

      it('should handle plugin initialization errors gracefully', async () => {
        plugin1.initialize.mockRejectedValue(new Error('Init failed'));
        
        // Should not throw, just log error
        await expect(pluginManager.initializePlugins()).resolves.not.toThrow();
        expect(pluginManager['initialized']).toBe(true);
      });

      it('should not initialize twice', async () => {
        // Mock the logger creation to avoid any issues
        const mockLogger = {
          child: vi.fn().mockReturnValue({
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn(),
            trace: vi.fn(),
            fatal: vi.fn(),
            level: 'info',
            silent: false,
          }),
          info: vi.fn(),
          error: vi.fn(),
          warn: vi.fn(),
          debug: vi.fn(),
          trace: vi.fn(),
          fatal: vi.fn(),
          level: 'info',
          silent: false,
        };
        
        // Override the logger property
        pluginManager['logger'] = mockLogger as any;
        
        await pluginManager.initializePlugins();
        await pluginManager.initializePlugins();
        
        expect(plugin1.initialize).toHaveBeenCalledTimes(1);
      });

      it('should throw error if app is not set', async () => {
        const pmWithoutApp = new PluginManager();
        pmWithoutApp.registerPlugin(plugin1);
        pmWithoutApp.setDatabase(mockDb);
        await expect(pmWithoutApp.initializePlugins()).rejects.toThrow('Cannot initialize plugins: Fastify app not set');
      });
    });

    describe('reinitializePluginsWithDatabase', () => {
      it('should reinitialize plugins with database extensions', async () => {
        plugin1.databaseExtension = { tableDefinitions: {} };
        plugin1.reinitialize = vi.fn().mockResolvedValue(undefined);
        
        await pluginManager.reinitializePluginsWithDatabase();
        
        expect(plugin1.reinitialize).toHaveBeenCalledWith(mockApp, mockDb);
      });

      it('should handle plugins with database extension but no reinitialize method', async () => {
        plugin1.databaseExtension = { tableDefinitions: {} };
        delete plugin1.reinitialize;
        
        // Should not throw
        await expect(pluginManager.reinitializePluginsWithDatabase()).resolves.not.toThrow();
      });

      it('should handle reinitialize errors gracefully', async () => {
        plugin1.databaseExtension = { tableDefinitions: {} };
        plugin1.reinitialize = vi.fn().mockRejectedValue(new Error('Reinit failed'));
        
        // Should not throw, just log error
        await expect(pluginManager.reinitializePluginsWithDatabase()).resolves.not.toThrow();
      });

      it('should throw error if app is not set', async () => {
        const pmWithoutApp = new PluginManager();
        pmWithoutApp.registerPlugin(plugin1);
        pmWithoutApp.setDatabase(mockDb);
        await expect(pmWithoutApp.reinitializePluginsWithDatabase()).rejects.toThrow('Cannot re-initialize plugins: Fastify app not set');
      });

      it('should throw error if database is not set', async () => {
        pluginManager.setDatabase(null);
        await expect(pluginManager.reinitializePluginsWithDatabase()).rejects.toThrow('Cannot re-initialize plugins: Database not set');
      });
    });

    describe('shutdownPlugins', () => {
      it('should call shutdown on all plugins that have it', async () => {
        // Mock the logger creation to avoid any issues
        const mockLogger = {
          child: vi.fn().mockReturnValue({
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn(),
            trace: vi.fn(),
            fatal: vi.fn(),
            level: 'info',
            silent: false,
          }),
          info: vi.fn(),
          error: vi.fn(),
          warn: vi.fn(),
          debug: vi.fn(),
          trace: vi.fn(),
          fatal: vi.fn(),
          level: 'info',
          silent: false,
        };
        
        // Override the logger property
        pluginManager['logger'] = mockLogger as any;
        
        await pluginManager.initializePlugins();
        await pluginManager.shutdownPlugins();
        
        expect(plugin1.shutdown).toHaveBeenCalledWith(expect.any(Object));
        expect(plugin2.shutdown).toHaveBeenCalledWith(expect.any(Object));
        expect(pluginManager['initialized']).toBe(false);
      });

      it('should handle shutdown errors gracefully', async () => {
        const mockShutdown = vi.fn().mockRejectedValue(new Error('Shutdown failed'));
        plugin1.shutdown = mockShutdown;
        
        await pluginManager.initializePlugins();
        
        // Should not throw, just log error
        await expect(pluginManager.shutdownPlugins()).resolves.not.toThrow();
        expect(pluginManager['initialized']).toBe(false);
      });

      it('should skip plugins without shutdown method', async () => {
        delete plugin1.shutdown;
        
        await pluginManager.initializePlugins();
        
        // Should not throw
        await expect(pluginManager.shutdownPlugins()).resolves.not.toThrow();
      });
    });
  });
});
