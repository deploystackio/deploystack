import { Job, JobStats } from './base-job';
import { HeartbeatService } from '../services/heartbeat-service';

/**
 * Heartbeat Job
 * 
 * Wraps the existing HeartbeatService to integrate with the job management system.
 * The HeartbeatService handles all heartbeat logic and reporting.
 */
export class HeartbeatJob implements Job {
  public readonly name = 'heartbeat';
  public readonly interval = 30000; // 30 seconds

  constructor(private heartbeatService: HeartbeatService) {}

  /**
   * Start the heartbeat service
   */
  start(): void {
    this.heartbeatService.start();
  }

  /**
   * Stop the heartbeat service
   */
  stop(): void {
    this.heartbeatService.stop();
  }

  /**
   * Check if heartbeat service is running
   */
  isRunning(): boolean {
    return this.heartbeatService.getStatus().isRunning;
  }

  /**
   * Get heartbeat job statistics
   */
  getStats(): JobStats {
    const status = this.heartbeatService.getStatus();
    
    return {
      name: this.name,
      isRunning: status.isRunning,
      executionCount: status.heartbeatCount,
      errorCount: 0, // HeartbeatService doesn't expose error count yet
      lastExecution: undefined, // Could be tracked in HeartbeatService
      nextExecution: status.isRunning 
        ? new Date(Date.now() + this.interval)
        : undefined,
      averageExecutionTime: undefined // Could be tracked in HeartbeatService
    };
  }
}
