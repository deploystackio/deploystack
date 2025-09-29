// Job Queue API Schemas
// Reusable JSON Schema constants for job queue API validation and documentation

// =============================================================================
// PARAMETER SCHEMAS - URL parameter validation
// =============================================================================

export const JOB_ID_PARAMS_SCHEMA = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      minLength: 1,
      description: 'Job ID'
    }
  },
  required: ['id'],
  additionalProperties: false
} as const;

export const BATCH_ID_PARAMS_SCHEMA = {
  type: 'object',
  properties: {
    batchId: {
      type: 'string',
      minLength: 1,
      description: 'Batch ID'
    }
  },
  required: ['batchId'],
  additionalProperties: false
} as const;

// =============================================================================
// QUERY SCHEMAS - Query parameter validation
// =============================================================================

export const LIST_JOBS_QUERY_SCHEMA = {
  type: 'object',
  properties: {
    status: {
      type: 'string',
      enum: ['pending', 'processing', 'completed', 'failed'],
      description: 'Filter by job status'
    },
    type: {
      type: 'string',
      description: 'Filter by job type'
    },
    limit: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Maximum number of jobs to return (1-100, default: 50)'
    },
    offset: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Number of jobs to skip (≥0, default: 0)'
    }
  },
  additionalProperties: false
} as const;

// =============================================================================
// DATA SCHEMAS - Structure definitions for response data
// =============================================================================

export const JOB_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Job ID' },
    type: { type: 'string', description: 'Job type' },
    payload: { type: 'object', description: 'Job payload data' },
    status: {
      type: 'string',
      enum: ['pending', 'processing', 'completed', 'failed'],
      description: 'Current job status'
    },
    scheduled_for: {
      type: 'string',
      format: 'date-time',
      description: 'When the job should be processed'
    },
    attempts: { type: 'number', description: 'Number of processing attempts' },
    max_attempts: { type: 'number', description: 'Maximum allowed attempts' },
    error: { type: 'string', nullable: true, description: 'Error message if failed' },
    batch_id: { type: 'string', nullable: true, description: 'Associated batch ID' },
    created_at: { type: 'string', format: 'date-time', description: 'Job creation time' },
    updated_at: { type: 'string', format: 'date-time', description: 'Last update time' },
    completed_at: {
      type: 'string',
      format: 'date-time',
      nullable: true,
      description: 'Job completion time'
    }
  },
  required: [
    'id',
    'type',
    'payload',
    'status',
    'scheduled_for',
    'attempts',
    'max_attempts',
    'created_at',
    'updated_at'
  ]
} as const;

export const BATCH_INFO_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Batch ID' },
    type: { type: 'string', description: 'Batch type' },
    totalJobs: { type: 'number', description: 'Total number of jobs in batch' },
    completedJobs: { type: 'number', description: 'Number of completed jobs' },
    failedJobs: { type: 'number', description: 'Number of failed jobs' },
    status: {
      type: 'string',
      enum: ['pending', 'processing', 'completed', 'failed'],
      description: 'Overall batch status'
    },
    progress: { type: 'number', description: 'Completion progress (0.0 to 1.0)' },
    estimatedCompletion: {
      type: 'string',
      nullable: true,
      description: 'Estimated time to completion'
    },
    createdAt: { type: 'string', format: 'date-time', description: 'Batch creation time' },
    completedAt: {
      type: 'string',
      format: 'date-time',
      nullable: true,
      description: 'Batch completion time'
    }
  },
  required: [
    'id',
    'type',
    'totalJobs',
    'completedJobs',
    'failedJobs',
    'status',
    'progress',
    'createdAt'
  ]
} as const;

export const JOB_STATS_SCHEMA = {
  type: 'object',
  properties: {
    pending: { type: 'number', description: 'Number of pending jobs' },
    processing: { type: 'number', description: 'Number of jobs currently processing' },
    completed: { type: 'number', description: 'Number of completed jobs' },
    failed: { type: 'number', description: 'Number of failed jobs' },
    totalToday: { type: 'number', description: 'Total jobs created today' },
    averageDuration: { type: 'number', description: 'Average job duration in milliseconds' }
  },
  required: ['pending', 'processing', 'completed', 'failed', 'totalToday', 'averageDuration']
} as const;

// =============================================================================
// RESPONSE SCHEMAS - Complete API response structures
// =============================================================================

export const ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: {
      type: 'boolean',
      default: false,
      description: 'Indicates operation failure'
    },
    error: { type: 'string', description: 'Error message' }
  },
  required: ['success', 'error']
} as const;

export const JOB_LIST_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', description: 'Indicates operation success' },
    data: {
      type: 'object',
      properties: {
        jobs: {
          type: 'array',
          items: JOB_SCHEMA,
          description: 'Array of jobs'
        },
        pagination: {
          type: 'object',
          properties: {
            total: { type: 'number', description: 'Total number of jobs matching filters' },
            limit: { type: 'number', description: 'Maximum number of items per page' },
            offset: { type: 'number', description: 'Number of items skipped' },
            has_more: { type: 'boolean', description: 'Whether more items are available' }
          },
          required: ['total', 'limit', 'offset', 'has_more']
        }
      },
      required: ['jobs', 'pagination']
    }
  },
  required: ['success', 'data']
} as const;

export const JOB_DETAIL_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', description: 'Indicates operation success' },
    job: JOB_SCHEMA
  },
  required: ['success', 'job']
} as const;

export const BATCH_STATUS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', description: 'Indicates operation success' },
    batch: BATCH_INFO_SCHEMA,
    recentJobs: {
      type: 'array',
      items: JOB_SCHEMA,
      description: 'Last 10 jobs in batch'
    }
  },
  required: ['success', 'batch', 'recentJobs']
} as const;

export const JOB_STATS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', description: 'Indicates operation success' },
    stats: JOB_STATS_SCHEMA
  },
  required: ['success', 'stats']
} as const;

// =============================================================================
// TYPESCRIPT INTERFACES - Type safety for route handlers
// =============================================================================

export interface JobIdParams {
  id: string;
}

export interface BatchIdParams {
  batchId: string;
}

export interface ListJobsQuery {
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  type?: string;
  limit?: string;
  offset?: string;
}

export interface Job {
  id: string;
  type: string;
  payload: unknown;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  scheduled_for: Date;
  attempts: number;
  max_attempts: number;
  error: string | null;
  batch_id: string | null;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
}

export interface BatchInfo {
  id: string;
  type: string;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  estimatedCompletion: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

export interface JobStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  totalToday: number;
  averageDuration: number;
}

export interface ErrorResponse {
  success: boolean;
  error: string;
}

export interface JobListResponse {
  success: boolean;
  data: {
    jobs: Job[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      has_more: boolean;
    };
  };
}

export interface JobDetailResponse {
  success: boolean;
  job: Job;
}

export interface BatchStatusResponse {
  success: boolean;
  batch: BatchInfo;
  recentJobs: Job[];
}

export interface JobStatsResponse {
  success: boolean;
  stats: JobStats;
}
