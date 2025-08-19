/**
 * DeployStack Global Event Bus
 * 
 * Core event management system built on Node.js EventEmitter.
 * Provides type-safe event emission and plugin listener management.
 */

import { EventEmitter } from 'events';
import { type FastifyBaseLogger } from 'fastify';
import { type EventName, type EventData, type EventContext, type EventHandler } from './types';

/**
 * DeployStack Event Bus - Central event management system
 * 
 * Features:
 * - Type-safe event emission with compile-time validation
 * - Plugin listener registration and cleanup
 * - Error isolation (failed listeners don't affect others)
 * - Memory efficient (fire-and-forget processing)
 * - Audit trail for plugin listener registrations
 */
export class DeployStackEventBus extends EventEmitter {
  private logger?: FastifyBaseLogger;
  private pluginListeners: Map<string, Set<string>> = new Map();

  constructor(logger?: FastifyBaseLogger) {
    super();
    this.logger = logger;
    
    // Support many plugins listening to events
    this.setMaxListeners(100);
    
    // Prevent crashes from unhandled errors in event listeners
    this.on('error', (error) => {
      this.logger?.error('EventBus error:', error);
    });
  }

  /**
   * Emit an event with typed data and context
   * 
   * @param eventName - Type-safe event name constant
   * @param data - Strongly-typed event data
   * @param context - Event context with database, logger, user info
   * @returns true if event had listeners, false otherwise
   */
  emitWithContext<T extends EventName>(
    eventName: T,
    data: EventData<T>,
    context: EventContext
  ): boolean {
    try {
      this.logger?.debug(`Emitting event: ${eventName}`);

      // Emit the event with data and context
      const hasListeners = this.emit(eventName, data, context);
      
      if (!hasListeners) {
        this.logger?.debug(`No listeners for event: ${eventName}`);
      }

      return hasListeners;
    } catch (error) {
      this.logger?.error(`Failed to emit event ${eventName}: ${error}`);
      // Don't throw - event emission failures should not break core operations
      return false;
    }
  }

  /**
   * Register a plugin event listener
   * 
   * @param pluginId - Unique plugin identifier
   * @param eventName - Event name to listen for
   * @param handler - Event handler function
   */
  registerPluginListener<T extends EventName>(
    pluginId: string,
    eventName: T,
    handler: EventHandler<T>
  ): void {
    try {
      // Track plugin listeners for cleanup
      if (!this.pluginListeners.has(pluginId)) {
        this.pluginListeners.set(pluginId, new Set());
      }
      this.pluginListeners.get(pluginId)!.add(eventName);

      // Wrap handler with error isolation
      const wrappedHandler = async (data: EventData<T>, context: EventContext) => {
        try {
          await handler(data, context);
        } catch (error) {
          this.logger?.error(`Plugin ${pluginId} event handler failed for ${eventName}: ${error}`);
          // Don't re-throw - plugin failures should not affect other plugins or core operations
        }
      };

      // Register the wrapped listener
      this.on(eventName, wrappedHandler);
      
      this.logger?.info(`Plugin ${pluginId} registered for event: ${eventName}`);
    } catch (error) {
      this.logger?.error(`Failed to register plugin listener for ${pluginId}: ${error}`);
      throw error; // This is a setup error, should be thrown
    }
  }

  /**
   * Unregister all event listeners for a plugin
   * 
   * @param pluginId - Plugin identifier to clean up
   */
  unregisterPlugin(pluginId: string): void {
    try {
      const events = this.pluginListeners.get(pluginId);
      if (!events) {
        this.logger?.debug(`No listeners found for plugin: ${pluginId}`);
        return;
      }

      let removedCount = 0;
      events.forEach(eventName => {
        const listenerCount = this.listenerCount(eventName);
        this.removeAllListeners(eventName);
        removedCount += listenerCount;
      });

      this.pluginListeners.delete(pluginId);
      
      this.logger?.info(`Unregistered ${removedCount} listeners for plugin: ${pluginId}`);
    } catch (error) {
      this.logger?.error(`Failed to unregister plugin ${pluginId}: ${error}`);
      // Don't throw - cleanup failures should not break plugin unloading
    }
  }

  /**
   * Get statistics about registered listeners
   * 
   * @returns Event bus statistics
   */
  getStats(): {
    totalPlugins: number;
    totalListeners: number;
    eventCounts: Record<string, number>;
  } {
    const eventCounts: Record<string, number> = {};
    
    // Get listener counts for each event
    this.eventNames().forEach(eventName => {
      if (typeof eventName === 'string') {
        eventCounts[eventName] = this.listenerCount(eventName);
      }
    });

    return {
      totalPlugins: this.pluginListeners.size,
      totalListeners: Object.values(eventCounts).reduce((sum, count) => sum + count, 0),
      eventCounts
    };
  }

  /**
   * Check if a plugin has registered listeners
   * 
   * @param pluginId - Plugin identifier to check
   * @returns true if plugin has registered listeners
   */
  hasPluginListeners(pluginId: string): boolean {
    return this.pluginListeners.has(pluginId);
  }

  /**
   * Get list of events a plugin is listening to
   * 
   * @param pluginId - Plugin identifier
   * @returns Set of event names the plugin is listening to
   */
  getPluginEvents(pluginId: string): Set<string> {
    return this.pluginListeners.get(pluginId) || new Set();
  }

  /**
   * Shutdown the event bus and clean up all listeners
   */
  shutdown(): void {
    try {
      this.logger?.info('Shutting down EventBus...');
      
      // Remove all listeners
      this.removeAllListeners();
      
      // Clear plugin tracking
      this.pluginListeners.clear();
      
      this.logger?.info('EventBus shutdown complete');
    } catch (error) {
      this.logger?.error(`Error during EventBus shutdown: ${error}`);
    }
  }
}
