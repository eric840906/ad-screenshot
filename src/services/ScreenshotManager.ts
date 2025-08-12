/**
 * Screenshot management service with Sharp for image processing
 */

import * as sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as moment from 'moment';
import { ScreenshotResult, AdRecord, DeviceType } from '@/types';
import { logger } from './LoggingService';
import { config } from '@/config';

export interface ProcessingOptions {
  format?: 'png' | 'jpeg' | 'webp';
  quality?: number;
  resize?: {
    width?: number;
    height?: number;
    fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  };
  watermark?: {
    text: string;
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
    fontSize: number;
    color: string;
  };
  annotate?: {
    elements: Array<{
      selector: string;
      label: string;
      color: string;
    }>;
  };
}

export interface OptimizationResult {
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number;
  format: string;
}

export class ScreenshotManager {
  private static instance: ScreenshotManager;

  constructor() {
    this.ensureDirectoriesExist();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ScreenshotManager {
    if (!ScreenshotManager.instance) {
      ScreenshotManager.instance = new ScreenshotManager();
    }
    return ScreenshotManager.instance;
  }

  /**
   * Ensure required directories exist
   */
  private ensureDirectoriesExist(): void {
    fs.ensureDirSync(config.storage.baseDirectory);
    
    if (config.storage.createDateFolders) {
      const dateFolder = moment().format('YYYY-MM-DD');
      fs.ensureDirSync(path.join(config.storage.baseDirectory, dateFolder));
    }
  }

  /**
   * Process and save screenshot
   */
  public async processAndSave(
    screenshotBuffer: Buffer,
    record: AdRecord,
    options: ProcessingOptions = {}
  ): Promise<ScreenshotResult> {
    const startTime = Date.now();

    try {
      // Generate filename
      const fileName = this.generateFileName(record);
      const filePath = this.getFilePath(fileName);

      // Ensure directory exists
      fs.ensureDirSync(path.dirname(filePath));

      // Process image with Sharp
      const processedBuffer = await this.processImage(screenshotBuffer, options);

      // Save processed image
      await fs.writeFile(filePath, processedBuffer);

      const duration = Date.now() - startTime;
      const fileStats = await fs.stat(filePath);

      logger.logScreenshot(
        true,
        fileName,
        record.WebsiteURL,
        record.Selector,
        {
          fileSize: fileStats.size,
          processingTime: duration,
          format: options.format || 'png',
        }
      );

      return {
        success: true,
        filePath,
        fileName,
        metadata: {
          timestamp: new Date(),
          deviceType: record.DeviceUI,
          pid: record.PID,
          uid: record.UID,
          adType: record.AdType,
          url: record.WebsiteURL,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.logScreenshot(
        false,
        'unknown',
        record.WebsiteURL,
        record.Selector,
        {
          error: error.message,
          processingTime: duration,
        }
      );

      return {
        success: false,
        error: error.message,
        metadata: {
          timestamp: new Date(),
          deviceType: record.DeviceUI,
          pid: record.PID,
          uid: record.UID,
          adType: record.AdType,
          url: record.WebsiteURL,
        },
      };
    }
  }

  /**
   * Process image with Sharp
   */
  private async processImage(
    buffer: Buffer,
    options: ProcessingOptions
  ): Promise<Buffer> {
    let sharpInstance = sharp(buffer);

    // Get original metadata
    const metadata = await sharpInstance.metadata();
    logger.debug('Original image metadata', {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: metadata.size,
    });

    // Apply resize if specified
    if (options.resize) {
      sharpInstance = sharpInstance.resize({
        width: options.resize.width,
        height: options.resize.height,
        fit: options.resize.fit || 'inside',
        withoutEnlargement: true,
      });
    }

    // Apply watermark if specified
    if (options.watermark) {
      sharpInstance = await this.addWatermark(sharpInstance, options.watermark);
    }

    // Set output format and quality
    const format = options.format || 'png';
    const quality = options.quality || 90;

    switch (format) {
      case 'jpeg':
        sharpInstance = sharpInstance.jpeg({ quality, progressive: true });
        break;
      case 'webp':
        sharpInstance = sharpInstance.webp({ quality, effort: 4 });
        break;
      case 'png':
      default:
        sharpInstance = sharpInstance.png({ 
          compressionLevel: 6,
          adaptiveFiltering: true,
        });
        break;
    }

    const processedBuffer = await sharpInstance.toBuffer();

    logger.debug('Image processing completed', {
      originalSize: buffer.length,
      processedSize: processedBuffer.length,
      compressionRatio: ((buffer.length - processedBuffer.length) / buffer.length * 100).toFixed(2) + '%',
      format,
    });

    return processedBuffer;
  }

  /**
   * Add watermark to image
   */
  private async addWatermark(
    sharpInstance: sharp.Sharp,
    watermark: ProcessingOptions['watermark']
  ): Promise<sharp.Sharp> {
    if (!watermark) return sharpInstance;

    const { width, height } = await sharpInstance.metadata();
    if (!width || !height) return sharpInstance;

    // Calculate position
    const positions = {
      'top-left': { left: 10, top: 10 },
      'top-right': { left: width - 200, top: 10 },
      'bottom-left': { left: 10, top: height - 50 },
      'bottom-right': { left: width - 200, top: height - 50 },
      'center': { left: width / 2 - 100, top: height / 2 - 25 },
    };

    const position = positions[watermark.position] || positions['bottom-right'];

    // Create text overlay SVG
    const textSvg = `
      <svg width="${width}" height="${height}">
        <text x="${position.left}" y="${position.top + watermark.fontSize}" 
              font-family="Arial, sans-serif" 
              font-size="${watermark.fontSize}" 
              fill="${watermark.color}"
              stroke="white" 
              stroke-width="1">
          ${watermark.text}
        </text>
      </svg>
    `;

    const textBuffer = Buffer.from(textSvg);

    return sharpInstance.composite([
      {
        input: textBuffer,
        blend: 'over',
      },
    ]);
  }

  /**
   * Generate filename based on record data
   */
  private generateFileName(record: AdRecord): string {
    const date = moment().format('YYYY-MM-DD-HH-mm-ss');
    const platformName = this.getPlatformName(record.WebsiteURL);
    
    // Clean up strings for filename
    const cleanPID = record.PID.replace(/[^a-zA-Z0-9]/g, '_');
    const cleanUID = record.UID.replace(/[^a-zA-Z0-9]/g, '_');
    const cleanAdType = record.AdType.replace(/[^a-zA-Z0-9]/g, '_');
    const cleanDeviceUI = record.DeviceUI.replace(/[^a-zA-Z0-9]/g, '_');

    return `${date}_${platformName}_${cleanPID}_${cleanUID}_${cleanAdType}_${cleanDeviceUI}.png`;
  }

  /**
   * Extract platform name from URL
   */
  private getPlatformName(url: string): string {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.replace('www.', '');
      const parts = hostname.split('.');
      return parts[0] || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Get full file path
   */
  private getFilePath(fileName: string): string {
    let basePath = config.storage.baseDirectory;

    if (config.storage.createDateFolders) {
      const dateFolder = moment().format('YYYY-MM-DD');
      basePath = path.join(basePath, dateFolder);
    }

    return path.join(basePath, fileName);
  }

  /**
   * Optimize existing screenshot
   */
  public async optimizeScreenshot(
    filePath: string,
    options: ProcessingOptions = {}
  ): Promise<OptimizationResult> {
    try {
      const originalBuffer = await fs.readFile(filePath);
      const originalSize = originalBuffer.length;

      // Process with optimization settings
      const optimizedOptions: ProcessingOptions = {
        format: 'webp',
        quality: 80,
        ...options,
      };

      const optimizedBuffer = await this.processImage(originalBuffer, optimizedOptions);
      const optimizedSize = optimizedBuffer.length;

      // Save optimized version
      const ext = path.extname(filePath);
      const baseName = path.basename(filePath, ext);
      const dirName = path.dirname(filePath);
      const optimizedPath = path.join(dirName, `${baseName}_optimized.webp`);

      await fs.writeFile(optimizedPath, optimizedBuffer);

      const compressionRatio = ((originalSize - optimizedSize) / originalSize) * 100;

      logger.info('Screenshot optimized', {
        originalPath: filePath,
        optimizedPath,
        originalSize,
        optimizedSize,
        compressionRatio: compressionRatio.toFixed(2) + '%',
      });

      return {
        originalSize,
        optimizedSize,
        compressionRatio,
        format: optimizedOptions.format || 'webp',
      };
    } catch (error) {
      logger.error('Screenshot optimization failed', error, { filePath });
      throw error;
    }
  }

  /**
   * Create thumbnail from screenshot
   */
  public async createThumbnail(
    filePath: string,
    size: { width: number; height: number } = { width: 200, height: 150 }
  ): Promise<string> {
    try {
      const buffer = await fs.readFile(filePath);
      
      const thumbnailBuffer = await sharp(buffer)
        .resize(size.width, size.height, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 80 })
        .toBuffer();

      const ext = path.extname(filePath);
      const baseName = path.basename(filePath, ext);
      const dirName = path.dirname(filePath);
      const thumbnailPath = path.join(dirName, `${baseName}_thumb.jpg`);

      await fs.writeFile(thumbnailPath, thumbnailBuffer);

      logger.debug('Thumbnail created', {
        originalPath: filePath,
        thumbnailPath,
        size,
      });

      return thumbnailPath;
    } catch (error) {
      logger.error('Thumbnail creation failed', error, { filePath });
      throw error;
    }
  }

  /**
   * Batch process multiple screenshots
   */
  public async batchProcess(
    screenshots: Array<{
      buffer: Buffer;
      record: AdRecord;
      options?: ProcessingOptions;
    }>
  ): Promise<ScreenshotResult[]> {
    const results: ScreenshotResult[] = [];

    logger.info('Starting batch screenshot processing', {
      count: screenshots.length,
    });

    for (const [index, screenshot] of screenshots.entries()) {
      try {
        const result = await this.processAndSave(
          screenshot.buffer,
          screenshot.record,
          screenshot.options
        );
        results.push(result);

        logger.debug('Batch item processed', {
          index: index + 1,
          total: screenshots.length,
          success: result.success,
        });
      } catch (error) {
        logger.error('Batch item processing failed', error, {
          index: index + 1,
          record: screenshot.record,
        });

        results.push({
          success: false,
          error: error.message,
          metadata: {
            timestamp: new Date(),
            deviceType: screenshot.record.DeviceUI,
            pid: screenshot.record.PID,
            uid: screenshot.record.UID,
            adType: screenshot.record.AdType,
            url: screenshot.record.WebsiteURL,
          },
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    logger.info('Batch screenshot processing completed', {
      total: results.length,
      success: successCount,
      failures: failureCount,
      successRate: ((successCount / results.length) * 100).toFixed(2) + '%',
    });

    return results;
  }

  /**
   * Get image metadata
   */
  public async getImageMetadata(filePath: string): Promise<sharp.Metadata> {
    try {
      return await sharp(filePath).metadata();
    } catch (error) {
      logger.error('Failed to get image metadata', error, { filePath });
      throw error;
    }
  }

  /**
   * Convert image format
   */
  public async convertFormat(
    inputPath: string,
    outputPath: string,
    format: 'png' | 'jpeg' | 'webp',
    quality: number = 90
  ): Promise<void> {
    try {
      let sharpInstance = sharp(inputPath);

      switch (format) {
        case 'jpeg':
          sharpInstance = sharpInstance.jpeg({ quality });
          break;
        case 'webp':
          sharpInstance = sharpInstance.webp({ quality });
          break;
        case 'png':
          sharpInstance = sharpInstance.png();
          break;
      }

      await sharpInstance.toFile(outputPath);

      logger.debug('Image format converted', {
        inputPath,
        outputPath,
        format,
        quality,
      });
    } catch (error) {
      logger.error('Image format conversion failed', error, {
        inputPath,
        outputPath,
        format,
      });
      throw error;
    }
  }

  /**
   * Clean up old screenshots
   */
  public async cleanupOldScreenshots(daysToKeep: number = 30): Promise<void> {
    try {
      const cutoffDate = moment().subtract(daysToKeep, 'days');
      const baseDir = config.storage.baseDirectory;

      const files = await this.getAllScreenshotFiles(baseDir);
      let deletedCount = 0;
      let totalSize = 0;

      for (const file of files) {
        const stats = await fs.stat(file);
        const fileDate = moment(stats.mtime);

        if (fileDate.isBefore(cutoffDate)) {
          totalSize += stats.size;
          await fs.remove(file);
          deletedCount++;
        }
      }

      logger.info('Screenshot cleanup completed', {
        deletedCount,
        totalSizeDeleted: (totalSize / 1024 / 1024).toFixed(2) + ' MB',
        cutoffDate: cutoffDate.format('YYYY-MM-DD'),
      });
    } catch (error) {
      logger.error('Screenshot cleanup failed', error);
      throw error;
    }
  }

  /**
   * Get all screenshot files recursively
   */
  private async getAllScreenshotFiles(dir: string): Promise<string[]> {
    const files: string[] = [];

    if (!await fs.pathExists(dir)) {
      return files;
    }

    const items = await fs.readdir(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = await fs.stat(fullPath);

      if (stat.isDirectory()) {
        const subFiles = await this.getAllScreenshotFiles(fullPath);
        files.push(...subFiles);
      } else if (this.isImageFile(fullPath)) {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Check if file is an image
   */
  private isImageFile(filePath: string): boolean {
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
    const ext = path.extname(filePath).toLowerCase();
    return imageExtensions.includes(ext);
  }

  /**
   * Get storage statistics
   */
  public async getStorageStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    averageFileSize: number;
    oldestFile: Date | null;
    newestFile: Date | null;
  }> {
    try {
      const files = await this.getAllScreenshotFiles(config.storage.baseDirectory);
      let totalSize = 0;
      let oldestDate: Date | null = null;
      let newestDate: Date | null = null;

      for (const file of files) {
        const stats = await fs.stat(file);
        totalSize += stats.size;

        if (!oldestDate || stats.mtime < oldestDate) {
          oldestDate = stats.mtime;
        }
        if (!newestDate || stats.mtime > newestDate) {
          newestDate = stats.mtime;
        }
      }

      return {
        totalFiles: files.length,
        totalSize,
        averageFileSize: files.length > 0 ? totalSize / files.length : 0,
        oldestFile: oldestDate,
        newestFile: newestDate,
      };
    } catch (error) {
      logger.error('Failed to get storage stats', error);
      throw error;
    }
  }
}