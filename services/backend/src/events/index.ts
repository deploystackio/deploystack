/**
 * DeployStack Global Event Bus - Module Exports
 * 
 * This file provides a clean API for consuming the event system.
 * Import everything you need from this single entry point.
 */

// Core EventBus class
export { DeployStackEventBus } from './eventBus';

// Event name constants
export { EVENT_NAMES } from './eventNames';
import { EVENT_NAMES } from './eventNames';

// Type definitions
export type {
  EventName,
  EventContext,
  EventData,
  EventHandler,
  GenericEventHandler,
  EventListeners,
  CoreEventData
} from './types';

// Re-export specific event names for convenience
export const {
  // User Events
  USER_REGISTERED,
  USER_LOGIN,
  USER_LOGOUT,
  USER_CREATED,
  USER_UPDATED,
  USER_DELETED,
  USER_PASSWORD_RESET,
  USER_EMAIL_VERIFIED,
  
  // Team Events
  TEAM_CREATED,
  TEAM_UPDATED,
  TEAM_DELETED,
  TEAM_MEMBER_ADDED,
  TEAM_MEMBER_REMOVED,
  
  // Settings Events
  SETTINGS_UPDATED,
  SETTINGS_DELETED,
  SETTINGS_GROUP_CREATED,
  
  // MCP Events
  MCP_INSTALLATION_CREATED,
  MCP_INSTALLATION_UPDATED,
  MCP_INSTALLATION_DELETED,
  MCP_SERVER_CREATED,
  MCP_SERVER_UPDATED,
  MCP_SERVER_DELETED,
  MCP_DEPLOYMENT_CREATED,

  // System Events
  SYSTEM_STARTUP,
  SYSTEM_SHUTDOWN,
  SYSTEM_ERROR
} = EVENT_NAMES;
