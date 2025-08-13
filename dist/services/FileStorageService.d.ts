/**
 * File storage service for local storage with organized folder structure
 */
import { AdRecord } from '../types';
export interface FileMetadata {
    fileName: string;
    filePath: string;
    size: number;
    created: Date;
    modified: Date;
    type: 'screenshot' | 'log' | 'report' | 'data';
    record?: AdRecord;
}
export interface StorageStats {
    totalFiles: number;
    totalSize: number;
    filesByType: Record<string, number>;
    sizeByType: Record<string, number>;
    oldestFile: Date | null;
    newestFile: Date | null;
}
export interface CleanupResult {
    deletedFiles: number;
    freedSpace: number;
    errors: string[];
}
export declare class FileStorageService {
    private baseDirectory;
    private static instance;
    constructor();
    /**
     * Get singleton instance
     */
    static getInstance(): FileStorageService;
    /**
     * Initialize storage directories
     */
    private initializeStorage;
    /**
     * Get organized file path based on storage options
     */
    getOrganizedPath(fileName: string, type?: 'screenshot' | 'log' | 'report' | 'data', record?: AdRecord): string;
    /**
     * Save file with organized structure
     */
    saveFile(content: Buffer | string, fileName: string, type?: 'screenshot' | 'log' | 'report' | 'data', record?: AdRecord): Promise<FileMetadata>;
    /**
     * Read file from storage
     */
    readFile(filePath: string): Promise<Buffer>;
    /**
     * Check if file exists
     */
    fileExists(filePath: string): Promise<boolean>;
    /**
     * Delete file
     */
    deleteFile(filePath: string): Promise<void>;
    /**
     * Move file to different location
     */
    moveFile(sourcePath: string, destinationPath: string): Promise<void>;
    /**
     * Copy file to different location
     */
    copyFile(sourcePath: string, destinationPath: string): Promise<void>;
    /**
     * List files in directory with metadata
     */
    listFiles(directory?: string, type?: 'screenshot' | 'log' | 'report' | 'data', recursive?: boolean): Promise<FileMetadata[]>;
    /**
     * Recursively scan directory for files
     */
    private scanDirectory;
    /**
     * Get file type from path
     */
    private getFileTypeFromPath;
    /**
     * Get storage statistics
     */
    getStorageStats(): Promise<StorageStats>;
    /**
     * Clean up old files
     */
    cleanup(maxAge?: number, // days
    types?: Array<'screenshot' | 'log' | 'report' | 'data'>, dryRun?: boolean): Promise<CleanupResult>;
    /**
     * Archive old files to compressed format
     */
    archiveFiles(maxAge?: number, // days
    types?: Array<'screenshot' | 'log' | 'report' | 'data'>): Promise<{
        archivedFiles: number;
        archivePath: string;
    }>;
    /**
     * Extract platform name from URL
     */
    private extractPlatformFromUrl;
    /**
     * Create backup of important files
     */
    createBackup(backupName?: string, types?: Array<'screenshot' | 'log' | 'report' | 'data'>): Promise<string>;
    /**
     * Get available disk space
     */
    getDiskSpace(): Promise<{
        free: number;
        total: number;
        used: number;
        usedPercentage: number;
    }>;
}
//# sourceMappingURL=FileStorageService.d.ts.map