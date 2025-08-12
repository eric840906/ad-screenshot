/**
 * Main entry point for Ad Screenshot Automation System
 */

import { ProcessingPipeline } from './services/ProcessingPipeline';
import { DataIngestionService, DataSource } from './services/DataIngestionService';
import { logger } from './services/LoggingService';
import { config, validateConfig } from './config';
import { errorHandler } from './utils/ErrorHandler';
import * as process from 'process';

export interface AutomationSystemOptions {
  dataSource: DataSource;
  concurrency?: number;
  enableUpload?: boolean;
  enableBookmarklet?: boolean;
  enableExtension?: boolean;
}

export class AdScreenshotAutomationSystem {
  private pipeline: ProcessingPipeline;
  private isInitialized: boolean = false;

  constructor() {
    this.pipeline = ProcessingPipeline.getInstance();
    this.setupShutdownHandlers();
  }

  /**
   * Initialize the system
   */
  public async initialize(): Promise<void> {
    try {
      logger.info('Initializing Ad Screenshot Automation System', {
        version: '1.0.0',
        environment: config.env,
        nodeVersion: process.version,
      });

      // Validate configuration
      validateConfig();

      // Initialize the processing pipeline
      await this.pipeline.initialize();

      this.isInitialized = true;

      logger.info('Ad Screenshot Automation System initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize system', error);
      throw error;
    }
  }

  /**
   * Run the automation system with provided options
   */
  public async run(options: AutomationSystemOptions): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      logger.info('Starting automation run', { options });

      const result = await this.pipeline.processBatch(options.dataSource, {
        concurrency: options.concurrency || config.processing.concurrency,
        enableUpload: options.enableUpload ?? config.googleDrive.enabled,
        enableBookmarklet: options.enableBookmarklet ?? true,
        enableExtension: options.enableExtension ?? !!config.chromeExtension.id,
      });

      logger.info('Automation run completed', {
        totalRecords: result.totalRecords,
        successCount: result.successCount,
        errorCount: result.errorCount,
        successRate: ((result.successCount / result.totalRecords) * 100).toFixed(2) + '%',
        duration: (result.duration / 1000).toFixed(2) + 's',
      });

      // Log errors if any
      if (result.errors.length > 0) {
        logger.warn('Some records failed to process', {
          errorCount: result.errors.length,
          errors: result.errors.slice(0, 5), // Log first 5 errors
        });
      }

    } catch (error) {
      logger.error('Automation run failed', error);
      throw error;
    }
  }

  /**
   * Get system status
   */
  public async getStatus(): Promise<any> {
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
  public async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    logger.info('Shutting down Ad Screenshot Automation System');

    try {
      await this.pipeline.shutdown();
      this.isInitialized = false;
      logger.info('System shutdown completed');
    } catch (error) {
      logger.error('Error during shutdown', error);
      throw error;
    }
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupShutdownHandlers(): void {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully`);
      try {
        await this.shutdown();
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGUSR2', () => shutdown('SIGUSR2')); // For nodemon

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', error);
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection', new Error(String(reason)), { promise });
      shutdown('unhandledRejection');
    });
  }
}

/**
 * CLI interface for running the system
 */
async function main(): Promise<void> {
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
      const health = await system.pipeline.healthCheck();
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
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

/**
 * Parse command line arguments
 */
function parseArguments(args: string[]): {
  command?: 'health' | 'status';
  dataSource?: DataSource;
  concurrency?: number;
  enableUpload?: boolean;
  enableBookmarklet?: boolean;
  enableExtension?: boolean;
} {
  const result: any = {};

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

// Run CLI if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export default AdScreenshotAutomationSystem;