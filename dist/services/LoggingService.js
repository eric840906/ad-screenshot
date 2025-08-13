"use strict";
/**
 * Comprehensive logging service using Winston
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.LoggingService = void 0;
const winston = __importStar(require("winston"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs-extra"));
const config_1 = require("../config");
class LoggingService {
    logger;
    errorLogger;
    static instance;
    constructor() {
        this.ensureLogDirectory();
        this.setupLoggers();
    }
    /**
     * Get singleton instance of LoggingService
     */
    static getInstance() {
        if (!LoggingService.instance) {
            LoggingService.instance = new LoggingService();
        }
        return LoggingService.instance;
    }
    /**
     * Ensure log directory exists
     */
    ensureLogDirectory() {
        fs.ensureDirSync(config_1.config.logging.filePath);
    }
    /**
     * Setup Winston loggers with different transports
     */
    setupLoggers() {
        const logFormat = winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json());
        const consoleFormat = winston.format.combine(winston.format.colorize(), winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston.format.printf(({ timestamp, level, message, ...meta }) => {
            let metaStr = '';
            if (Object.keys(meta).length > 0) {
                metaStr = ` ${JSON.stringify(meta)}`;
            }
            return `${timestamp} [${level}]: ${message}${metaStr}`;
        }));
        // Main application logger
        this.logger = winston.createLogger({
            level: config_1.config.logging.level,
            format: logFormat,
            transports: [
                // Console transport
                new winston.transports.Console({
                    format: consoleFormat,
                    level: config_1.config.env === 'production' ? 'info' : 'debug',
                }),
                // File transport for all logs
                new winston.transports.File({
                    filename: path.join(config_1.config.logging.filePath, 'application.log'),
                    maxsize: 10 * 1024 * 1024, // 10MB
                    maxFiles: 5,
                    tailable: true,
                }),
                // Separate file for info and above
                new winston.transports.File({
                    filename: path.join(config_1.config.logging.filePath, 'info.log'),
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
            format: winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json()),
            transports: [
                new winston.transports.File({
                    filename: path.join(config_1.config.logging.filePath, `error_${new Date().toISOString().split('T')[0]}.log`),
                    maxsize: 50 * 1024 * 1024, // 50MB
                    maxFiles: 10,
                    tailable: true,
                }),
            ],
        });
        // Handle uncaught exceptions and unhandled rejections
        this.logger.exceptions.handle(new winston.transports.File({
            filename: path.join(config_1.config.logging.filePath, 'exceptions.log'),
        }));
        this.logger.rejections.handle(new winston.transports.File({
            filename: path.join(config_1.config.logging.filePath, 'rejections.log'),
        }));
    }
    /**
     * Log debug message
     */
    debug(message, meta) {
        this.logger.debug(message, meta);
    }
    /**
     * Log info message
     */
    info(message, meta) {
        this.logger.info(message, meta);
    }
    /**
     * Log warning message
     */
    warn(message, meta) {
        this.logger.warn(message, meta);
    }
    /**
     * Log error message
     */
    error(message, error, meta) {
        const errorMeta = {
            ...meta,
            ...(error && {
                error: {
                    message: error.message,
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
    logJobStart(jobId, url, deviceType) {
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
    logJobComplete(jobId, url, deviceType, duration, success) {
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
    logJobError(jobId, errorType, error, context) {
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
    logBrowserSession(action, sessionId, meta) {
        this.info(`Browser session ${action}`, {
            sessionId,
            action: `browser_${action}`,
            ...meta,
        });
    }
    /**
     * Log screenshot capture events
     */
    logScreenshot(success, fileName, url, selector, meta) {
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
    logUpload(success, fileName, destination, meta) {
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
    logBatchProcessing(batchId, totalRecords, successCount, errorCount, duration) {
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
    logPerformanceMetrics(metrics) {
        this.debug('Performance metrics', {
            ...metrics,
            action: 'performance_metrics',
        });
    }
    /**
     * Log queue events
     */
    logQueueEvent(event, jobId, meta) {
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
    createChildLogger(context) {
        return this.logger.child(context);
    }
    /**
     * Log structured event with custom metadata
     */
    logEvent(level, action, message, metadata) {
        this.logger.log(level, message, {
            action,
            timestamp: new Date().toISOString(),
            ...metadata,
        });
    }
    /**
     * Get log statistics
     */
    getLogStats() {
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
    async flush() {
        return new Promise((resolve) => {
            this.logger.on('finish', resolve);
            this.logger.end();
        });
    }
}
exports.LoggingService = LoggingService;
// Export singleton instance
exports.logger = LoggingService.getInstance();
//# sourceMappingURL=LoggingService.js.map