import type { FastifyRequest, FastifyBaseLogger } from 'fastify';
import { McpActivityTracker } from './mcp-activity-tracker';
import { deriveClientName, extractSessionId, extractIpAddress } from './client-name-detector';

export interface ActivityTrackingContext {
  userId: string;
  teamId: string;
  authIdentifier: string;
  authType: 'oauth' | 'instance_token';
}

/**
 * Shared activity tracking logic for MCP requests.
 *
 * Called from both the OAuth auth middleware (hierarchical router)
 * and the instance router (path-based access) to avoid duplication.
 * Tracking failure is non-fatal — errors are logged but never propagated.
 */
export function trackMcpActivity(
  activityTracker: McpActivityTracker,
  request: FastifyRequest,
  context: ActivityTrackingContext,
  logger: FastifyBaseLogger
): void {
  try {
    const headers = request.headers as Record<string, string | string[] | undefined>;
    const clientName = deriveClientName(headers);
    const sessionId = extractSessionId(headers);
    const ipAddress = extractIpAddress(headers, request.socket.remoteAddress);
    const userAgent = request.headers['user-agent'] || 'unknown';

    // Detect tool call from URL path or JSON-RPC body
    let isToolCall = false;
    if (request.url.includes('tools/call')) {
      isToolCall = true;
    } else if (request.body && typeof request.body === 'object' && 'method' in request.body) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      isToolCall = (request.body as any).method === 'tools/call';
    }

    activityTracker.trackRequest(
      context.userId,
      context.teamId,
      context.authIdentifier,
      clientName,
      userAgent,
      ipAddress,
      sessionId,
      isToolCall,
      context.authType
    );

    logger.debug({
      operation: 'activity_tracked',
      userId: context.userId,
      teamId: context.teamId,
      authIdentifier: context.authIdentifier,
      authType: context.authType,
      clientName,
      isToolCall
    }, 'MCP client activity tracked');
  } catch (error) {
    logger.warn({
      operation: 'activity_tracking_failed',
      error: error instanceof Error ? error.message : String(error)
    }, 'Failed to track MCP client activity (non-fatal)');
  }
}
