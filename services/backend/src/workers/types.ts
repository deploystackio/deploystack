import type { AnyDatabase } from '../db';
import type { FastifyBaseLogger } from 'fastify';

/**
 * Worker result interface - returned by worker execute() method
 */
export interface WorkerResult {
  success: boolean;
  data?: unknown;
  message?: string;
}

/**
 * Worker context - dependencies provided to workers
 */
export interface WorkerContext {
  db: AnyDatabase;
  logger: FastifyBaseLogger;
  jobId: string;
}

/**
 * Worker interface - all background job workers must implement this
 */
export interface Worker {
  /**
   * Execute the worker's task
   * 
   * @param payload - The job payload (already parsed from JSON)
   * @param jobId - The unique job ID for logging and tracking
   * @returns WorkerResult indicating success or failure
   * 
   * @throws Error - Throw an error to trigger retry logic
   */
  execute(payload: unknown, jobId: string): Promise<WorkerResult>;
}
