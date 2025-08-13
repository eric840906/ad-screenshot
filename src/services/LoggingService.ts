/**
 * Comprehensive logging service using Winston
 */

import * as winston from 'winston';
import * as path from 'path';
import * as fs from 'fs-extra';
import { ErrorContext, ErrorType } from '@/types';
import { config } from '@/config';

export class LoggingService {
  private logger!: winston.Logger;
  private errorLogger!: winston.Logger;
  private static instance: LoggingService;

  constructor() {
    this.ensureLogDirectory();
    this.setupLoggers();
  }

  /**
   * Get singleton instance of LoggingService
   */
  public static getInstance(): LoggingService {
    if (!LoggingService.instance) {
      LoggingService.instance = new LoggingService();
    }
    return LoggingService.instance;
  }

  /**
   * Ensure log directory exists
   */
  private ensureLogDirectory(): void {
    fs.ensureDirSync(config.logging.filePath);
  }

  /**
   * Setup Winston loggers with different transports
   */
  private setupLoggers(): void {
    const logFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    );

    const consoleFormat = winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let metaStr = '';
        if (Object.keys(meta).length > 0) {
          metaStr = ` ${JSON.stringify(meta)}`;
        }
        return `${timestamp} [${level}]: ${message}${metaStr}`;
      })
    );

    // Main application logger
    this.logger = winston.createLogger({
      level: config.logging.level,
      format: logFormat,
      transports: [
        // Console transport
        new winston.transports.Console({
          format: consoleFormat,
          level: config.env === 'production' ? 'info' : 'debug',
        }),
        
        // File transport for all logs
        new winston.transports.File({
          filename: path.join(config.logging.filePath, 'application.log'),
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5,
          tailable: true,
        }),
        
        // Separate file for info and above
        new winston.transports.File({
          filename: path.join(config.logging.filePath, 'info.log'),
          level: 'info',
          maxsize: 10 * 1024 * 1024,
          maxFiles: 5,
          tailable: true,
        }),
      ],
    });

    // Dedicated error logger
    this.errorLogger = winston.createLogger({
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({
          filename: path.join(
            config.logging.filePath,
            `error_${new Date().toISOString().split('T')[0]}.log`
          ),
          maxsize: 50 * 1024 * 1024, // 50MB
          maxFiles: 10,
          tailable: true,
        }),
      ],
    });

    // Handle uncaught exceptions and unhandled rejections
    this.logger.exceptions.handle(
      new winston.transports.File({
        filename: path.join(config.logging.filePath, 'exceptions.log'),
      })
    );

    this.logger.rejections.handle(
      new winston.transports.File({
        filename: path.join(config.logging.filePath, 'rejections.log'),
      })
    );
  }

  /**
   * Log debug message
   */
  public debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }

  /**
   * Log info message
   */
  public info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  /**
   * Log warning message
   */
  public warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  /**
   * Log error message
   */
  public error(message: string, error?: Error | any, meta?: any): void {
    const errorMeta = {
      ...meta,
      ...(error && {
        error: {
          message: (error as Error).message,
          stack: error.stack,
          name: error.name,
        },
      }),
    };

    this.logger.error(message, errorMeta);
    this.errorLogger.error(message, errorMeta);
  }

  /**
   * Log processing job start
   */
  public logJobStart(jobId: string, url: string, deviceType: string): void {
    this.info('Processing job started', {
      jobId,
      url,
      deviceType,
      action: 'job_start',
    });
  }

  /**
   * Log processing job completion
   */
  public logJobComplete(
    jobId: string,
    url: string,
    deviceType: string,
    duration: number,
    success: boolean
  ): void {
    this.info('Processing job completed', {
      jobId,
      url,
      deviceType,
      duration,
      success,
      action: 'job_complete',
    });
  }

  /**
   * Log processing job error with context
   */
  public logJobError(
    jobId: string,
    errorType: ErrorType,
    error: Error,
    context: ErrorContext
  ): void {
    this.error('Processing job failed', error, {
      jobId,
      errorType,
      context,
      action: 'job_error',
    });
  }

  /**
   * Log browser session events
   */
  public logBrowserSession(
    action: 'created' | 'destroyed' | 'crashed',
    sessionId: string,
    meta?: any
  ): void {
    this.info(`Browser session ${action}`, {
      sessionId,
      action: `browser_${action}`,
      ...meta,
    });
  }

  /**
   * Log screenshot capture events
   */
  public logScreenshot(
    success: boolean,
    fileName: string,
    url: string,
    selector: string,
    meta?: any
  ): void {
    this.info(`Screenshot ${success ? 'captured' : 'failed'}`, {
      success,
      fileName,
      url,
      selector,
      action: 'screenshot',
      ...meta,
    });
  }

  /**
   * Log file upload events
   */
  public logUpload(
    success: boolean,
    fileName: string,
    destination: 'local' | 'gdrive',
    meta?: any
  ): void {
    this.info(`File upload ${success ? 'successful' : 'failed'}`, {
      success,
      fileName,
      destination,
      action: 'upload',
      ...meta,
    });
  }

  /**
   * Log batch processing results
   */
  public logBatchProcessing(
    batchId: string,
    totalRecords: number,
    successCount: number,
    errorCount: number,
    duration: number
  ): void {
    this.info('Batch processing completed', {
      batchId,
      totalRecords,
      successCount,
      errorCount,
      duration,
      successRate: ((successCount / totalRecords) * 100).toFixed(2) + '%',
      action: 'batch_complete',
    });
  }

  /**
   * Log system performance metrics
   */
  public logPerformanceMetrics(metrics: {
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
    activeJobs: number;
    queueSize: number;
  }): void {
    this.debug('Performance metrics', {
      ...metrics,
      action: 'performance_metrics',
    });
  }

  /**
   * Log queue events
   */
  public logQueueEvent(
    event: 'job_added' | 'job_completed' | 'job_failed' | 'job_stalled',
    jobId: string,
    meta?: any
  ): void {
    const level = event === 'job_failed' || event === 'job_stalled' ? 'warn' : 'debug';
    this.logger.log(level, `Queue event: ${event}`, {
      jobId,
      event,
      action: 'queue_event',
      ...meta,
    });
  }

  /**
   * Create a child logger with additional context
   */
  public createChildLogger(context: Record<string, any>): winston.Logger {
    return this.logger.child(context);
  }

  /**
   * Log structured event with custom metadata
   */
  public logEvent(
    level: 'error' | 'warn' | 'info' | 'debug',
    action: string,
    message: string,
    metadata?: any
  ): void {
    this.logger.log(level, message, {
      action,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  }

  /**
   * Get log statistics
   */
  public getLogStats(): Promise<{
    errorCount: number;
    warningCount: number;
    infoCount: number;
    lastError?: Date;
  }> {
    // This is a simplified implementation
    // In production, you might want to use a more sophisticated approach
    return Promise.resolve({
      errorCount: 0,
      warningCount: 0,
      infoCount: 0,
    });
  }

  /**
   * Flush all log transports
   */
  public async flush(): Promise<void> {
    return new Promise((resolve) => {
      this.logger.on('finish', resolve);
      this.logger.end();
    });
  }
}

// Export singleton instance
export const logger = LoggingService.getInstance();