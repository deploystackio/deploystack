import { describe, it, expect } from 'vitest';
import { PluginManager } from '../../../src/plugin-system/plugin-manager';

describe('PluginManager', () => {
  it('should be able to create a PluginManager instance', () => {
    const pluginManager = new PluginManager();
    expect(pluginManager).toBeInstanceOf(PluginManager);
  });

  it('should have methods for managing plugins', () => {
    const pluginManager = new PluginManager();
    expect(pluginManager.addPluginPath).toBeInstanceOf(Function);
    expect(pluginManager.isPluginEnabled).toBeInstanceOf(Function);
    expect(pluginManager.getPluginConfig).toBeInstanceOf(Function);
  });
});
