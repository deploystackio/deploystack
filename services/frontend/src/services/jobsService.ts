import { getEnv } from '@/utils/env'
import type {
  Job,
  JobFilters,
  JobStats,
  BatchInfo,
  JobListResponse,
  JobDetailResponse,
  BatchStatusResponse,
  JobStatsResponse
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
}
