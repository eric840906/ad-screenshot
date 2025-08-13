/**
 * Main processing pipeline that orchestrates all services
 */
import { AdRecord, BatchProcessingResult, DeviceType, ScreenshotResult } from '../types';
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
export declare class ProcessingPipeline {
    private dataIngestion;
    private queueManager;
    private browserEngine;
    private bookmarkletExecutor;
    private extensionBridge;
    private screenshotManager;
    private uploadService;
    private static instance;
    constructor();
    /**
     * Get singleton instance
     */
    static getInstance(): ProcessingPipeline;
    /**
     * Initialize all services
     */
    private initializeServices;
    /**
     * Initialize the entire system
     */
    initialize(): Promise<void>;
    /**
     * Setup queue processing workers
     */
    private setupQueueProcessing;
    /**
     * Process batch of ad records from data source
     */
    processBatch(dataSource: any, options?: PipelineOptions): Promise<BatchProcessingResult>;
    /**
     * Process single screenshot job
     */
    private processScreenshotJob;
    /**
     * Process upload job
     */
    private processUploadJob;
    /**
     * Process retry job
     */
    private processRetryJob;
    /**
     * Execute bookmarklet for a job
     */
    private executeBookmarkletForJob;
    /**
     * Parse bookmarklet configuration from selector
     */
    private parseBookmarkletSelector;
    /**
     * Execute company AD543 bookmarklet for job
     */
    private executeAD543BookmarkletForJob;
    /**
     * Configure AD543 based on record configuration
     */
    private configureAD543ForRecord;
    /**
     * Execute AD543 ad injection (Shift+R functionality)
     */
    private executeAD543AdInjection;
    /**
     * Wait for injected ad to render completely
     */
    private waitForAdToRender;
    /**
     * Wait for batch completion
     */
    private waitForBatchCompletion;
    /**
     * Categorize job error for retry logic
     */
    private categorizeJobError;
    /**
     * Process single record synchronously
     */
    processSingle(record: AdRecord, _options?: PipelineOptions): Promise<ProcessingResult>;
    /**
     * Get processing statistics
     */
    getStats(): Promise<{
        queueStats: any;
        activeSessions: number;
        isExtensionConnected: boolean;
        uptime: number;
    }>;
    /**
     * Pause processing
     */
    pause(): Promise<void>;
    /**
     * Resume processing
     */
    resume(): Promise<void>;
    /**
     * Shutdown the pipeline gracefully
     */
    shutdown(): Promise<void>;
    /**
     * Wait for active jobs to complete
     */
    private waitForActiveJobsCompletion;
    /**
     * Utility delay function
     */
    private delay;
    /**
     * Health check for the pipeline
     */
    healthCheck(): Promise<{
        healthy: boolean;
        services: Record<string, boolean>;
        errors: string[];
    }>;
}
//# sourceMappingURL=ProcessingPipeline.d.ts.map