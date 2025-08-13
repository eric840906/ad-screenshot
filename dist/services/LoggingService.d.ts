/**
 * Comprehensive logging service using Winston
 */
import * as winston from 'winston';
import { ErrorContext, ErrorType } from '../types';
export declare class LoggingService {
    private logger;
    private errorLogger;
    private static instance;
    constructor();
    /**
     * Get singleton instance of LoggingService
     */
    static getInstance(): LoggingService;
    /**
     * Ensure log directory exists
     */
    private ensureLogDirectory;
    /**
     * Setup Winston loggers with different transports
     */
    private setupLoggers;
    /**
     * Log debug message
     */
    debug(message: string, meta?: any): void;
    /**
     * Log info message
     */
    info(message: string, meta?: any): void;
    /**
     * Log warning message
     */
    warn(message: string, meta?: any): void;
    /**
     * Log error message
     */
    error(message: string, error?: Error | any, meta?: any): void;
    /**
     * Log processing job start
     */
    logJobStart(jobId: string, url: string, deviceType: string): void;
    /**
     * Log processing job completion
     */
    logJobComplete(jobId: string, url: string, deviceType: string, duration: number, success: boolean): void;
    /**
     * Log processing job error with context
     */
    logJobError(jobId: string, errorType: ErrorType, error: Error, context: ErrorContext): void;
    /**
     * Log browser session events
     */
    logBrowserSession(action: 'created' | 'destroyed' | 'crashed', sessionId: string, meta?: any): void;
    /**
     * Log screenshot capture events
     */
    logScreenshot(success: boolean, fileName: string, url: string, selector: string, meta?: any): void;
    /**
     * Log file upload events
     */
    logUpload(success: boolean, fileName: string, destination: 'local' | 'gdrive', meta?: any): void;
    /**
     * Log batch processing results
     */
    logBatchProcessing(batchId: string, totalRecords: number, successCount: number, errorCount: number, duration: number): void;
    /**
     * Log system performance metrics
     */
    logPerformanceMetrics(metrics: {
        memoryUsage: NodeJS.MemoryUsage;
        cpuUsage: NodeJS.CpuUsage;
        activeJobs: number;
        queueSize: number;
    }): void;
    /**
     * Log queue events
     */
    logQueueEvent(event: 'job_added' | 'job_completed' | 'job_failed' | 'job_stalled', jobId: string, meta?: any): void;
    /**
     * Create a child logger with additional context
     */
    createChildLogger(context: Record<string, any>): winston.Logger;
    /**
     * Log structured event with custom metadata
     */
    logEvent(level: 'error' | 'warn' | 'info' | 'debug', action: string, message: string, metadata?: any): void;
    /**
     * Get log statistics
     */
    getLogStats(): Promise<{
        errorCount: number;
        warningCount: number;
        infoCount: number;
        lastError?: Date;
    }>;
    /**
     * Flush all log transports
     */
    flush(): Promise<void>;
}
export declare const logger: LoggingService;
//# sourceMappingURL=LoggingService.d.ts.map