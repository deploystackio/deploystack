import { Logger } from 'pino';
import type { EventBus } from '../services/event-bus';

/**
 * Buffered log entry for batching
 */
export interface BufferedLogEntry {
  installation_id: string;
  team_id: string;
  user_id?: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

/**
 * nsjail log pattern: [I|W|E|F][timestamp] message
 * Example: [I][2026-01-17T21:02:01+0100] Mode: STANDALONE_ONCE
 */
const NSJAIL_LOG_REGEX = /^\[([IWEF])\]\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{4}\]\s*(.*)$/;

/**
 * Parse nsjail log line to extract level and message
 * Returns null if line is not an nsjail log
 */
export function parseNsjailLog(line: string): { level: string; message: string } | null {
  const match = line.match(NSJAIL_LOG_REGEX);
  if (!match) return null;
  return { level: match[1], message: match[2] };
}

/**
 * Infer log level from MCP server log message content
 */
export function inferMcpLogLevel(message: string): 'info' | 'warn' | 'error' | 'debug' {
  const lower = message.toLowerCase();
  if (lower.includes('error') || lower.includes('fatal') || lower.includes('exception') || lower.includes('failed')) {
    return 'error';
  }
  if (lower.includes('warn')) {
    return 'warn';
  }
  if (lower.includes('debug') || lower.includes('trace')) {
    return 'debug';
  }
  return 'info';
}

/**
 * LogBuffer handles batching of MCP server log entries
 * Buffers logs and flushes them periodically or when buffer is full
 */
export class LogBuffer {
  private buffer: BufferedLogEntry[] = [];
  private flushTimeout: NodeJS.Timeout | null = null;
  private readonly BATCH_INTERVAL_MS = 3000; // 3 seconds
  private readonly BATCH_MAX_SIZE = 20; // Max logs before forced flush

  constructor(
    private eventBus: EventBus | undefined,
    private logger: Logger
  ) {}

  /**
   * Buffer a log entry for batch emission
   */
  add(entry: BufferedLogEntry): void {
    this.buffer.push(entry);

    // If buffer is full, flush immediately
    if (this.buffer.length >= this.BATCH_MAX_SIZE) {
      this.flush();
    } else {
      this.scheduleFlush();
    }
  }

  /**
   * Schedule a log buffer flush after the batch interval
   */
  private scheduleFlush(): void {
    if (!this.flushTimeout) {
      this.flushTimeout = setTimeout(() => {
        this.flush();
      }, this.BATCH_INTERVAL_MS);
    }
  }

  /**
   * Flush buffered logs, grouped by installation_id
   */
  flush(): void {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }

    if (this.buffer.length === 0 || !this.eventBus) {
      return;
    }

    // Group logs by installation_id
    const grouped = new Map<string, BufferedLogEntry[]>();
    for (const entry of this.buffer) {
      const key = entry.installation_id;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(entry);
    }

    // Emit one event per installation
    for (const [installationId, logs] of grouped) {
      const teamId = logs[0].team_id;
      const userId = logs[0].user_id;

      this.eventBus.emit('mcp.server.logs', {
        installation_id: installationId,
        team_id: teamId,
        user_id: userId,
        logs: logs.map(log => ({
          level: log.level,
          message: log.message,
          metadata: log.metadata,
          timestamp: log.timestamp
        }))
      });

      this.logger.debug({
        operation: 'server_logs_flushed',
        installation_id: installationId,
        log_count: logs.length
      }, `Flushed ${logs.length} server logs for ${installationId}`);
    }

    // Clear the buffer
    this.buffer = [];
  }

  /**
   * Get the current buffer size (for testing/monitoring)
   */
  getBufferSize(): number {
    return this.buffer.length;
  }

  /**
   * Set the EventBus reference (for late initialization)
   * Called when EventBus becomes available after construction
   */
  setEventBus(eventBus: EventBus): void {
    this.eventBus = eventBus;
  }
}
