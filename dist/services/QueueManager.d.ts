/**
 * Queue management service using Bull Queue and Redis
 */
import Bull from 'bull';
import { QueueJobData, JobPriority, AdRecord } from '../types';
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
export declare class QueueManager {
    private screenshotQueue;
    private uploadQueue;
    private retryQueue;
    private static instance;
    constructor();
    /**
     * Get singleton instance
     */
    static getInstance(): QueueManager;
    /**
     * Initialize Bull queues with Redis connection
     */
    private initializeQueues;
    /**
     * Setup event handlers for all queues
     */
    private setupEventHandlers;
    /**
     * Add a screenshot processing job to the queue
     */
    addScreenshotJob(record: AdRecord, batchId: string, priority?: JobPriority, delay?: number): Promise<Bull.Job<QueueJobData>>;
    /**
     * Add multiple screenshot jobs as a batch
     */
    addBatchJobs(records: AdRecord[], batchId: string, priority?: JobPriority): Promise<Bull.Job<QueueJobData>[]>;
    /**
     * Add file upload job
     */
    addUploadJob(filePath: string, fileName: string, metadata: any, priority?: JobPriority): Promise<Bull.Job>;
    /**
     * Move failed job to retry queue
     */
    retryFailedJob(jobData: QueueJobData, delay?: number): Promise<Bull.Job<QueueJobData>>;
    /**
     * Get queue statistics
     */
    getQueueStats(): Promise<{
        screenshot: QueueStats;
        upload: QueueStats;
        retry: QueueStats;
    }>;
    /**
     * Get statistics for a specific queue
     */
    private getQueueStatistics;
    /**
     * Pause all queues
     */
    pauseAllQueues(): Promise<void>;
    /**
     * Resume all queues
     */
    resumeAllQueues(): Promise<void>;
    /**
     * Clean completed and failed jobs
     */
    cleanQueues(): Promise<void>;
    /**
     * Get failed jobs for analysis
     */
    getFailedJobs(limit?: number): Promise<Bull.Job[]>;
    /**
     * Retry all failed jobs
     */
    retryAllFailedJobs(): Promise<number>;
    /**
     * Get active jobs count across all queues
     */
    getActiveJobsCount(): Promise<number>;
    /**
     * Close all queue connections
     */
    close(): Promise<void>;
    /**
     * Get queue instances for external processing
     */
    getQueues(): {
        screenshot: Bull.Queue<QueueJobData>;
        upload: Bull.Queue<{
            filePath: string;
            fileName: string;
            metadata: any;
        }>;
        retry: Bull.Queue<QueueJobData>;
    };
}
//# sourceMappingURL=QueueManager.d.ts.map