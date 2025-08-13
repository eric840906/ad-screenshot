/**
 * Screenshot management service with Sharp for image processing
 */
import sharp from 'sharp';
import { ScreenshotResult, AdRecord } from '../types';
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
export declare class ScreenshotManager {
    private static instance;
    constructor();
    /**
     * Get singleton instance
     */
    static getInstance(): ScreenshotManager;
    /**
     * Ensure required directories exist
     */
    private ensureDirectoriesExist;
    /**
     * Process and save screenshot
     */
    processAndSave(screenshotBuffer: Buffer, record: AdRecord, options?: ProcessingOptions): Promise<ScreenshotResult>;
    /**
     * Process image with Sharp
     */
    private processImage;
    /**
     * Add watermark to image
     */
    private addWatermark;
    /**
     * Generate filename based on record data
     */
    private generateFileName;
    /**
     * Extract platform name from URL
     */
    private getPlatformName;
    /**
     * Get full file path
     */
    private getFilePath;
    /**
     * Optimize existing screenshot
     */
    optimizeScreenshot(filePath: string, options?: ProcessingOptions): Promise<OptimizationResult>;
    /**
     * Create thumbnail from screenshot
     */
    createThumbnail(filePath: string, size?: {
        width: number;
        height: number;
    }): Promise<string>;
    /**
     * Batch process multiple screenshots
     */
    batchProcess(screenshots: Array<{
        buffer: Buffer;
        record: AdRecord;
        options?: ProcessingOptions;
    }>): Promise<ScreenshotResult[]>;
    /**
     * Get image metadata
     */
    getImageMetadata(filePath: string): Promise<sharp.Metadata>;
    /**
     * Convert image format
     */
    convertFormat(inputPath: string, outputPath: string, format: 'png' | 'jpeg' | 'webp', quality?: number): Promise<void>;
    /**
     * Clean up old screenshots
     */
    cleanupOldScreenshots(daysToKeep?: number): Promise<void>;
    /**
     * Get all screenshot files recursively
     */
    private getAllScreenshotFiles;
    /**
     * Check if file is an image
     */
    private isImageFile;
    /**
     * Get storage statistics
     */
    getStorageStats(): Promise<{
        totalFiles: number;
        totalSize: number;
        averageFileSize: number;
        oldestFile: Date | null;
        newestFile: Date | null;
    }>;
}
//# sourceMappingURL=ScreenshotManager.d.ts.map