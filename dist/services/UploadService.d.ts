/**
 * Upload service for Google Drive integration
 */
import { UploadResult, AdRecord } from '../types';
export interface DriveFolder {
    id: string;
    name: string;
    parents?: string[];
    created: Date;
}
export interface UploadOptions {
    parentFolderId?: string;
    fileName?: string;
    description?: string;
    makePublic?: boolean;
    mimeType?: string;
}
export interface BatchUploadResult {
    totalFiles: number;
    successCount: number;
    failureCount: number;
    results: UploadResult[];
    duration: number;
}
export declare class UploadService {
    private drive;
    private auth;
    private folderCache;
    private static instance;
    constructor();
    /**
     * Get singleton instance
     */
    static getInstance(): UploadService;
    /**
     * Initialize Google Drive API
     */
    private initializeGoogleDrive;
    /**
     * Upload file to Google Drive
     */
    uploadFile(filePath: string, options?: UploadOptions, record?: AdRecord): Promise<UploadResult>;
    /**
     * Ensure folder structure exists for organized uploads
     */
    private ensureFolderStructure;
    /**
     * Ensure folder exists, create if necessary
     */
    private ensureFolder;
    /**
     * Find existing folder by name and parent
     */
    private findFolder;
    /**
     * Make file publicly accessible
     */
    private makeFilePublic;
    /**
     * Upload multiple files in batch
     */
    batchUpload(files: Array<{
        filePath: string;
        options?: UploadOptions;
        record?: AdRecord;
    }>, concurrency?: number): Promise<BatchUploadResult>;
    /**
     * Delete file from Google Drive
     */
    deleteFile(fileId: string): Promise<boolean>;
    /**
     * Get file information
     */
    getFileInfo(fileId: string): Promise<any>;
    /**
     * List files in a folder
     */
    listFiles(folderId?: string, maxResults?: number): Promise<any[]>;
    /**
     * Get storage quota information
     */
    getStorageQuota(): Promise<{
        limit: number;
        usage: number;
        usageInDrive: number;
        available: number;
    }>;
    /**
     * Test Google Drive connection
     */
    testConnection(): Promise<boolean>;
    /**
     * Get MIME type from file extension
     */
    private getMimeType;
    /**
     * Extract platform name from URL
     */
    private extractPlatformFromUrl;
    /**
     * Generate cache key for folder structure
     */
    private getFolderCacheKey;
    /**
     * Create shared link for file
     */
    createShareLink(fileId: string, viewOnly?: boolean): Promise<string | null>;
    /**
     * Clean up old uploads
     */
    cleanupOldUploads(maxAge?: number, // days
    folderId?: string): Promise<{
        deletedCount: number;
        errors: string[];
    }>;
}
//# sourceMappingURL=UploadService.d.ts.map