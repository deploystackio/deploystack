// services/frontend/src/plugin-system/errors.ts
export class PluginError extends Error {
  // Add the cause property explicitly
  cause?: unknown;

  constructor(message: string) {
    super(message);
    this.name = 'PluginError';
  }
}

export class PluginLoadError extends PluginError {
  constructor(pluginId: string, cause: unknown) {
    super(`Failed to load plugin: ${pluginId}`);
    this.name = 'PluginLoadError';
    this.cause = cause;
  }
}

export class PluginInitializeError extends PluginError {
  constructor(pluginId: string, cause: unknown) {
    super(`Failed to initialize plugin: ${pluginId}`);
    this.name = 'PluginInitializeError';
    this.cause = cause;
  }
}

export class PluginDuplicateError extends PluginError {
  constructor(pluginId: string) {
    super(`Plugin with ID '${pluginId}' is already loaded`);
    this.name = 'PluginDuplicateError';
  }
}
