// src/utils/env.ts

// Type definition for window.RUNTIME_ENV
declare global {
  interface Window {
    RUNTIME_ENV?: Record<string, string>;
  }
}

/**
 * Get environment variable with universal support for development and production
 * - In development: Uses Vite's import.meta.env
 * - In production: Prioritizes window.RUNTIME_ENV (Docker runtime variables)
 *                 Falls back to build-time values if runtime value isn't available
 */
export function getEnv(key: string): string {
  // First check runtime values (window.RUNTIME_ENV from Docker)
  if (window.RUNTIME_ENV && key in window.RUNTIME_ENV) {
    return window.RUNTIME_ENV[key];
  }

  // Then check build-time values (import.meta.env from Vite)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viteEnv = import.meta.env as Record<string, any>;
  if (key in viteEnv) {
    return String(viteEnv[key]);
  }

  // Return empty string if not found
  return '';
}

/**
 * Get all environment variables combined (build-time + runtime)
 */
export function getAllEnv(): Record<string, string> {
  // Start with build-time variables
  const env: Record<string, string> = {};

  // Add build-time variables from Vite
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viteEnv = import.meta.env as Record<string, any>;
  for (const key in viteEnv) {
    env[key] = String(viteEnv[key]);
  }

  // Override with runtime variables if available
  if (window.RUNTIME_ENV) {
    Object.assign(env, window.RUNTIME_ENV);
  }

  return env;
}
