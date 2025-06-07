import { describe, it, expect, vi, beforeEach, afterEach, type Mocked } from 'vitest';
import path from 'node:path';
import { PluginManager } from '@src/plugin-system/plugin-manager';
import { 
  PluginLoadError, 
  PluginDuplicateError, 
  PluginNotFoundError 
} from '@src/plugin-system/errors';
import type { 
  Plugin, 
  PluginConfiguration, 
  PluginPackage,
  GlobalSettingDefinitionForPlugin,
  GlobalSettingGroupForPlugin
} from '@src/plugin-system/types';
import type { FastifyInstance } from 'fastify';
import type { AnyDatabase } from '@src/db';

// Mock modules
vi.mock('node:fs');
vi.mock('node:fs/promises');
vi.mock('@src/services/globalSettingsService');

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
        await pluginManager.initializePlugins();
        expect(plugin1.initialize).toHaveBeenCalledWith(mockDb);
        expect(plugin2.initialize).toHaveBeenCalledWith(mockDb);
        expect(pluginManager['initialized']).toBe(true);
      });

      it('should throw error if app is not set', async () => {
        pluginManager.setApp(null as any);
        await expect(pluginManager.initializePlugins()).rejects.toThrow('Cannot initialize plugins: Fastify app not set');
      });
    });

    describe('shutdownPlugins', () => {
      it('should call shutdown on all plugins that have it', async () => {
        await pluginManager.shutdownPlugins();
        expect(plugin1.shutdown).toHaveBeenCalled();
        expect(plugin2.shutdown).toHaveBeenCalled();
        expect(pluginManager['initialized']).toBe(false);
      });
    });
  });
});
