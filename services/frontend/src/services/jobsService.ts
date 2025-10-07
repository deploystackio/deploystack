import { getEnv } from '@/utils/env'
import type {
  Job,
  JobFilters,
  JobStats,
  BatchInfo,
  JobListResponse,
  JobDetailResponse,
  BatchStatusResponse,
  JobStatsResponse,
  SearchJobsParams,
  SearchJobsResponse,
  JobTypesResponse
} from '@/views/admin/jobs/types'

export class JobsService {
  private static baseUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL')

  static async listJobs(
    filters: JobFilters = {},
    limit: number = 50,
    offset: number = 0
  ): Promise<JobListResponse> {
    const url = new URL(`${this.baseUrl}/api/admin/jobs`)
    
    if (filters.status) url.searchParams.append('status', filters.status)
    if (filters.type) url.searchParams.append('type', filters.type)
    url.searchParams.append('limit', limit.toString())
    url.searchParams.append('offset', offset.toString())

    const response = await fetch(url.toString(), {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Failed to fetch jobs: ${response.status}`)
    }

    return await response.json()
  }

  static async getJob(jobId: string): Promise<Job> {
    const response = await fetch(`${this.baseUrl}/api/admin/jobs/${jobId}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Failed to fetch job: ${response.status}`)
    }

    const data: JobDetailResponse = await response.json()
    return data.job
  }

  static async getJobStats(): Promise<JobStats> {
    const response = await fetch(`${this.baseUrl}/api/admin/jobs/stats`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Failed to fetch job stats: ${response.status}`)
    }

    const data: JobStatsResponse = await response.json()
    return data.stats
  }

  static async getBatchStatus(batchId: string): Promise<{
    batch: BatchInfo
    recentJobs: Job[]
  }> {
    const response = await fetch(`${this.baseUrl}/api/admin/jobs/batches/${batchId}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Failed to fetch batch status: ${response.status}`)
    }

    const data: BatchStatusResponse = await response.json()
    return {
      batch: data.batch,
      recentJobs: data.recentJobs
    }
  }

  static async searchJobs(params: SearchJobsParams): Promise<SearchJobsResponse> {
    const url = new URL(`${this.baseUrl}/api/admin/jobs/search`)

    if (params.id) url.searchParams.append('id', params.id)
    if (params.type) url.searchParams.append('type', params.type)
    if (params.status) url.searchParams.append('status', params.status)
    if (params.created_after) url.searchParams.append('created_after', params.created_after)
    if (params.created_before) url.searchParams.append('created_before', params.created_before)
    if (params.limit !== undefined) url.searchParams.append('limit', params.limit.toString())
    if (params.offset !== undefined) url.searchParams.append('offset', params.offset.toString())

    const response = await fetch(url.toString(), {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Failed to search jobs: ${response.status}`)
    }

    return await response.json()
  }

  static async getJobTypes(): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/api/admin/jobs/types`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Failed to fetch job types: ${response.status}`)
    }

    const data: JobTypesResponse = await response.json()
    return data.types
  }
}
