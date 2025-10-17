/**
 * Event Type Registry
 * 
 * Defines all available event types and their corresponding data structures.
 * Provides type safety for event emission throughout the satellite.
 */

/**
 * All available event types following domain.entity.action naming convention
 */
export type EventType =
  | 'mcp.client.connected'
  | 'mcp.client.disconnected'
  | 'mcp.client.activity'
  | 'mcp.tool.executed'
  | 'mcp.server.started'
  | 'mcp.server.crashed'
  | 'mcp.server.restarted'
  | 'mcp.server.stopped'
  | 'mcp.server.permanently_failed'
  | 'mcp.server.dormant'
  | 'mcp.server.respawned'
  | 'mcp.tools.discovered'
  | 'mcp.tools.updated'
  | 'config.refreshed'
  | 'config.error'
  | 'security.auth.failed'
  | 'resource.limit.exceeded';

/**
 * Event data structures mapped by event type
 * Each event type has a specific data structure for type safety
 */
export interface EventDataMap {
  'mcp.client.connected': {
    session_id: string;
    client_type: 'vscode' | 'cursor' | 'claude' | 'unknown';
    user_agent: string;
    team_id: string;
    transport: 'sse' | 'http';
    ip_address: string;
  };

  'mcp.client.disconnected': {
    session_id: string;
    team_id: string;
    connection_duration_seconds: number;
    tool_execution_count: number;
    disconnect_reason: 'client_close' | 'timeout' | 'error';
  };

  'mcp.client.activity': {
    user_id: string;
    team_id: string;
    oauth_client_id: string;
    client_name: string;
    user_agent: string;
    ip_address: string;
    session_id?: string;
    request_count: number;
    tool_call_count: number;
    last_activity_at: string;
  };

  'mcp.tool.executed': {
    tool_name: string;
    server_id: string;
    team_id: string;
    duration_ms: number;
    success: boolean;
    error_message?: string;
  };

  'mcp.server.started': {
    server_id: string;
    server_slug: string;
    team_id: string;
    process_id: number;
    transport: 'stdio' | 'http';
    tool_count: number;
    spawn_duration_ms: number;
  };

  'mcp.server.crashed': {
    server_id: string;
    server_slug: string;
    team_id: string;
    process_id: number;
    exit_code: number;
    signal: string;
    uptime_seconds: number;
    crash_count: number;
    will_restart: boolean;
  };

  'mcp.server.restarted': {
    server_id: string;
    server_slug: string;
    team_id: string;
    old_process_id: number;
    new_process_id: number;
    restart_reason: 'crash' | 'health_check_failed';
    attempt_number: number;
  };

  'mcp.server.permanently_failed': {
    server_id: string;
    server_slug: string;
    team_id: string;
    total_crashes: number;
    last_error: string;
    failed_at: string;
  };

  'mcp.server.dormant': {
    server_id: string;
    server_slug: string;
    team_id: string;
    process_id: number;
    idle_duration_seconds: number;
    last_activity_at: string;
  };

  'mcp.server.respawned': {
    server_id: string;
    server_slug: string;
    team_id: string;
    process_id: number;
    dormant_duration_seconds: number;
    respawn_duration_ms: number;
  };

  'mcp.tools.discovered': {
    server_id: string;
    server_slug: string;
    team_id: string;
    tool_count: number;
    tool_names: string[];
    discovery_duration_ms: number;
    previous_tool_count: number;
  };

  'mcp.tools.updated': {
    server_id: string;
    server_slug: string;
    team_id: string;
    added_tools: string[];
    removed_tools: string[];
    total_tools: number;
  };

  'config.refreshed': {
    config_hash: string;
    server_count: number;
    teams_count: number;
    change_detected: boolean;
    fetch_duration_ms: number;
  };

  'config.error': {
    error_type: 'network' | 'auth' | 'server_error';
    error_message: string;
    status_code: number | null;
    retry_in: number;
  };

  'mcp.server.stopped': {
    server_id: string;
    server_name: string;
    team_id: string;
    reason: string;
  };

  'security.auth.failed': {
    team_id?: string;
    client_id?: string;
    reason: string;
    ip_address?: string;
  };

  'resource.limit.exceeded': {
    team_id: string;
    resource_type: 'cpu' | 'memory' | 'processes';
    current_value: number;
    limit_value: number;
  };
}

/**
 * Satellite event structure matching backend expectations
 */
export interface SatelliteEvent<T extends EventType = EventType> {
  type: T;
  timestamp: string;
  data: EventDataMap[T];
}

/**
 * Batch of events to send to backend
 */
export interface EventBatch {
  events: SatelliteEvent[];
}

/**
 * Type guard to validate event type
 */
export function isValidEventType(type: string): type is EventType {
  const validTypes: EventType[] = [
    'mcp.client.connected',
    'mcp.client.disconnected',
    'mcp.client.activity',
    'mcp.tool.executed',
    'mcp.server.started',
    'mcp.server.crashed',
    'mcp.server.restarted',
    'mcp.server.stopped',
    'mcp.server.permanently_failed',
    'mcp.server.dormant',
    'mcp.server.respawned',
    'mcp.tools.discovered',
    'mcp.tools.updated',
    'config.refreshed',
    'config.error',
    'security.auth.failed',
    'resource.limit.exceeded'
  ];
  return validTypes.includes(type as EventType);
}
