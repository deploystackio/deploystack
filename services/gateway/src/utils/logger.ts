/* eslint-disable @typescript-eslint/no-explicit-any */
import chalk from 'chalk';
import { EventEmitter } from 'events';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  component?: string;
  metadata?: Record<string, any>;
}

export class Logger extends EventEmitter {
  private static instance: Logger;
  private logBuffer: LogEntry[] = [];
  private maxBufferSize = 1000;

  private constructor() {
    super();
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private log(level: LogLevel, message: string, component?: string, metadata?: Record<string, any>) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      component,
      metadata
    };

    // Add to buffer
    this.logBuffer.push(entry);
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }

    // Emit event for real-time streaming
    this.emit('log', entry);

    // Console output with colors
    this.outputToConsole(entry);
  }

  private outputToConsole(entry: LogEntry) {
    const timestamp = chalk.gray(entry.timestamp);
    const component = entry.component ? chalk.cyan(`[${entry.component}]`) : '';
    
    let levelColor: (str: string) => string;
    let levelIcon: string;
    
    switch (entry.level) {
      case 'debug':
        levelColor = chalk.gray;
        levelIcon = '🔍';
        break;
      case 'info':
        levelColor = chalk.blue;
        levelIcon = 'ℹ️';
        break;
      case 'warn':
        levelColor = chalk.yellow;
        levelIcon = '⚠️';
        break;
      case 'error':
        levelColor = chalk.red;
        levelIcon = '❌';
        break;
    }

    const levelText = levelColor(entry.level.toUpperCase().padEnd(5));
    const message = entry.level === 'error' ? chalk.red(entry.message) : entry.message;
    
    console.log(`${timestamp} ${levelIcon} ${levelText} ${component} ${message}`);
    
    if (entry.metadata) {
      console.log(chalk.gray('   Metadata:'), entry.metadata);
    }
  }

  debug(message: string, component?: string, metadata?: Record<string, any>) {
    this.log('debug', message, component, metadata);
  }

  info(message: string, component?: string, metadata?: Record<string, any>) {
    this.log('info', message, component, metadata);
  }

  warn(message: string, component?: string, metadata?: Record<string, any>) {
    this.log('warn', message, component, metadata);
  }

  error(message: string, component?: string, metadata?: Record<string, any>) {
    this.log('error', message, component, metadata);
  }

  getRecentLogs(count: number = 50): LogEntry[] {
    return this.logBuffer.slice(-count);
  }

  getLogsSince(timestamp: string): LogEntry[] {
    const since = new Date(timestamp);
    return this.logBuffer.filter(entry => new Date(entry.timestamp) > since);
  }

  filterLogs(level?: LogLevel, component?: string, count: number = 50): LogEntry[] {
    let filtered = this.logBuffer;
    
    if (level) {
      const levelPriority = { debug: 0, info: 1, warn: 2, error: 3 };
      const minPriority = levelPriority[level];
      filtered = filtered.filter(entry => levelPriority[entry.level] >= minPriority);
    }
    
    if (component) {
      filtered = filtered.filter(entry => entry.component === component);
    }
    
    return filtered.slice(-count);
  }

  clearBuffer() {
    this.logBuffer = [];
  }
}

// Export singleton instance
export const logger = Logger.getInstance();

// Convenience functions
export const log = {
  debug: (message: string, component?: string, metadata?: Record<string, any>) => 
    logger.debug(message, component, metadata),
  info: (message: string, component?: string, metadata?: Record<string, any>) => 
    logger.info(message, component, metadata),
  warn: (message: string, component?: string, metadata?: Record<string, any>) => 
    logger.warn(message, component, metadata),
  error: (message: string, component?: string, metadata?: Record<string, any>) => 
    logger.error(message, component, metadata),
};
