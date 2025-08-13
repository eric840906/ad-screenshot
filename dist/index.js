"use strict";
/**
 * Main entry point for Ad Screenshot Automation System
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = exports.logger = exports.QueueManager = exports.UploadService = exports.FileStorageService = exports.ScreenshotManager = exports.ChromeExtensionBridge = exports.BookmarkletExecutor = exports.BrowserAutomationEngine = exports.DataIngestionService = exports.ProcessingPipeline = exports.AdScreenshotAutomationSystem = void 0;
const ProcessingPipeline_1 = require("./services/ProcessingPipeline");
const LoggingService_1 = require("./services/LoggingService");
const config_1 = require("./config");
const process = __importStar(require("process"));
class AdScreenshotAutomationSystem {
    pipeline;
    isInitialized = false;
    constructor() {
        this.pipeline = ProcessingPipeline_1.ProcessingPipeline.getInstance();
        this.setupShutdownHandlers();
    }
    /**
     * Get the processing pipeline instance
     */
    get processingPipeline() {
        return this.pipeline;
    }
    /**
     * Initialize the system
     */
    async initialize() {
        try {
            LoggingService_1.logger.info('Initializing Ad Screenshot Automation System', {
                version: '1.0.0',
                environment: config_1.config.env,
                nodeVersion: process.version,
            });
            // Validate configuration
            (0, config_1.validateConfig)();
            // Initialize the processing pipeline
            await this.pipeline.initialize();
            this.isInitialized = true;
            LoggingService_1.logger.info('Ad Screenshot Automation System initialized successfully');
        }
        catch (error) {
            LoggingService_1.logger.error('Failed to initialize system', error);
            throw error;
        }
    }
    /**
     * Run the automation system with provided options
     */
    async run(options) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        try {
            LoggingService_1.logger.info('Starting automation run', { options });
            const result = await this.pipeline.processBatch(options.dataSource, {
                concurrency: options.concurrency || config_1.config.processing.concurrency,
                enableUpload: options.enableUpload ?? config_1.config.googleDrive.enabled,
                enableBookmarklet: options.enableBookmarklet ?? true,
                enableExtension: options.enableExtension ?? !!config_1.config.chromeExtension.id,
            });
            LoggingService_1.logger.info('Automation run completed', {
                totalRecords: result.totalRecords,
                successCount: result.successCount,
                errorCount: result.errorCount,
                successRate: ((result.successCount / result.totalRecords) * 100).toFixed(2) + '%',
                duration: (result.duration / 1000).toFixed(2) + 's',
            });
            // Log errors if any
            if (result.errors.length > 0) {
                LoggingService_1.logger.warn('Some records failed to process', {
                    errorCount: result.errors.length,
                    errors: result.errors.slice(0, 5), // Log first 5 errors
                });
            }
        }
        catch (error) {
            LoggingService_1.logger.error('Automation run failed', error);
            throw error;
        }
    }
    /**
     * Get system status
     */
    async getStatus() {
        if (!this.isInitialized) {
            return { initialized: false };
        }
        const [stats, health] = await Promise.all([
            this.pipeline.getStats(),
            this.pipeline.healthCheck(),
        ]);
        return {
            initialized: true,
            healthy: health.healthy,
            ...stats,
            services: health.services,
            errors: health.errors,
        };
    }
    /**
     * Shutdown the system gracefully
     */
    async shutdown() {
        if (!this.isInitialized) {
            return;
        }
        LoggingService_1.logger.info('Shutting down Ad Screenshot Automation System');
        try {
            await this.pipeline.shutdown();
            this.isInitialized = false;
            LoggingService_1.logger.info('System shutdown completed');
        }
        catch (error) {
            LoggingService_1.logger.error('Error during shutdown', error);
            throw error;
        }
    }
    /**
     * Setup graceful shutdown handlers
     */
    setupShutdownHandlers() {
        const shutdown = async (signal) => {
            LoggingService_1.logger.info(`Received ${signal}, shutting down gracefully`);
            try {
                await this.shutdown();
                process.exit(0);
            }
            catch (error) {
                LoggingService_1.logger.error('Error during graceful shutdown', error);
                process.exit(1);
            }
        };
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGUSR2', () => shutdown('SIGUSR2')); // For nodemon
        process.on('uncaughtException', (error) => {
            LoggingService_1.logger.error('Uncaught exception', error);
            shutdown('uncaughtException');
        });
        process.on('unhandledRejection', (reason, promise) => {
            LoggingService_1.logger.error('Unhandled rejection', new Error(String(reason)), { promise });
            shutdown('unhandledRejection');
        });
    }
}
exports.AdScreenshotAutomationSystem = AdScreenshotAutomationSystem;
/**
 * CLI interface for running the system
 */
async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.log(`
Ad Screenshot Automation System v1.0.0

Usage:
  npm start <data-source> [options]

Data Sources:
  --csv <file-path>              Process CSV file
  --google-sheets <id> [range]   Process Google Sheets

Options:
  --concurrency <number>         Number of concurrent jobs (default: 3)
  --enable-upload               Enable Google Drive upload
  --enable-bookmarklet          Enable bookmarklet execution
  --enable-extension            Enable Chrome extension integration
  --device-types <types>        Comma-separated device types (Android,iOS,Desktop)

Examples:
  npm start --csv data/ads.csv --concurrency 5
  npm start --google-sheets 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
  npm start --csv data/ads.csv --enable-upload --device-types Android,iOS

Health Check:
  npm start --health            Check system health

Status:
  npm start --status            Get system status
    `);
        return;
    }
    const system = new AdScreenshotAutomationSystem();
    try {
        // Parse arguments
        const options = parseArguments(args);
        if (options.command === 'health') {
            await system.initialize();
            const health = await system.processingPipeline.healthCheck();
            console.log('System Health:', JSON.stringify(health, null, 2));
            await system.shutdown();
            return;
        }
        if (options.command === 'status') {
            const status = await system.getStatus();
            console.log('System Status:', JSON.stringify(status, null, 2));
            if (status.initialized) {
                await system.shutdown();
            }
            return;
        }
        if (!options.dataSource) {
            throw new Error('Data source is required');
        }
        // Run the system
        await system.run({
            dataSource: options.dataSource,
            concurrency: options.concurrency,
            enableUpload: options.enableUpload,
            enableBookmarklet: options.enableBookmarklet,
            enableExtension: options.enableExtension,
        });
        await system.shutdown();
    }
    catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}
/**
 * Parse command line arguments
 */
function parseArguments(args) {
    const result = {};
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case '--health':
                result.command = 'health';
                break;
            case '--status':
                result.command = 'status';
                break;
            case '--csv':
                result.dataSource = {
                    type: 'csv',
                    path: args[++i],
                };
                break;
            case '--google-sheets':
                result.dataSource = {
                    type: 'google_sheets',
                    spreadsheetId: args[++i],
                    range: args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : 'Sheet1',
                };
                break;
            case '--concurrency':
                result.concurrency = parseInt(args[++i]);
                break;
            case '--enable-upload':
                result.enableUpload = true;
                break;
            case '--enable-bookmarklet':
                result.enableBookmarklet = true;
                break;
            case '--enable-extension':
                result.enableExtension = true;
                break;
            case '--device-types':
                // This would be handled in a more complete implementation
                break;
        }
    }
    return result;
}
// Export the main class and interfaces
var ProcessingPipeline_2 = require("./services/ProcessingPipeline");
Object.defineProperty(exports, "ProcessingPipeline", { enumerable: true, get: function () { return ProcessingPipeline_2.ProcessingPipeline; } });
var DataIngestionService_1 = require("./services/DataIngestionService");
Object.defineProperty(exports, "DataIngestionService", { enumerable: true, get: function () { return DataIngestionService_1.DataIngestionService; } });
var BrowserAutomationEngine_1 = require("./services/BrowserAutomationEngine");
Object.defineProperty(exports, "BrowserAutomationEngine", { enumerable: true, get: function () { return BrowserAutomationEngine_1.BrowserAutomationEngine; } });
var BookmarkletExecutor_1 = require("./services/BookmarkletExecutor");
Object.defineProperty(exports, "BookmarkletExecutor", { enumerable: true, get: function () { return BookmarkletExecutor_1.BookmarkletExecutor; } });
var ChromeExtensionBridge_1 = require("./services/ChromeExtensionBridge");
Object.defineProperty(exports, "ChromeExtensionBridge", { enumerable: true, get: function () { return ChromeExtensionBridge_1.ChromeExtensionBridge; } });
var ScreenshotManager_1 = require("./services/ScreenshotManager");
Object.defineProperty(exports, "ScreenshotManager", { enumerable: true, get: function () { return ScreenshotManager_1.ScreenshotManager; } });
var FileStorageService_1 = require("./services/FileStorageService");
Object.defineProperty(exports, "FileStorageService", { enumerable: true, get: function () { return FileStorageService_1.FileStorageService; } });
var UploadService_1 = require("./services/UploadService");
Object.defineProperty(exports, "UploadService", { enumerable: true, get: function () { return UploadService_1.UploadService; } });
var QueueManager_1 = require("./services/QueueManager");
Object.defineProperty(exports, "QueueManager", { enumerable: true, get: function () { return QueueManager_1.QueueManager; } });
var LoggingService_2 = require("./services/LoggingService");
Object.defineProperty(exports, "logger", { enumerable: true, get: function () { return LoggingService_2.logger; } });
__exportStar(require("./types"), exports);
var config_2 = require("./config");
Object.defineProperty(exports, "config", { enumerable: true, get: function () { return config_2.config; } });
// Run CLI if this file is executed directly
if (require.main === module) {
    main().catch(console.error);
}
exports.default = AdScreenshotAutomationSystem;
//# sourceMappingURL=index.js.map