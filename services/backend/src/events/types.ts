/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Type definitions for the DeployStack Global Event Bus
 * 
 * This file defines:
 * - EventContext: Context information passed to all event listeners
 * - CoreEventData: Strongly-typed data structures for each event
 * - Type helpers for type-safe event handling
 */

import { EVENT_NAMES, type EventName } from './eventNames';

// Re-export EventName for use in other modules
export type { EventName } from './eventNames';
import { type AnyDatabase } from '../db';
import { type FastifyBaseLogger } from 'fastify';

/**
 * Event context passed to all event listeners
 * Contains database access, logging, user info, and request metadata
 */
export interface EventContext {
  /** Database connection for plugin database operations */
  db: AnyDatabase | null;
  
  /** Logger instance scoped to the event context */
  logger: FastifyBaseLogger;
  
  /** User information (if authenticated) */
  user?: {
    id: string;
    email: string;
    roleId: string;
  };
  
  /** Request metadata for audit trails */
  request?: {
    ip: string;
    userAgent?: string;
    requestId: string;
  };
  
  /** Event timestamp */
  timestamp: Date;
}

/**
 * Strongly-typed event data structures for each event type
 * Each event has a specific data structure that matches its purpose
 */
export interface CoreEventData {
  [EVENT_NAMES.USER_REGISTERED]: {
    user: {
      id: string;
      email: string;
      name: string;
      createdAt: Date;
    };
    metadata: {
      registrationMethod: 'email' | 'oauth';
      ip: string;
      userAgent?: string;
    };
  };

  [EVENT_NAMES.USER_LOGIN]: {
    user: {
      id: string;
      email: string;
      name: string;
    };
    metadata: {
      loginMethod: 'email' | 'oauth';
      ip: string;
      userAgent?: string;
    };
  };

  [EVENT_NAMES.USER_LOGOUT]: {
    user: {
      id: string;
      email: string;
      name: string;
    };
    metadata: {
      ip: string;
      userAgent?: string;
    };
  };

  [EVENT_NAMES.USER_CREATED]: {
    user: {
      id: string;
      email: string;
      name: string;
      roleId: string;
    };
    createdBy: {
      id: string;
      email: string;
    };
    metadata: {
      ip: string;
    };
  };

  [EVENT_NAMES.USER_UPDATED]: {
    user: {
      id: string;
      email: string;
      name: string;
      roleId: string;
    };
    updatedBy: {
      id: string;
      email: string;
    };
    changes: Record<string, any>;
    metadata: {
      ip: string;
    };
  };

  [EVENT_NAMES.USER_DELETED]: {
    user: {
      id: string;
      email: string;
      name: string;
      roleId: string;
    };
    deletedBy: {
      id: string;
      email: string;
    };
    metadata: {
      ip: string;
    };
  };

  [EVENT_NAMES.USER_PASSWORD_RESET]: {
    user: {
      id: string;
      email: string;
    };
    metadata: {
      ip: string;
      userAgent?: string;
    };
  };

  [EVENT_NAMES.USER_EMAIL_VERIFIED]: {
    user: {
      id: string;
      email: string;
    };
    metadata: {
      ip: string;
      userAgent?: string;
    };
  };

  [EVENT_NAMES.TEAM_CREATED]: {
    team: {
      id: string;
      name: string;
      description?: string;
    };
    createdBy: {
      id: string;
      email: string;
    };
    metadata: {
      ip: string;
    };
  };

  [EVENT_NAMES.TEAM_UPDATED]: {
    team: {
      id: string;
      name: string;
      description?: string;
    };
    updatedBy: {
      id: string;
      email: string;
    };
    changes: Record<string, any>;
    metadata: {
      ip: string;
    };
  };

  [EVENT_NAMES.TEAM_DELETED]: {
    team: {
      id: string;
      name: string;
    };
    deletedBy: {
      id: string;
      email: string;
    };
    metadata: {
      ip: string;
    };
  };

  [EVENT_NAMES.TEAM_MEMBER_ADDED]: {
    team: {
      id: string;
      name: string;
    };
    member: {
      id: string;
      email: string;
      name: string;
      role: string;
    };
    addedBy: {
      id: string;
      email: string;
    };
    metadata: {
      ip: string;
    };
  };

  [EVENT_NAMES.TEAM_MEMBER_REMOVED]: {
    team: {
      id: string;
      name: string;
    };
    member: {
      id: string;
      email: string;
      name: string;
    };
    removedBy: {
      id: string;
      email: string;
    };
    metadata: {
      ip: string;
    };
  };

  [EVENT_NAMES.SETTINGS_UPDATED]: {
    setting: {
      key: string;
      oldValue?: string;
      newValue: string;
      groupId?: string;
    };
    updatedBy: {
      id: string;
      email: string;
    };
    metadata: {
      ip: string;
    };
  };

  [EVENT_NAMES.SETTINGS_DELETED]: {
    setting: {
      key: string;
      value: string;
      groupId?: string;
    };
    deletedBy: {
      id: string;
      email: string;
    };
    metadata: {
      ip: string;
    };
  };

  [EVENT_NAMES.SETTINGS_GROUP_CREATED]: {
    group: {
      id: string;
      name: string;
      description?: string;
    };
    createdBy: {
      id: string;
      email: string;
    };
    metadata: {
      ip: string;
    };
  };

  [EVENT_NAMES.MCP_INSTALLATION_CREATED]: {
    installation: {
      id: string;
      serverId: string;
      teamId?: string;
      version?: string;
    };
    installedBy: {
      id: string;
      email: string;
    };
    metadata: {
      ip: string;
    };
  };

  [EVENT_NAMES.MCP_INSTALLATION_UPDATED]: {
    installation: {
      id: string;
      serverId: string;
      teamId?: string;
      version?: string;
    };
    updatedBy: {
      id: string;
      email: string;
    };
    changes: Record<string, any>;
    metadata: {
      ip: string;
    };
  };

  [EVENT_NAMES.MCP_INSTALLATION_DELETED]: {
    installation: {
      id: string;
      serverId: string;
      teamId?: string;
    };
    deletedBy: {
      id: string;
      email: string;
    };
    metadata: {
      ip: string;
    };
  };

  [EVENT_NAMES.MCP_SERVER_CREATED]: {
    server: {
      id: string;
      name: string;
      description?: string;
      language: string;
      runtime: string;
    };
    createdBy: {
      id: string;
      email: string;
    };
    metadata: {
      ip: string;
    };
  };

  [EVENT_NAMES.MCP_SERVER_UPDATED]: {
    server: {
      id: string;
      name: string;
      description?: string;
      language: string;
      runtime: string;
    };
    updatedBy: {
      id: string;
      email: string;
    };
    changes: Record<string, any>;
    metadata: {
      ip: string;
    };
  };

  [EVENT_NAMES.MCP_SERVER_DELETED]: {
    server: {
      id: string;
      name: string;
      description?: string;
    };
    deletedBy: {
      id: string;
      email: string;
    };
    metadata: {
      ip: string;
    };
  };

  [EVENT_NAMES.SYSTEM_STARTUP]: {
    version: string;
    environment: string;
    timestamp: Date;
  };

  [EVENT_NAMES.SYSTEM_SHUTDOWN]: {
    timestamp: Date;
  };

  [EVENT_NAMES.SYSTEM_ERROR]: {
    error: {
      message: string;
      stack?: string;
      code?: string;
    };
    context?: Record<string, any>;
  };
}

/**
 * Type helpers for type-safe event handling
 */

/** Extract event data type for a specific event */
export type EventData<T extends EventName> = CoreEventData[T];

/** Event handler function signature */
export type EventHandler<T extends EventName> = (
  data: EventData<T>,
  context: EventContext
) => Promise<void>;

/** Generic event handler that can handle any event */
export type GenericEventHandler = <T extends EventName>(
  data: EventData<T>,
  context: EventContext
) => Promise<void>;

/** Event listener registry for plugins */
export type EventListeners = {
  [K in EventName]?: EventHandler<K>;
};
