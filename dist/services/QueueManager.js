"use strict";
/**
 * Queue management service using Bull Queue and Redis
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueManager = void 0;
const bull_1 = __importDefault(require("bull"));
const types_1 = require("../types");
const LoggingService_1 = require("./LoggingService");
const config_1 = require("../config");
class QueueManager {
    screenshotQueue;
    uploadQueue;
    retryQueue;
    static instance;
    constructor() {
        this.initializeQueues();
        this.setupEventHandlers();
    }
    /**
     * Get singleton instance
     */
    static getInstance() {
        if (!QueueManager.instance) {
            QueueManager.instance = new QueueManager();
        }
        return QueueManager.instance;
    }
    /**
     * Initialize Bull queues with Redis connection
     */
    initializeQueues() {
        const redisConfig = {
            host: config_1.config.redis.host,
            port: config_1.config.redis.port,
            password: config_1.config.redis.password,
            db: config_1.config.redis.db,
            maxRetriesPerRequest: null,
            retryDelayOnFailover: 100,
            enableReadyCheck: false,
        };
        // Main screenshot processing queue
        this.screenshotQueue = new bull_1.default('screenshot-processing', {
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
        this.uploadQueue = new bull_1.default('file-upload', {
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
        this.retryQueue = new bull_1.default('retry-processing', {
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
        LoggingService_1.logger.info('Queue manager initialized', {
            queues: ['screenshot-processing', 'file-upload', 'retry-processing'],
            redisHost: config_1.config.redis.host,
            redisPort: config_1.config.redis.port,
        });
    }
    /**
     * Setup event handlers for all queues
     */
    setupEventHandlers() {
        // Screenshot queue events
        this.screenshotQueue.on('completed', (job, result) => {
            LoggingService_1.logger.logQueueEvent('job_completed', String(job.id), {
                queue: 'screenshot-processing',
                duration: Date.now() - job.timestamp,
                result,
            });
        });
        this.screenshotQueue.on('failed', (job, err) => {
            LoggingService_1.logger.logQueueEvent('job_failed', String(job.id), {
                queue: 'screenshot-processing',
                error: err.message,
                attempts: job.attemptsMade,
                data: job.data,
            });
        });
        this.screenshotQueue.on('stalled', (job) => {
            LoggingService_1.logger.logQueueEvent('job_stalled', String(job.id), {
                queue: 'screenshot-processing',
                data: job.data,
            });
        });
        // Upload queue events
        this.uploadQueue.on('completed', (job, result) => {
            LoggingService_1.logger.logQueueEvent('job_completed', String(job.id), {
                queue: 'file-upload',
                result,
            });
        });
        this.uploadQueue.on('failed', (job, err) => {
            LoggingService_1.logger.logQueueEvent('job_failed', String(job.id), {
                queue: 'file-upload',
                error: err.message,
                attempts: job.attemptsMade,
            });
        });
        // Retry queue events
        this.retryQueue.on('completed', (job, result) => {
            LoggingService_1.logger.logQueueEvent('job_completed', String(job.id), {
                queue: 'retry-processing',
                result,
            });
        });
        this.retryQueue.on('failed', (job, err) => {
            LoggingService_1.logger.logQueueEvent('job_failed', String(job.id), {
                queue: 'retry-processing',
                error: err.message,
                finalAttempt: true,
            });
        });
        LoggingService_1.logger.debug('Queue event handlers setup completed');
    }
    /**
     * Add a screenshot processing job to the queue
     */
    async addScreenshotJob(record, batchId, priority = types_1.JobPriority.NORMAL, delay = 0) {
        const jobData = {
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
        LoggingService_1.logger.logQueueEvent('job_added', String(job.id), {
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
    async addBatchJobs(records, batchId, priority = types_1.JobPriority.NORMAL) {
        const jobs = [];
        records.forEach((record, index) => {
            const jobData = {
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
        LoggingService_1.logger.info('Batch jobs added to queue', {
            batchId,
            jobCount: addedJobs.length,
            priority,
        });
        return addedJobs;
    }
    /**
     * Add file upload job
     */
    async addUploadJob(filePath, fileName, metadata, priority = types_1.JobPriority.NORMAL) {
        const job = await this.uploadQueue.add({ filePath, fileName, metadata }, { priority });
        LoggingService_1.logger.logQueueEvent('job_added', String(job.id), {
            queue: 'file-upload',
            fileName,
            priority,
        });
        return job;
    }
    /**
     * Move failed job to retry queue
     */
    async retryFailedJob(jobData, delay = 5000) {
        const retryData = {
            ...jobData,
            retryCount: jobData.retryCount + 1,
            updatedAt: new Date(),
            attempt: jobData.attempt + 1,
        };
        const job = await this.retryQueue.add(retryData, {
            delay,
            jobId: `retry_${retryData.id}`,
        });
        LoggingService_1.logger.info('Job moved to retry queue', {
            originalJobId: jobData.id,
            retryJobId: String(job.id),
            retryCount: retryData.retryCount,
            delay,
        });
        return job;
    }
    /**
     * Get queue statistics
     */
    async getQueueStats() {
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
    async getQueueStatistics(queue) {
        const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
            queue.getWaiting(),
            queue.getActive(),
            queue.getCompleted(),
            queue.getFailed(),
            queue.getDelayed(),
            Promise.resolve([]), // Bull doesn't have getPaused method
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
    async pauseAllQueues() {
        await Promise.all([
            this.screenshotQueue.pause(),
            this.uploadQueue.pause(),
            this.retryQueue.pause(),
        ]);
        LoggingService_1.logger.info('All queues paused');
    }
    /**
     * Resume all queues
     */
    async resumeAllQueues() {
        await Promise.all([
            this.screenshotQueue.resume(),
            this.uploadQueue.resume(),
            this.retryQueue.resume(),
        ]);
        LoggingService_1.logger.info('All queues resumed');
    }
    /**
     * Clean completed and failed jobs
     */
    async cleanQueues() {
        const cleanPromises = [
            this.screenshotQueue.clean(24 * 60 * 60 * 1000, 'completed'), // 24 hours
            this.screenshotQueue.clean(48 * 60 * 60 * 1000, 'failed'), // 48 hours
            this.uploadQueue.clean(12 * 60 * 60 * 1000, 'completed'), // 12 hours
            this.uploadQueue.clean(24 * 60 * 60 * 1000, 'failed'), // 24 hours
            this.retryQueue.clean(6 * 60 * 60 * 1000, 'completed'), // 6 hours
            this.retryQueue.clean(12 * 60 * 60 * 1000, 'failed'), // 12 hours
        ];
        await Promise.all(cleanPromises);
        LoggingService_1.logger.info('Queue cleanup completed');
    }
    /**
     * Get failed jobs for analysis
     */
    async getFailedJobs(limit = 50) {
        return this.screenshotQueue.getFailed(0, limit);
    }
    /**
     * Retry all failed jobs
     */
    async retryAllFailedJobs() {
        const failedJobs = await this.screenshotQueue.getFailed();
        let retryCount = 0;
        for (const job of failedJobs) {
            try {
                await job.retry();
                retryCount++;
            }
            catch (error) {
                LoggingService_1.logger.warn('Failed to retry job', { jobId: String(job.id), error: error.message });
            }
        }
        LoggingService_1.logger.info('Failed jobs retry completed', {
            totalFailed: failedJobs.length,
            retryCount,
        });
        return retryCount;
    }
    /**
     * Get active jobs count across all queues
     */
    async getActiveJobsCount() {
        const stats = await this.getQueueStats();
        return stats.screenshot.active + stats.upload.active + stats.retry.active;
    }
    /**
     * Close all queue connections
     */
    async close() {
        await Promise.all([
            this.screenshotQueue.close(),
            this.uploadQueue.close(),
            this.retryQueue.close(),
        ]);
        LoggingService_1.logger.info('All queue connections closed');
    }
    /**
     * Get queue instances for external processing
     */
    getQueues() {
        return {
            screenshot: this.screenshotQueue,
            upload: this.uploadQueue,
            retry: this.retryQueue,
        };
    }
}
exports.QueueManager = QueueManager;
//# sourceMappingURL=QueueManager.js.map