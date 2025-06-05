import { describe, it, expect } from 'vitest';
import {
  PluginError,
  PluginLoadError,
  PluginInitializeError,
  PluginDuplicateError,
  PluginNotFoundError,
} from '@src/plugin-system/errors';

describe('Plugin System Errors', () => {
  describe('PluginError', () => {
    it('should create a PluginError instance', () => {
      const error = new PluginError('Test base message');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(PluginError);
      expect(error.name).toBe('PluginError');
      expect(error.message).toBe('Test base message');
      expect(error.cause).toBeUndefined();
    });
  });

  describe('PluginLoadError', () => {
    it('should create a PluginLoadError instance', () => {
      const causeError = new Error('Underlying cause');
      const error = new PluginLoadError('test-plugin', causeError);
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(PluginError);
      expect(error).toBeInstanceOf(PluginLoadError);
      expect(error.name).toBe('PluginLoadError');
      expect(error.message).toBe('Failed to load plugin: test-plugin');
      expect(error.cause).toBe(causeError);
    });
  });

  describe('PluginInitializeError', () => {
    it('should create a PluginInitializeError instance', () => {
      const causeError = new Error('Initialization failed');
      const error = new PluginInitializeError('test-plugin', causeError);
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(PluginError);
      expect(error).toBeInstanceOf(PluginInitializeError);
      expect(error.name).toBe('PluginInitializeError');
      expect(error.message).toBe('Failed to initialize plugin: test-plugin');
      expect(error.cause).toBe(causeError);
    });
  });

  describe('PluginDuplicateError', () => {
    it('should create a PluginDuplicateError instance', () => {
      const error = new PluginDuplicateError('test-plugin');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(PluginError);
      expect(error).toBeInstanceOf(PluginDuplicateError);
      expect(error.name).toBe('PluginDuplicateError');
      expect(error.message).toBe("Plugin with ID 'test-plugin' is already loaded");
      expect(error.cause).toBeUndefined();
    });
  });

  describe('PluginNotFoundError', () => {
    it('should create a PluginNotFoundError instance', () => {
      const error = new PluginNotFoundError('test-plugin');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(PluginError);
      expect(error).toBeInstanceOf(PluginNotFoundError);
      expect(error.name).toBe('PluginNotFoundError');
      expect(error.message).toBe("Plugin with ID 'test-plugin' not found");
      expect(error.cause).toBeUndefined();
    });
  });
});
