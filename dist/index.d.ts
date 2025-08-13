/**
 * Main entry point for Ad Screenshot Automation System
 */
import { ProcessingPipeline } from './services/ProcessingPipeline';
import { DataSource } from './services/DataIngestionService';
export interface AutomationSystemOptions {
    dataSource: DataSource;
    concurrency?: number;
    enableUpload?: boolean;
    enableBookmarklet?: boolean;
    enableExtension?: boolean;
}
export declare class AdScreenshotAutomationSystem {
    private pipeline;
    private isInitialized;
    constructor();
    /**
     * Get the processing pipeline instance
     */
    get processingPipeline(): ProcessingPipeline;
    /**
     * Initialize the system
     */
    initialize(): Promise<void>;
    /**
     * Run the automation system with provided options
     */
    run(options: AutomationSystemOptions): Promise<void>;
    /**
     * Get system status
     */
    getStatus(): Promise<any>;
    /**
     * Shutdown the system gracefully
     */
    shutdown(): Promise<void>;
    /**
     * Setup graceful shutdown handlers
     */
    private setupShutdownHandlers;
}
export { ProcessingPipeline } from './services/ProcessingPipeline';
export { DataIngestionService, DataSource } from './services/DataIngestionService';
export { BrowserAutomationEngine } from './services/BrowserAutomationEngine';
export { BookmarkletExecutor } from './services/BookmarkletExecutor';
export { ChromeExtensionBridge } from './services/ChromeExtensionBridge';
export { ScreenshotManager } from './services/ScreenshotManager';
export { FileStorageService } from './services/FileStorageService';
export { UploadService } from './services/UploadService';
export { QueueManager } from './services/QueueManager';
export { logger } from './services/LoggingService';
export * from './types';
export { config } from './config';
export default AdScreenshotAutomationSystem;
//# sourceMappingURL=index.d.ts.map