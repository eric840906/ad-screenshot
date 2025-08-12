/**
 * Main processing pipeline that orchestrates all services
 */

import { 
  AdRecord, 
  ProcessingJob, 
  BatchProcessingResult, 
  JobPriority,
  DeviceType,
  ScreenshotResult,
  BookmarkletConfig
} from '@/types';
import { DataIngestionService } from './DataIngestionService';
import { QueueManager } from './QueueManager';
import { BrowserAutomationEngine } from './BrowserAutomationEngine';
import { BookmarkletExecutor } from './BookmarkletExecutor';
import { ChromeExtensionBridge } from './ChromeExtensionBridge';
import { ScreenshotManager } from './ScreenshotManager';
import { FileStorageService } from './FileStorageService';
import { UploadService } from './UploadService';
import { logger } from './LoggingService';
import { errorHandler, AppError, ErrorType } from '@/utils/ErrorHandler';
import { config } from '@/config';
import * as pLimit from 'p-limit';

export interface PipelineOptions {
  concurrency?: number;
  enableUpload?: boolean;
  enableBookmarklet?: boolean;
  enableExtension?: boolean;
  screenshotDelay?: number;
  deviceTypes?: DeviceType[];
}

export interface ProcessingResult {
  record: AdRecord;
  success: boolean;
  screenshot?: ScreenshotResult;
  uploadResult?: any;
  error?: string;
  duration: number;
}

export class ProcessingPipeline {
  private dataIngestion: DataIngestionService;
  private queueManager: QueueManager;
  private browserEngine: BrowserAutomationEngine;
  private bookmarkletExecutor: BookmarkletExecutor;
  private extensionBridge: ChromeExtensionBridge;
  private screenshotManager: ScreenshotManager;
  private fileStorage: FileStorageService;
  private uploadService: UploadService;
  private isRunning: boolean = false;
  private activeJobs: Map<string, ProcessingJob> = new Map();
  private static instance: ProcessingPipeline;

  constructor() {
    this.initializeServices();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ProcessingPipeline {
    if (!ProcessingPipeline.instance) {
      ProcessingPipeline.instance = new ProcessingPipeline();
    }
    return ProcessingPipeline.instance;
  }

  /**
   * Initialize all services
   */
  private initializeServices(): void {
    this.dataIngestion = new DataIngestionService();
    this.queueManager = QueueManager.getInstance();
    this.browserEngine = BrowserAutomationEngine.getInstance();
    this.bookmarkletExecutor = BookmarkletExecutor.getInstance();
    this.extensionBridge = ChromeExtensionBridge.getInstance();
    this.screenshotManager = ScreenshotManager.getInstance();
    this.fileStorage = FileStorageService.getInstance();
    this.uploadService = UploadService.getInstance();

    logger.info('Processing pipeline initialized');
  }

  /**
   * Initialize the entire system
   */
  public async initialize(): Promise<void> {
    try {
      // Initialize browser engine
      await this.browserEngine.initialize();

      // Initialize Chrome extension bridge if enabled
      if (config.chromeExtension.id) {
        await this.extensionBridge.initialize();
      }

      // Setup queue processing
      this.setupQueueProcessing();

      logger.info('Processing pipeline fully initialized');
    } catch (error) {
      logger.error('Failed to initialize processing pipeline', error);
      throw error;
    }
  }

  /**
   * Setup queue processing workers
   */
  private setupQueueProcessing(): void {
    const queues = this.queueManager.getQueues();

    // Screenshot processing worker
    queues.screenshot.process(config.processing.concurrency, async (job) => {
      return this.processScreenshotJob(job.data);
    });

    // Upload processing worker
    queues.upload.process(2, async (job) => {
      return this.processUploadJob(job.data);
    });

    // Retry processing worker
    queues.retry.process(1, async (job) => {
      return this.processRetryJob(job.data);
    });

    logger.info('Queue processing workers setup', {
      screenshotWorkers: config.processing.concurrency,
      uploadWorkers: 2,
      retryWorkers: 1,
    });
  }

  /**
   * Process batch of ad records from data source
   */
  public async processBatch(
    dataSource: any,
    options: PipelineOptions = {}
  ): Promise<BatchProcessingResult> {
    const startTime = Date.now();
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      logger.info('Starting batch processing', { batchId, options });

      // Parse data from source
      const records = await this.dataIngestion.parseData(dataSource);
      
      if (records.length === 0) {
        throw new Error('No valid records found in data source');
      }

      // Filter by device types if specified
      const filteredRecords = options.deviceTypes 
        ? records.filter(record => options.deviceTypes!.includes(record.DeviceUI))
        : records;

      // Add jobs to queue
      const jobs = await this.queueManager.addBatchJobs(
        filteredRecords,
        batchId,
        JobPriority.NORMAL
      );

      logger.info('Jobs added to queue', {
        batchId,
        jobCount: jobs.length,
        originalRecords: records.length,
        filteredRecords: filteredRecords.length,
      });

      // Wait for batch completion
      const results = await this.waitForBatchCompletion(batchId, jobs.length);

      const duration = Date.now() - startTime;
      const successCount = results.filter(r => r.success).length;
      const errorCount = results.length - successCount;

      logger.logBatchProcessing(
        batchId,
        results.length,
        successCount,
        errorCount,
        duration
      );

      return {
        totalRecords: results.length,
        successCount,
        errorCount,
        skippedCount: 0,
        errors: results
          .filter(r => !r.success)
          .map(r => ({ record: r.record, error: r.error || 'Unknown error' })),
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Batch processing failed', error, { batchId, duration });
      throw error;
    }
  }

  /**
   * Process single screenshot job
   */
  private async processScreenshotJob(jobData: any): Promise<ProcessingResult> {
    const startTime = Date.now();
    const sessionId = `session_${jobData.id}`;

    try {
      logger.logJobStart(jobData.id, jobData.record.WebsiteURL, jobData.record.DeviceUI);

      // Create browser session
      const session = await this.browserEngine.createSession(
        jobData.record.DeviceUI,
        sessionId
      );

      try {
        // Navigate to URL
        await this.browserEngine.navigateToUrl(
          sessionId,
          jobData.record.WebsiteURL,
          { timeout: config.processing.timeoutMs }
        );

        // Execute bookmarklet if configured
        if (config.processing.concurrency && jobData.record.Selector.includes('bookmarklet:')) {
          await this.executeBookmarkletForJob(sessionId, jobData.record);
        }

        // Wait for selector
        await this.browserEngine.waitForSelector(
          sessionId,
          jobData.record.Selector,
          config.browser.screenshotTimeout
        );

        // Add delay before screenshot
        await this.delay(config.processing.screenshotDelay);

        // Take screenshot
        const screenshotBuffer = await this.browserEngine.takeScreenshot(
          sessionId,
          { selector: jobData.record.Selector }
        );

        // Process and save screenshot
        const screenshotResult = await this.screenshotManager.processAndSave(
          screenshotBuffer,
          jobData.record
        );

        // Add upload job if enabled
        if (config.googleDrive.enabled && screenshotResult.success) {
          await this.queueManager.addUploadJob(
            screenshotResult.filePath!,
            screenshotResult.fileName!,
            { record: jobData.record },
            JobPriority.LOW
          );
        }

        const duration = Date.now() - startTime;
        
        logger.logJobComplete(
          jobData.id,
          jobData.record.WebsiteURL,
          jobData.record.DeviceUI,
          duration,
          screenshotResult.success
        );

        return {
          record: jobData.record,
          success: screenshotResult.success,
          screenshot: screenshotResult,
          duration,
        };

      } finally {
        // Clean up browser session
        await this.browserEngine.destroySession(sessionId);
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.logJobError(
        jobData.id,
        this.categorizeJobError(error),
        error as Error,
        {
          jobId: jobData.id,
          url: jobData.record.WebsiteURL,
          selector: jobData.record.Selector,
          deviceType: jobData.record.DeviceUI,
          retryCount: jobData.retryCount,
          timestamp: new Date(),
        }
      );

      return {
        record: jobData.record,
        success: false,
        error: (error as Error).message,
        duration,
      };
    }
  }

  /**
   * Process upload job
   */
  private async processUploadJob(jobData: any): Promise<any> {
    try {
      const result = await this.uploadService.uploadFile(
        jobData.filePath,
        {
          fileName: jobData.fileName,
          description: `Screenshot from ${jobData.metadata.record?.WebsiteURL || 'unknown'}`,
        },
        jobData.metadata.record
      );

      logger.logUpload(
        result.success,
        jobData.fileName,
        'gdrive',
        { fileId: result.fileId }
      );

      return result;
    } catch (error) {
      logger.logUpload(false, jobData.fileName, 'gdrive', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Process retry job
   */
  private async processRetryJob(jobData: any): Promise<ProcessingResult> {
    logger.info('Processing retry job', {
      jobId: jobData.id,
      retryCount: jobData.retryCount,
      url: jobData.record.WebsiteURL,
    });

    // Use exponential backoff for retry
    const delay = Math.min(1000 * Math.pow(2, jobData.retryCount), 30000);
    await this.delay(delay);

    return this.processScreenshotJob(jobData);
  }

  /**
   * Execute bookmarklet for a job
   */
  private async executeBookmarkletForJob(
    sessionId: string,
    record: AdRecord
  ): Promise<void> {
    try {
      // Extract bookmarklet configuration from selector
      const bookmarkletConfig = this.parseBookmarkletSelector(record.Selector);
      
      const result = await this.bookmarkletExecutor.executeWithRetry(
        sessionId,
        bookmarkletConfig,
        3,
        1000
      );

      if (!result.success) {
        logger.warn('Bookmarklet execution failed', {
          error: result.error,
          record,
        });
      }
    } catch (error) {
      logger.error('Failed to execute bookmarklet', error, { record });
    }
  }

  /**
   * Parse bookmarklet configuration from selector
   */
  private parseBookmarkletSelector(selector: string): BookmarkletConfig {
    // Example: "bookmarklet:element-highlighter:selector=.ad,color=#ff0000"
    const parts = selector.split(':');
    
    if (parts.length < 2 || parts[0] !== 'bookmarklet') {
      throw new Error('Invalid bookmarklet selector format');
    }

    const templateName = parts[1];
    const parameters: Record<string, any> = {};

    if (parts.length > 2) {
      const paramString = parts.slice(2).join(':');
      const paramPairs = paramString.split(',');
      
      for (const pair of paramPairs) {
        const [key, value] = pair.split('=');
        if (key && value) {
          parameters[key.trim()] = value.trim();
        }
      }
    }

    return this.bookmarkletExecutor.createConfigFromTemplate(
      templateName,
      parameters,
      { timeout: 10000 }
    );
  }

  /**
   * Wait for batch completion
   */
  private async waitForBatchCompletion(
    batchId: string,
    expectedCount: number,
    timeoutMs: number = 30 * 60 * 1000 // 30 minutes
  ): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(async () => {
        try {
          // Check if timeout reached
          if (Date.now() - startTime > timeoutMs) {
            clearInterval(checkInterval);
            reject(new Error(`Batch processing timeout after ${timeoutMs}ms`));
            return;
          }

          // Get queue statistics
          const stats = await this.queueManager.getQueueStats();
          const activeJobs = stats.screenshot.active + stats.retry.active;
          const completedJobs = results.length;

          logger.debug('Batch processing progress', {
            batchId,
            expected: expectedCount,
            completed: completedJobs,
            active: activeJobs,
            remaining: expectedCount - completedJobs,
          });

          // Check if all jobs are completed
          if (completedJobs >= expectedCount && activeJobs === 0) {
            clearInterval(checkInterval);
            resolve(results);
          }
        } catch (error) {
          clearInterval(checkInterval);
          reject(error);
        }
      }, 5000); // Check every 5 seconds

      // Note: In a real implementation, you'd listen to job completion events
      // This is a simplified polling approach
    });
  }

  /**
   * Categorize job error for retry logic
   */
  private categorizeJobError(error: Error): ErrorType {
    return errorHandler.categorizeError(error);
  }

  /**
   * Process single record synchronously
   */
  public async processSingle(
    record: AdRecord,
    options: PipelineOptions = {}
  ): Promise<ProcessingResult> {
    const jobData = {
      id: `single_${Date.now()}`,
      record,
      batchId: 'single',
      retryCount: 0,
      priority: JobPriority.HIGH,
      createdAt: new Date(),
      updatedAt: new Date(),
      attempt: 1,
    };

    return this.processScreenshotJob(jobData);
  }

  /**
   * Get processing statistics
   */
  public async getStats(): Promise<{
    queueStats: any;
    activeSessions: number;
    isExtensionConnected: boolean;
    uptime: number;
  }> {
    const queueStats = await this.queueManager.getQueueStats();
    const activeSessions = this.browserEngine.getActiveSessionsCount();
    const isExtensionConnected = this.extensionBridge.isExtensionConnected();

    return {
      queueStats,
      activeSessions,
      isExtensionConnected,
      uptime: process.uptime(),
    };
  }

  /**
   * Pause processing
   */
  public async pause(): Promise<void> {
    await this.queueManager.pauseAllQueues();
    this.isRunning = false;
    logger.info('Processing pipeline paused');
  }

  /**
   * Resume processing
   */
  public async resume(): Promise<void> {
    await this.queueManager.resumeAllQueues();
    this.isRunning = true;
    logger.info('Processing pipeline resumed');
  }

  /**
   * Shutdown the pipeline gracefully
   */
  public async shutdown(): Promise<void> {
    logger.info('Shutting down processing pipeline');

    // Pause new jobs
    await this.pause();

    // Wait for active jobs to complete (with timeout)
    await this.waitForActiveJobsCompletion(60000); // 1 minute timeout

    // Close all services
    await Promise.all([
      this.browserEngine.close(),
      this.extensionBridge.close(),
      this.queueManager.close(),
    ]);

    logger.info('Processing pipeline shutdown complete');
  }

  /**
   * Wait for active jobs to complete
   */
  private async waitForActiveJobsCompletion(timeoutMs: number): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const activeJobs = await this.queueManager.getActiveJobsCount();
      
      if (activeJobs === 0) {
        break;
      }

      logger.debug('Waiting for active jobs to complete', { activeJobs });
      await this.delay(1000);
    }
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Health check for the pipeline
   */
  public async healthCheck(): Promise<{
    healthy: boolean;
    services: Record<string, boolean>;
    errors: string[];
  }> {
    const serviceChecks = {
      browser: await this.browserEngine.isHealthy(),
      queue: true, // Queue manager doesn't have a health check method
      extension: config.chromeExtension.id ? this.extensionBridge.isExtensionConnected() : true,
      upload: config.googleDrive.enabled ? await this.uploadService.testConnection() : true,
    };

    const errors: string[] = [];
    Object.entries(serviceChecks).forEach(([service, healthy]) => {
      if (!healthy) {
        errors.push(`${service} service is unhealthy`);
      }
    });

    return {
      healthy: errors.length === 0,
      services: serviceChecks,
      errors,
    };
  }
}