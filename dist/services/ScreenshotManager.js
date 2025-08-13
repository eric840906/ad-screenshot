"use strict";
/**
 * Screenshot management service with Sharp for image processing
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScreenshotManager = void 0;
const sharp_1 = __importDefault(require("sharp"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs-extra"));
const moment_1 = __importDefault(require("moment"));
const LoggingService_1 = require("./LoggingService");
const config_1 = require("../config");
class ScreenshotManager {
    static instance;
    constructor() {
        this.ensureDirectoriesExist();
    }
    /**
     * Get singleton instance
     */
    static getInstance() {
        if (!ScreenshotManager.instance) {
            ScreenshotManager.instance = new ScreenshotManager();
        }
        return ScreenshotManager.instance;
    }
    /**
     * Ensure required directories exist
     */
    ensureDirectoriesExist() {
        fs.ensureDirSync(config_1.config.storage.baseDirectory);
        if (config_1.config.storage.createDateFolders) {
            const dateFolder = (0, moment_1.default)().format('YYYY-MM-DD');
            fs.ensureDirSync(path.join(config_1.config.storage.baseDirectory, dateFolder));
        }
    }
    /**
     * Process and save screenshot
     */
    async processAndSave(screenshotBuffer, record, options = {}) {
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
            LoggingService_1.logger.logScreenshot(true, fileName, record.WebsiteURL, record.Selector, {
                fileSize: fileStats.size,
                processingTime: duration,
                format: options.format || 'png',
            });
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
        }
        catch (error) {
            const duration = Date.now() - startTime;
            LoggingService_1.logger.logScreenshot(false, 'unknown', record.WebsiteURL, record.Selector, {
                error: error.message,
                processingTime: duration,
            });
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
    async processImage(buffer, options) {
        let sharpInstance = (0, sharp_1.default)(buffer);
        // Get original metadata
        const metadata = await sharpInstance.metadata();
        LoggingService_1.logger.debug('Original image metadata', {
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
        LoggingService_1.logger.debug('Image processing completed', {
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
    async addWatermark(sharpInstance, watermark) {
        if (!watermark)
            return sharpInstance;
        const { width, height } = await sharpInstance.metadata();
        if (!width || !height)
            return sharpInstance;
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
    generateFileName(record) {
        const date = (0, moment_1.default)().format('YYYY-MM-DD-HH-mm-ss');
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
    getPlatformName(url) {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.replace('www.', '');
            const parts = hostname.split('.');
            return parts[0] || 'unknown';
        }
        catch {
            return 'unknown';
        }
    }
    /**
     * Get full file path
     */
    getFilePath(fileName) {
        let basePath = config_1.config.storage.baseDirectory;
        if (config_1.config.storage.createDateFolders) {
            const dateFolder = (0, moment_1.default)().format('YYYY-MM-DD');
            basePath = path.join(basePath, dateFolder);
        }
        return path.join(basePath, fileName);
    }
    /**
     * Optimize existing screenshot
     */
    async optimizeScreenshot(filePath, options = {}) {
        try {
            const originalBuffer = await fs.readFile(filePath);
            const originalSize = originalBuffer.length;
            // Process with optimization settings
            const optimizedOptions = {
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
            LoggingService_1.logger.info('Screenshot optimized', {
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
        }
        catch (error) {
            LoggingService_1.logger.error('Screenshot optimization failed', error, { filePath });
            throw error;
        }
    }
    /**
     * Create thumbnail from screenshot
     */
    async createThumbnail(filePath, size = { width: 200, height: 150 }) {
        try {
            const buffer = await fs.readFile(filePath);
            const thumbnailBuffer = await (0, sharp_1.default)(buffer)
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
            LoggingService_1.logger.debug('Thumbnail created', {
                originalPath: filePath,
                thumbnailPath,
                size,
            });
            return thumbnailPath;
        }
        catch (error) {
            LoggingService_1.logger.error('Thumbnail creation failed', error, { filePath });
            throw error;
        }
    }
    /**
     * Batch process multiple screenshots
     */
    async batchProcess(screenshots) {
        const results = [];
        LoggingService_1.logger.info('Starting batch screenshot processing', {
            count: screenshots.length,
        });
        for (const [index, screenshot] of screenshots.entries()) {
            try {
                const result = await this.processAndSave(screenshot.buffer, screenshot.record, screenshot.options);
                results.push(result);
                LoggingService_1.logger.debug('Batch item processed', {
                    index: index + 1,
                    total: screenshots.length,
                    success: result.success,
                });
            }
            catch (error) {
                LoggingService_1.logger.error('Batch item processing failed', error, {
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
        LoggingService_1.logger.info('Batch screenshot processing completed', {
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
    async getImageMetadata(filePath) {
        try {
            return await (0, sharp_1.default)(filePath).metadata();
        }
        catch (error) {
            LoggingService_1.logger.error('Failed to get image metadata', error, { filePath });
            throw error;
        }
    }
    /**
     * Convert image format
     */
    async convertFormat(inputPath, outputPath, format, quality = 90) {
        try {
            let sharpInstance = (0, sharp_1.default)(inputPath);
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
            LoggingService_1.logger.debug('Image format converted', {
                inputPath,
                outputPath,
                format,
                quality,
            });
        }
        catch (error) {
            LoggingService_1.logger.error('Image format conversion failed', error, {
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
    async cleanupOldScreenshots(daysToKeep = 30) {
        try {
            const cutoffDate = (0, moment_1.default)().subtract(daysToKeep, 'days');
            const baseDir = config_1.config.storage.baseDirectory;
            const files = await this.getAllScreenshotFiles(baseDir);
            let deletedCount = 0;
            let totalSize = 0;
            for (const file of files) {
                const stats = await fs.stat(file);
                const fileDate = (0, moment_1.default)(stats.mtime);
                if (fileDate.isBefore(cutoffDate)) {
                    totalSize += stats.size;
                    await fs.remove(file);
                    deletedCount++;
                }
            }
            LoggingService_1.logger.info('Screenshot cleanup completed', {
                deletedCount,
                totalSizeDeleted: (totalSize / 1024 / 1024).toFixed(2) + ' MB',
                cutoffDate: cutoffDate.format('YYYY-MM-DD'),
            });
        }
        catch (error) {
            LoggingService_1.logger.error('Screenshot cleanup failed', error);
            throw error;
        }
    }
    /**
     * Get all screenshot files recursively
     */
    async getAllScreenshotFiles(dir) {
        const files = [];
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
            }
            else if (this.isImageFile(fullPath)) {
                files.push(fullPath);
            }
        }
        return files;
    }
    /**
     * Check if file is an image
     */
    isImageFile(filePath) {
        const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
        const ext = path.extname(filePath).toLowerCase();
        return imageExtensions.includes(ext);
    }
    /**
     * Get storage statistics
     */
    async getStorageStats() {
        try {
            const files = await this.getAllScreenshotFiles(config_1.config.storage.baseDirectory);
            let totalSize = 0;
            let oldestDate = null;
            let newestDate = null;
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
        }
        catch (error) {
            LoggingService_1.logger.error('Failed to get storage stats', error);
            throw error;
        }
    }
}
exports.ScreenshotManager = ScreenshotManager;
//# sourceMappingURL=ScreenshotManager.js.map