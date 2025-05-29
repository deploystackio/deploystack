/**
 * Base plugin error class
 */
export class PluginError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PluginError';
  }
}

/**
 * Error thrown when a plugin fails to load
 */
export class PluginLoadError extends PluginError {
  constructor(pluginId: string, cause: unknown) {
    super(`Failed to load plugin: ${pluginId}`);
    this.name = 'PluginLoadError';
    this.cause = cause;
  }
}

/**
 * Error thrown when a plugin fails to initialize
 */
export class PluginInitializeError extends PluginError {
  constructor(pluginId: string, cause: unknown) {
    super(`Failed to initialize plugin: ${pluginId}`);
    this.name = 'PluginInitializeError';
    this.cause = cause;
  }
}

/**
 * Error thrown when a plugin with the same ID is already loaded
 */
export class PluginDuplicateError extends PluginError {
  constructor(pluginId: string) {
    super(`Plugin with ID '${pluginId}' is already loaded`);
    this.name = 'PluginDuplicateError';
  }
}

/**
 * Error thrown when a plugin is not found
 */
export class PluginNotFoundError extends PluginError {
  constructor(pluginId: string) {
    super(`Plugin with ID '${pluginId}' not found`);
    this.name = 'PluginNotFoundError';
  }
}
