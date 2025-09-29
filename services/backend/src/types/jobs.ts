// Type definitions for the Background Job Queue System

// Job status types
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type BatchStatus = 'pending' | 'processing' | 'completed' | 'failed';

// Core job interface - represents a single background job
export interface Job {
  id: string;
  type: string;
  payload: string; // JSON string
  status: JobStatus;
  scheduled_for: Date;
  attempts: number;
  max_attempts: number;
  error: string | null;
  batch_id: string | null;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
}

// Job batch interface - represents a group of related jobs
export interface JobBatch {
  id: string;
  type: string;
  total_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  status: BatchStatus;
  metadata: string | null; // JSON string
  created_at: Date;
  completed_at: Date | null;
}

// Options for creating a new job
export interface JobOptions {
  scheduledFor?: Date;
  maxAttempts?: number;
  batchId?: string;
}

// Job statistics for monitoring
export interface JobStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  totalToday: number;
  averageDuration: number; // milliseconds
}

// Worker result interface - returned by worker execute() method
export interface WorkerResult {
  success: boolean;
  data?: unknown;
  message?: string;
}

// Worker context - dependencies provided to workers
export interface WorkerContext {
  jobId: string;
}
