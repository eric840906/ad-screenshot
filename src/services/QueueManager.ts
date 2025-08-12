/**
 * Queue management service using Bull Queue and Redis
 */

import * as Bull from 'bull';
import { ProcessingJob, QueueJobData, JobPriority, AdRecord } from '@/types';
import { logger } from './LoggingService';
import { config } from '@/config';

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

export interface JobResult {
  success: boolean;
  fileName?: string;
  filePath?: string;
  error?: string;
  duration: number;
}

export class QueueManager {
  private screenshotQueue: Bull.Queue<QueueJobData>;
  private uploadQueue: Bull.Queue<{ filePath: string; fileName: string; metadata: any }>;
  private retryQueue: Bull.Queue<QueueJobData>;
  private static instance: QueueManager;

  constructor() {
    this.initializeQueues();
    this.setupEventHandlers();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): QueueManager {
    if (!QueueManager.instance) {
      QueueManager.instance = new QueueManager();
    }
    return QueueManager.instance;
  }

  /**
   * Initialize Bull queues with Redis connection
   */
  private initializeQueues(): void {
    const redisConfig = {
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db,
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
    };

    // Main screenshot processing queue
    this.screenshotQueue = new Bull('screenshot-processing', {
      redis: redisConfig,
      defaultJobOptions: {
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 50, // Keep last 50 failed jobs
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });

    // File upload queue
    this.uploadQueue = new Bull('file-upload', {
      redis: redisConfig,
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 25,
        attempts: 4,
        backoff: {
          type: 'exponential',
          delay: 1500,
        },
      },
    });

    // Retry queue for failed jobs
    this.retryQueue = new Bull('retry-processing', {
      redis: redisConfig,
      defaultJobOptions: {
        removeOnComplete: 25,
        removeOnFail: 25,
        attempts: 2,
        backoff: {
          type: 'fixed',
          delay: 5000,
        },
      },
    });

    logger.info('Queue manager initialized', {
      queues: ['screenshot-processing', 'file-upload', 'retry-processing'],
      redisHost: config.redis.host,
      redisPort: config.redis.port,
    });
  }

  /**
   * Setup event handlers for all queues
   */
  private setupEventHandlers(): void {
    // Screenshot queue events
    this.screenshotQueue.on('completed', (job, result) => {
      logger.logQueueEvent('job_completed', job.id, {
        queue: 'screenshot-processing',
        duration: Date.now() - job.timestamp,
        result,
      });
    });

    this.screenshotQueue.on('failed', (job, err) => {
      logger.logQueueEvent('job_failed', job.id, {
        queue: 'screenshot-processing',
        error: err.message,
        attempts: job.attemptsMade,
        data: job.data,
      });
    });

    this.screenshotQueue.on('stalled', (job) => {
      logger.logQueueEvent('job_stalled', job.id, {
        queue: 'screenshot-processing',
        data: job.data,
      });
    });

    // Upload queue events
    this.uploadQueue.on('completed', (job, result) => {
      logger.logQueueEvent('job_completed', job.id, {
        queue: 'file-upload',
        result,
      });
    });

    this.uploadQueue.on('failed', (job, err) => {
      logger.logQueueEvent('job_failed', job.id, {
        queue: 'file-upload',
        error: err.message,
        attempts: job.attemptsMade,
      });
    });

    // Retry queue events
    this.retryQueue.on('completed', (job, result) => {
      logger.logQueueEvent('job_completed', job.id, {
        queue: 'retry-processing',
        result,
      });
    });

    this.retryQueue.on('failed', (job, err) => {
      logger.logQueueEvent('job_failed', job.id, {
        queue: 'retry-processing',
        error: err.message,
        finalAttempt: true,
      });
    });

    logger.debug('Queue event handlers setup completed');
  }

  /**
   * Add a screenshot processing job to the queue
   */
  public async addScreenshotJob(
    record: AdRecord,
    batchId: string,
    priority: JobPriority = JobPriority.NORMAL,
    delay: number = 0
  ): Promise<Bull.Job<QueueJobData>> {
    const jobData: QueueJobData = {
      id: `${record.PID}_${record.UID}_${Date.now()}`,
      record,
      batchId,
      retryCount: 0,
      priority,
      createdAt: new Date(),
      updatedAt: new Date(),
      attempt: 1,
      delay,
    };

    const job = await this.screenshotQueue.add(jobData, {
      priority,
      delay,
      jobId: jobData.id,
    });

    logger.logQueueEvent('job_added', job.id, {
      queue: 'screenshot-processing',
      batchId,
      priority,
      url: record.WebsiteURL,
    });

    return job;
  }

  /**
   * Add multiple screenshot jobs as a batch
   */
  public async addBatchJobs(
    records: AdRecord[],
    batchId: string,
    priority: JobPriority = JobPriority.NORMAL
  ): Promise<Bull.Job<QueueJobData>[]> {
    const jobs: Array<{ name?: string; data: QueueJobData; opts?: Bull.JobOptions }> = [];

    records.forEach((record, index) => {
      const jobData: QueueJobData = {
        id: `${record.PID}_${record.UID}_${Date.now()}_${index}`,
        record,
        batchId,
        retryCount: 0,
        priority,
        createdAt: new Date(),
        updatedAt: new Date(),
        attempt: 1,
      };

      jobs.push({
        data: jobData,
        opts: {
          priority,
          jobId: jobData.id,
          delay: index * 100, // Stagger jobs by 100ms
        },
      });
    });

    const addedJobs = await this.screenshotQueue.addBulk(jobs);

    logger.info('Batch jobs added to queue', {
      batchId,
      jobCount: addedJobs.length,
      priority,
    });

    return addedJobs;
  }

  /**
   * Add file upload job
   */
  public async addUploadJob(
    filePath: string,
    fileName: string,
    metadata: any,
    priority: JobPriority = JobPriority.NORMAL
  ): Promise<Bull.Job> {
    const job = await this.uploadQueue.add(
      { filePath, fileName, metadata },
      { priority }
    );

    logger.logQueueEvent('job_added', job.id, {
      queue: 'file-upload',
      fileName,
      priority,
    });

    return job;
  }

  /**
   * Move failed job to retry queue
   */
  public async retryFailedJob(
    jobData: QueueJobData,
    delay: number = 5000
  ): Promise<Bull.Job<QueueJobData>> {
    const retryData: QueueJobData = {
      ...jobData,
      retryCount: jobData.retryCount + 1,
      updatedAt: new Date(),
      attempt: jobData.attempt + 1,
    };

    const job = await this.retryQueue.add(retryData, {
      delay,
      jobId: `retry_${retryData.id}`,
    });

    logger.info('Job moved to retry queue', {
      originalJobId: jobData.id,
      retryJobId: job.id,
      retryCount: retryData.retryCount,
      delay,
    });

    return job;
  }

  /**
   * Get queue statistics
   */
  public async getQueueStats(): Promise<{
    screenshot: QueueStats;
    upload: QueueStats;
    retry: QueueStats;
  }> {
    const [screenshotStats, uploadStats, retryStats] = await Promise.all([
      this.getQueueStatistics(this.screenshotQueue),
      this.getQueueStatistics(this.uploadQueue),
      this.getQueueStatistics(this.retryQueue),
    ]);

    return {
      screenshot: screenshotStats,
      upload: uploadStats,
      retry: retryStats,
    };
  }

  /**
   * Get statistics for a specific queue
   */
  private async getQueueStatistics(queue: Bull.Queue): Promise<QueueStats> {
    const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
      queue.getDelayed(),
      queue.getPaused(),
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
      paused: paused.length,
    };
  }

  /**
   * Pause all queues
   */
  public async pauseAllQueues(): Promise<void> {
    await Promise.all([
      this.screenshotQueue.pause(),
      this.uploadQueue.pause(),
      this.retryQueue.pause(),
    ]);

    logger.info('All queues paused');
  }

  /**
   * Resume all queues
   */
  public async resumeAllQueues(): Promise<void> {
    await Promise.all([
      this.screenshotQueue.resume(),
      this.uploadQueue.resume(),
      this.retryQueue.resume(),
    ]);

    logger.info('All queues resumed');
  }

  /**
   * Clean completed and failed jobs
   */
  public async cleanQueues(): Promise<void> {
    const cleanPromises = [
      this.screenshotQueue.clean(24 * 60 * 60 * 1000, 'completed'), // 24 hours
      this.screenshotQueue.clean(48 * 60 * 60 * 1000, 'failed'), // 48 hours
      this.uploadQueue.clean(12 * 60 * 60 * 1000, 'completed'), // 12 hours
      this.uploadQueue.clean(24 * 60 * 60 * 1000, 'failed'), // 24 hours
      this.retryQueue.clean(6 * 60 * 60 * 1000, 'completed'), // 6 hours
      this.retryQueue.clean(12 * 60 * 60 * 1000, 'failed'), // 12 hours
    ];

    await Promise.all(cleanPromises);
    logger.info('Queue cleanup completed');
  }

  /**
   * Get failed jobs for analysis
   */
  public async getFailedJobs(limit: number = 50): Promise<Bull.Job[]> {
    return this.screenshotQueue.getFailed(0, limit);
  }

  /**
   * Retry all failed jobs
   */
  public async retryAllFailedJobs(): Promise<number> {
    const failedJobs = await this.screenshotQueue.getFailed();
    let retryCount = 0;

    for (const job of failedJobs) {
      try {
        await job.retry();
        retryCount++;
      } catch (error) {
        logger.warn('Failed to retry job', { jobId: job.id, error: error.message });
      }
    }

    logger.info('Failed jobs retry completed', {
      totalFailed: failedJobs.length,
      retryCount,
    });

    return retryCount;
  }

  /**
   * Get active jobs count across all queues
   */
  public async getActiveJobsCount(): Promise<number> {
    const stats = await this.getQueueStats();
    return stats.screenshot.active + stats.upload.active + stats.retry.active;
  }

  /**
   * Close all queue connections
   */
  public async close(): Promise<void> {
    await Promise.all([
      this.screenshotQueue.close(),
      this.uploadQueue.close(),
      this.retryQueue.close(),
    ]);

    logger.info('All queue connections closed');
  }

  /**
   * Get queue instances for external processing
   */
  public getQueues(): {
    screenshot: Bull.Queue<QueueJobData>;
    upload: Bull.Queue<{ filePath: string; fileName: string; metadata: any }>;
    retry: Bull.Queue<QueueJobData>;
  } {
    return {
      screenshot: this.screenshotQueue,
      upload: this.uploadQueue,
      retry: this.retryQueue,
    };
  }
}