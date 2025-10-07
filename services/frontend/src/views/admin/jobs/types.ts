export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed'
export type BatchStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface Job {
  id: string
  type: string
  payload: unknown
  status: JobStatus
  scheduled_for: string
  attempts: number
  max_attempts: number
  error: string | null
  batch_id: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

export interface BatchInfo {
  id: string
  type: string
  totalJobs: number
  completedJobs: number
  failedJobs: number
  status: BatchStatus
  progress: number
  estimatedCompletion: string | null
  createdAt: string
  completedAt: string | null
}

export interface JobStats {
  pending: number
  processing: number
  completed: number
  failed: number
  totalToday: number
  averageDuration: number
}

export interface JobFilters {
  status?: JobStatus
  type?: string
}

export interface SearchJobsParams {
  id?: string
  type?: string
  status?: JobStatus
  created_after?: string
  created_before?: string
  limit?: number
  offset?: number
}

export interface SearchJobsResponse {
  success: boolean
  data: {
    jobs: Job[]
    pagination: {
      total: number
      limit: number
      offset: number
      has_more: boolean
    }
  }
}

export interface JobListResponse {
  success: boolean
  data: {
    jobs: Job[]
    pagination: {
      total: number
      limit: number
      offset: number
      has_more: boolean
    }
  }
}

export interface JobDetailResponse {
  success: boolean
  job: Job
}

export interface BatchStatusResponse {
  success: boolean
  batch: BatchInfo
  recentJobs: Job[]
}

export interface JobStatsResponse {
  success: boolean
  stats: JobStats
}

export interface JobTypesResponse {
  success: boolean
  types: string[]
  count: number
}
