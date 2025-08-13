"use strict";
/**
 * Main processing pipeline that orchestrates all services
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessingPipeline = void 0;
const types_1 = require("../types");
const DataIngestionService_1 = require("./DataIngestionService");
const QueueManager_1 = require("./QueueManager");
const BrowserAutomationEngine_1 = require("./BrowserAutomationEngine");
const BookmarkletExecutor_1 = require("./BookmarkletExecutor");
const ChromeExtensionBridge_1 = require("./ChromeExtensionBridge");
const ScreenshotManager_1 = require("./ScreenshotManager");
// import { FileStorageService } from './FileStorageService';
const UploadService_1 = require("./UploadService");
const LoggingService_1 = require("./LoggingService");
const ErrorHandler_1 = require("../utils/ErrorHandler");
const config_1 = require("../config");
class ProcessingPipeline {
    dataIngestion;
    queueManager;
    browserEngine;
    bookmarkletExecutor;
    extensionBridge;
    screenshotManager;
    // private _fileStorage!: FileStorageService;
    uploadService;
    // private _isRunning: boolean = false;
    // private _activeJobs: Map<string, ProcessingJob> = new Map();
    static instance;
    constructor() {
        this.initializeServices();
    }
    /**
     * Get singleton instance
     */
    static getInstance() {
        if (!ProcessingPipeline.instance) {
            ProcessingPipeline.instance = new ProcessingPipeline();
        }
        return ProcessingPipeline.instance;
    }
    /**
     * Initialize all services
     */
    initializeServices() {
        this.dataIngestion = new DataIngestionService_1.DataIngestionService();
        this.queueManager = QueueManager_1.QueueManager.getInstance();
        this.browserEngine = BrowserAutomationEngine_1.BrowserAutomationEngine.getInstance();
        this.bookmarkletExecutor = BookmarkletExecutor_1.BookmarkletExecutor.getInstance();
        this.extensionBridge = ChromeExtensionBridge_1.ChromeExtensionBridge.getInstance();
        this.screenshotManager = ScreenshotManager_1.ScreenshotManager.getInstance();
        // this._fileStorage = FileStorageService.getInstance();
        this.uploadService = UploadService_1.UploadService.getInstance();
        LoggingService_1.logger.info('Processing pipeline initialized');
    }
    /**
     * Initialize the entire system
     */
    async initialize() {
        try {
            // Initialize browser engine
            await this.browserEngine.initialize();
            // Initialize Chrome extension bridge if enabled
            if (config_1.config.chromeExtension.id) {
                await this.extensionBridge.initialize();
            }
            // Setup queue processing
            this.setupQueueProcessing();
            LoggingService_1.logger.info('Processing pipeline fully initialized');
        }
        catch (error) {
            LoggingService_1.logger.error('Failed to initialize processing pipeline', error);
            throw error;
        }
    }
    /**
     * Setup queue processing workers
     */
    setupQueueProcessing() {
        const queues = this.queueManager.getQueues();
        // Screenshot processing worker
        queues.screenshot.process(config_1.config.processing.concurrency, async (job) => {
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
        LoggingService_1.logger.info('Queue processing workers setup', {
            screenshotWorkers: config_1.config.processing.concurrency,
            uploadWorkers: 2,
            retryWorkers: 1,
        });
    }
    /**
     * Process batch of ad records from data source
     */
    async processBatch(dataSource, options = {}) {
        const startTime = Date.now();
        const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        try {
            LoggingService_1.logger.info('Starting batch processing', { batchId, options });
            // Parse data from source
            const records = await this.dataIngestion.parseData(dataSource);
            if (records.length === 0) {
                throw new Error('No valid records found in data source');
            }
            // Filter by device types if specified
            const filteredRecords = options.deviceTypes
                ? records.filter(record => options.deviceTypes.includes(record.DeviceUI))
                : records;
            // Add jobs to queue
            const jobs = await this.queueManager.addBatchJobs(filteredRecords, batchId, types_1.JobPriority.NORMAL);
            LoggingService_1.logger.info('Jobs added to queue', {
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
            LoggingService_1.logger.logBatchProcessing(batchId, results.length, successCount, errorCount, duration);
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
        }
        catch (error) {
            const duration = Date.now() - startTime;
            LoggingService_1.logger.error('Batch processing failed', error, { batchId, duration });
            throw error;
        }
    }
    /**
     * Process single screenshot job
     */
    async processScreenshotJob(jobData) {
        const startTime = Date.now();
        const sessionId = `session_${jobData.id}`;
        try {
            LoggingService_1.logger.logJobStart(jobData.id, jobData.record.WebsiteURL, jobData.record.DeviceUI);
            // Create browser session
            await this.browserEngine.createSession(jobData.record.DeviceUI, sessionId);
            try {
                // Navigate to URL
                await this.browserEngine.navigateToUrl(sessionId, jobData.record.WebsiteURL, { timeout: config_1.config.processing.timeoutMs });
                // Execute bookmarklet if configured
                if (jobData.record.Selector.includes('bookmarklet:')) {
                    await this.executeBookmarkletForJob(sessionId, jobData.record);
                }
                else if (jobData.record.BookmarkletType === 'AD543' || jobData.record.AdType === 'AD543') {
                    // Execute company AD543 bookmarklet
                    await this.executeAD543BookmarkletForJob(sessionId, jobData.record);
                }
                // Wait for selector
                await this.browserEngine.waitForSelector(sessionId, jobData.record.Selector, config_1.config.browser.screenshotTimeout);
                // Add delay before screenshot
                await this.delay(config_1.config.processing.screenshotDelay);
                // Take screenshot with mobile UI overlay if device is mobile
                let screenshotBuffer;
                if (jobData.record.DeviceUI === 'Android' || jobData.record.DeviceUI === 'iOS') {
                    // Use enhanced Chrome extension for mobile screenshot with UI overlay
                    const deviceType = jobData.record.DeviceUI.toLowerCase();
                    try {
                        screenshotBuffer = await this.extensionBridge.triggerAD543Screenshot(sessionId, deviceType, {
                            waitForAd: true,
                            timeout: 15000
                        });
                        LoggingService_1.logger.debug('Mobile screenshot with UI overlay captured', {
                            sessionId,
                            deviceType,
                            bufferSize: screenshotBuffer.length
                        });
                    }
                    catch (error) {
                        LoggingService_1.logger.warn('Mobile screenshot failed, falling back to standard screenshot', {
                            error,
                            sessionId,
                            deviceType
                        });
                        // Fallback to standard screenshot
                        screenshotBuffer = await this.browserEngine.takeScreenshot(sessionId, { selector: jobData.record.Selector });
                    }
                }
                else {
                    // Desktop screenshot - use standard browser engine
                    screenshotBuffer = await this.browserEngine.takeScreenshot(sessionId, { selector: jobData.record.Selector });
                }
                // Process and save screenshot
                const screenshotResult = await this.screenshotManager.processAndSave(screenshotBuffer, jobData.record);
                // Add upload job if enabled
                if (config_1.config.googleDrive.enabled && screenshotResult.success) {
                    await this.queueManager.addUploadJob(screenshotResult.filePath, screenshotResult.fileName, { record: jobData.record }, types_1.JobPriority.LOW);
                }
                const duration = Date.now() - startTime;
                LoggingService_1.logger.logJobComplete(jobData.id, jobData.record.WebsiteURL, jobData.record.DeviceUI, duration, screenshotResult.success);
                return {
                    record: jobData.record,
                    success: screenshotResult.success,
                    screenshot: screenshotResult,
                    duration,
                };
            }
            finally {
                // Clean up browser session
                await this.browserEngine.destroySession(sessionId);
            }
        }
        catch (error) {
            const duration = Date.now() - startTime;
            LoggingService_1.logger.logJobError(jobData.id, this.categorizeJobError(error), error, {
                jobId: jobData.id,
                url: jobData.record.WebsiteURL,
                selector: jobData.record.Selector,
                deviceType: jobData.record.DeviceUI,
                retryCount: jobData.retryCount,
                timestamp: new Date(),
            });
            return {
                record: jobData.record,
                success: false,
                error: error.message,
                duration,
            };
        }
    }
    /**
     * Process upload job
     */
    async processUploadJob(jobData) {
        try {
            const result = await this.uploadService.uploadFile(jobData.filePath, {
                fileName: jobData.fileName,
                description: `Screenshot from ${jobData.metadata.record?.WebsiteURL || 'unknown'}`,
            }, jobData.metadata.record);
            LoggingService_1.logger.logUpload(result.success, jobData.fileName, 'gdrive', { fileId: result.fileId });
            return result;
        }
        catch (error) {
            LoggingService_1.logger.logUpload(false, jobData.fileName, 'gdrive', { error: error.message });
            throw error;
        }
    }
    /**
     * Process retry job
     */
    async processRetryJob(jobData) {
        LoggingService_1.logger.info('Processing retry job', {
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
    async executeBookmarkletForJob(sessionId, record) {
        try {
            // Extract bookmarklet configuration from selector
            const bookmarkletConfig = this.parseBookmarkletSelector(record.Selector);
            const result = await this.bookmarkletExecutor.executeWithRetry(sessionId, bookmarkletConfig, 3, 1000);
            if (!result.success) {
                LoggingService_1.logger.warn('Bookmarklet execution failed', {
                    error: result.error,
                    record,
                });
            }
        }
        catch (error) {
            LoggingService_1.logger.error('Failed to execute bookmarklet', error, { record });
        }
    }
    /**
     * Parse bookmarklet configuration from selector
     */
    parseBookmarkletSelector(selector) {
        // Example: "bookmarklet:element-highlighter:selector=.ad,color=#ff0000"
        const parts = selector.split(':');
        if (parts.length < 2 || parts[0] !== 'bookmarklet') {
            throw new Error('Invalid bookmarklet selector format');
        }
        const templateName = parts[1];
        const parameters = {};
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
        return this.bookmarkletExecutor.createConfigFromTemplate(templateName, parameters, { timeout: 10000 });
    }
    /**
     * Execute company AD543 bookmarklet for job
     */
    async executeAD543BookmarkletForJob(sessionId, record) {
        try {
            LoggingService_1.logger.debug('Executing AD543 advanced automation', {
                sessionId,
                url: record.WebsiteURL,
                deviceUI: record.DeviceUI,
                adType: record.AD543Type || 'outstream'
            });
            // Step 1: Execute AD543 bookmarklet to load the system
            const result = await this.bookmarkletExecutor.executeAD543Bookmarklet(sessionId, {
                openPanel: false,
                waitForReady: true,
                timeout: 30000
            });
            if (!result.success) {
                throw new Error(`AD543 bookmarklet failed: ${result.error}`);
            }
            // Wait for AD543 to fully initialize
            await this.delay(3000);
            // Step 2: Configure AD543 based on record type
            await this.configureAD543ForRecord(sessionId, record);
            // Step 3: Execute ad injection
            await this.executeAD543AdInjection(sessionId, record);
            // Step 4: Wait for ad to load and render
            await this.waitForAdToRender(sessionId, record);
            LoggingService_1.logger.debug('AD543 automation completed successfully', {
                sessionId,
                adType: record.AD543Type || 'outstream'
            });
        }
        catch (error) {
            LoggingService_1.logger.error('Failed to execute AD543 automation', error, {
                sessionId,
                url: record.WebsiteURL,
                adType: record.AD543Type
            });
            throw error;
        }
    }
    /**
     * Configure AD543 based on record configuration
     */
    async configureAD543ForRecord(sessionId, record) {
        const adType = record.AD543Type || 'outstream';
        LoggingService_1.logger.debug('Configuring AD543', { sessionId, adType, record });
        switch (adType.toLowerCase()) {
            case 'outstream':
                const outstreamResult = await this.bookmarkletExecutor.configureAD543Outstream(sessionId, {
                    source: record.AD543Source || 'staging',
                    playMode: record.AD543PlayMode || 'MIR',
                    pid: record.PID,
                    uid: record.UID,
                    selector: record.Selector || '.content-area'
                });
                if (!outstreamResult.success) {
                    throw new Error(`Failed to configure outstream: ${outstreamResult.error}`);
                }
                break;
            case 'instream':
                const instreamResult = await this.bookmarkletExecutor.configureAD543Instream(sessionId, {
                    player: record.AD543Player || 'glia',
                    videoUrl: record.AD543VideoUrl || '',
                    clickUrl: record.AD543ClickUrl || ''
                });
                if (!instreamResult.success) {
                    throw new Error(`Failed to configure instream: ${instreamResult.error}`);
                }
                break;
            case 'dv360':
                const dv360Result = await this.bookmarkletExecutor.configureAD543DV360(sessionId, {
                    campaignUrl: record.AD543CampaignUrl || '',
                    targetIframe: record.AD543TargetIframe || ''
                });
                if (!dv360Result.success) {
                    throw new Error(`Failed to configure DV360: ${dv360Result.error}`);
                }
                break;
            default:
                LoggingService_1.logger.warn('Unknown AD543 type, using default outstream', { sessionId, adType });
                // Fallback to outstream configuration
                await this.bookmarkletExecutor.configureAD543Outstream(sessionId, {
                    source: 'staging',
                    playMode: 'MIR',
                    pid: record.PID,
                    uid: record.UID,
                    selector: record.Selector || '.content-area'
                });
        }
    }
    /**
     * Execute AD543 ad injection (Shift+R functionality)
     */
    async executeAD543AdInjection(sessionId, record) {
        LoggingService_1.logger.debug('Executing AD543 ad injection', { sessionId });
        const injectionResult = await this.bookmarkletExecutor.executeAD543Injection(sessionId, record.Selector || '.content-area');
        if (!injectionResult.success) {
            throw new Error(`Ad injection failed: ${injectionResult.error}`);
        }
        LoggingService_1.logger.debug('Ad injection completed', { sessionId });
    }
    /**
     * Wait for injected ad to render completely
     */
    async waitForAdToRender(sessionId, record) {
        const adType = record.AD543Type || 'outstream';
        const maxWaitTime = 15000; // 15 seconds
        const checkInterval = 1000; // 1 second
        const startTime = Date.now();
        LoggingService_1.logger.debug('Waiting for ad to render', { sessionId, adType });
        while (Date.now() - startTime < maxWaitTime) {
            try {
                const isRendered = await this.browserEngine.executeBrowserScript(sessionId, `
          // Check for common ad indicators based on type
          const adType = '${adType.toLowerCase()}';
          
          if (adType === 'outstream') {
            // Look for OneAD containers
            const oneadContainers = document.querySelectorAll('[id*="onead"], [class*="onead"]');
            if (oneadContainers.length > 0) {
              // Check if any container has actual content
              for (const container of oneadContainers) {
                if (container.innerHTML.trim().length > 100) {
                  return true;
                }
              }
            }
          } else if (adType === 'instream') {
            // Look for video players
            const gliaPlayer = document.querySelector('.gliaplayer-container video');
            const truvidPlayer = document.querySelector('.trv-player-container video');
            if (gliaPlayer || truvidPlayer) {
              return true;
            }
          } else if (adType === 'dv360') {
            // Look for DV360 iframe modifications
            const iframes = document.querySelectorAll('iframe');
            for (const iframe of iframes) {
              if (iframe.src && iframe.src.includes('doubleclick')) {
                return true;
              }
            }
          }
          
          return false;
        `);
                if (isRendered) {
                    LoggingService_1.logger.debug('Ad successfully rendered', {
                        sessionId,
                        adType,
                        renderTime: Date.now() - startTime
                    });
                    return;
                }
                await this.delay(checkInterval);
            }
            catch (error) {
                LoggingService_1.logger.warn('Error checking ad render status', { error, sessionId });
                await this.delay(checkInterval);
            }
        }
        LoggingService_1.logger.warn('Ad render timeout - proceeding anyway', {
            sessionId,
            adType,
            waitTime: Date.now() - startTime
        });
    }
    /**
     * Wait for batch completion
     */
    async waitForBatchCompletion(batchId, expectedCount, timeoutMs = 30 * 60 * 1000 // 30 minutes
    ) {
        const results = [];
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
                    LoggingService_1.logger.debug('Batch processing progress', {
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
                }
                catch (error) {
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
    categorizeJobError(error) {
        return ErrorHandler_1.errorHandler.categorizeError(error);
    }
    /**
     * Process single record synchronously
     */
    async processSingle(record, _options = {}) {
        const jobData = {
            id: `single_${Date.now()}`,
            record,
            batchId: 'single',
            retryCount: 0,
            priority: types_1.JobPriority.HIGH,
            createdAt: new Date(),
            updatedAt: new Date(),
            attempt: 1,
        };
        return this.processScreenshotJob(jobData);
    }
    /**
     * Get processing statistics
     */
    async getStats() {
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
    async pause() {
        await this.queueManager.pauseAllQueues();
        // this._isRunning = false;
        LoggingService_1.logger.info('Processing pipeline paused');
    }
    /**
     * Resume processing
     */
    async resume() {
        await this.queueManager.resumeAllQueues();
        // this._isRunning = true;
        LoggingService_1.logger.info('Processing pipeline resumed');
    }
    /**
     * Shutdown the pipeline gracefully
     */
    async shutdown() {
        LoggingService_1.logger.info('Shutting down processing pipeline');
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
        LoggingService_1.logger.info('Processing pipeline shutdown complete');
    }
    /**
     * Wait for active jobs to complete
     */
    async waitForActiveJobsCompletion(timeoutMs) {
        const startTime = Date.now();
        while (Date.now() - startTime < timeoutMs) {
            const activeJobs = await this.queueManager.getActiveJobsCount();
            if (activeJobs === 0) {
                break;
            }
            LoggingService_1.logger.debug('Waiting for active jobs to complete', { activeJobs });
            await this.delay(1000);
        }
    }
    /**
     * Utility delay function
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Health check for the pipeline
     */
    async healthCheck() {
        const serviceChecks = {
            browser: await this.browserEngine.isHealthy(),
            queue: true, // Queue manager doesn't have a health check method
            extension: config_1.config.chromeExtension.id ? this.extensionBridge.isExtensionConnected() : true,
            upload: config_1.config.googleDrive.enabled ? await this.uploadService.testConnection() : true,
        };
        const errors = [];
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
exports.ProcessingPipeline = ProcessingPipeline;
//# sourceMappingURL=ProcessingPipeline.js.map