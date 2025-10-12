import { FastifyBaseLogger } from 'fastify';

/**
 * Base Job Interface
 * 
 * All recurring jobs must implement this interface to be managed by the JobManager.
 */
export interface Job {
  /**
   * Unique job name for logging and tracking
   */
  readonly name: string;

  /**
   * Job execution interval in milliseconds
   */
  readonly interval: number;

  /**
   * Start the job
   */
  start(): void;

  /**
   * Stop the job
   */
  stop(): void;

  /**
   * Check if job is currently running
   */
  isRunning(): boolean;

  /**
   * Get job execution statistics
   */
  getStats(): JobStats;
}

/**
 * Job execution statistics
 */
export interface JobStats {
  name: string;
  isRunning: boolean;
  executionCount: number;
  lastExecution?: Date;
  nextExecution?: Date;
  averageExecutionTime?: number;
  errorCount: number;
}

/**
 * Abstract Base Job Class
 * 
 * Provides common functionality for interval-based jobs.
 * Subclasses must implement the execute() method.
 */
export abstract class BaseJob implements Job {
  public readonly name: string;
  public readonly interval: number;
  protected logger: FastifyBaseLogger;
  protected intervalHandle?: NodeJS.Timeout;
  protected running: boolean = false;
  protected executionCount: number = 0;
  protected errorCount: number = 0;
  protected lastExecution?: Date;
  protected executionTimes: number[] = [];

  constructor(name: string, interval: number, logger: FastifyBaseLogger) {
    this.name = name;
    this.interval = interval;
    this.logger = logger;
  }

  /**
   * Start the job with immediate first execution
   */
  start(): void {
    if (this.running) {
      this.logger.warn({
        operation: 'job_already_running',
        job_name: this.name
      }, `Job "${this.name}" is already running`);
      return;
    }

    this.logger.info({
      operation: 'job_start',
      job_name: this.name,
      interval_ms: this.interval,
      interval_seconds: Math.round(this.interval / 1000)
    }, `Starting job "${this.name}" (${Math.round(this.interval / 1000)}s interval)`);

    this.running = true;

    // Execute immediately on start
    this.executeJob();

    // Set up recurring execution
    this.intervalHandle = setInterval(() => {
      this.executeJob();
    }, this.interval);
  }

  /**
   * Stop the job
   */
  stop(): void {
    if (!this.running) {
      this.logger.warn({
        operation: 'job_already_stopped',
        job_name: this.name
      }, `Job "${this.name}" is not running`);
      return;
    }

    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = undefined;
    }

    this.running = false;

    this.logger.info({
      operation: 'job_stop',
      job_name: this.name,
      total_executions: this.executionCount,
      total_errors: this.errorCount
    }, `Stopped job "${this.name}" (${this.executionCount} executions, ${this.errorCount} errors)`);
  }

  /**
   * Check if job is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get job statistics
   */
  getStats(): JobStats {
    const avgTime = this.executionTimes.length > 0
      ? this.executionTimes.reduce((a, b) => a + b, 0) / this.executionTimes.length
      : undefined;

    const nextExecution = this.running && this.lastExecution
      ? new Date(this.lastExecution.getTime() + this.interval)
      : undefined;

    return {
      name: this.name,
      isRunning: this.running,
      executionCount: this.executionCount,
      lastExecution: this.lastExecution,
      nextExecution,
      averageExecutionTime: avgTime,
      errorCount: this.errorCount
    };
  }

  /**
   * Execute the job with error handling and metrics
   */
  private async executeJob(): Promise<void> {
    const startTime = Date.now();

    try {
      this.executionCount++;
      this.lastExecution = new Date();

      this.logger.debug({
        operation: 'job_execute_start',
        job_name: this.name,
        execution_number: this.executionCount
      }, `Executing job "${this.name}" (#${this.executionCount})`);

      await this.execute();

      const executionTime = Date.now() - startTime;
      
      // Keep last 10 execution times for average calculation
      this.executionTimes.push(executionTime);
      if (this.executionTimes.length > 10) {
        this.executionTimes.shift();
      }

      this.logger.debug({
        operation: 'job_execute_success',
        job_name: this.name,
        execution_number: this.executionCount,
        execution_time_ms: executionTime
      }, `Job "${this.name}" completed in ${executionTime}ms`);

    } catch (error) {
      this.errorCount++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const executionTime = Date.now() - startTime;

      this.logger.error({
        operation: 'job_execute_error',
        job_name: this.name,
        execution_number: this.executionCount,
        error_count: this.errorCount,
        execution_time_ms: executionTime,
        error: errorMessage
      }, `Job "${this.name}" failed: ${errorMessage}`);
    }
  }

  /**
   * Execute method to be implemented by subclasses
   */
  protected abstract execute(): Promise<void>;
}
