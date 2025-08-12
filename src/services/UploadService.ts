/**
 * Upload service for Google Drive integration
 */

import { google } from 'googleapis';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as moment from 'moment';
import { UploadResult, GoogleDriveConfig, AdRecord } from '@/types';
import { logger } from './LoggingService';
import { config } from '@/config';

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

export class UploadService {
  private drive: any;
  private auth: any;
  private folderCache: Map<string, string> = new Map();
  private static instance: UploadService;

  constructor() {
    this.initializeGoogleDrive();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): UploadService {
    if (!UploadService.instance) {
      UploadService.instance = new UploadService();
    }
    return UploadService.instance;
  }

  /**
   * Initialize Google Drive API
   */
  private async initializeGoogleDrive(): Promise<void> {
    try {
      if (!config.googleDrive.enabled || !config.googleDrive.keyFilePath) {
        logger.warn('Google Drive upload is disabled or no key file provided');
        return;
      }

      if (!await fs.pathExists(config.googleDrive.keyFilePath)) {
        throw new Error(`Google Drive key file not found: ${config.googleDrive.keyFilePath}`);
      }

      this.auth = new google.auth.GoogleAuth({
        keyFile: config.googleDrive.keyFilePath,
        scopes: [
          'https://www.googleapis.com/auth/drive.file',
          'https://www.googleapis.com/auth/drive.metadata',
        ],
      });

      this.drive = google.drive({ version: 'v3', auth: this.auth });

      // Test connection
      await this.drive.about.get({ fields: 'user' });

      logger.info('Google Drive service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Google Drive service', error);
      throw error;
    }
  }

  /**
   * Upload file to Google Drive
   */
  public async uploadFile(
    filePath: string,
    options: UploadOptions = {},
    record?: AdRecord
  ): Promise<UploadResult> {
    if (!this.drive) {
      return {
        success: false,
        error: 'Google Drive service not initialized',
      };
    }

    const startTime = Date.now();

    try {
      // Ensure file exists
      if (!await fs.pathExists(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      const fileName = options.fileName || path.basename(filePath);
      const mimeType = options.mimeType || this.getMimeType(filePath);

      // Determine parent folder
      let parentFolderId = options.parentFolderId || config.googleDrive.parentFolderId;
      
      if (config.googleDrive.createFolders && record) {
        parentFolderId = await this.ensureFolderStructure(record);
      }

      // Prepare file metadata
      const fileMetadata: any = {
        name: fileName,
        description: options.description || `Screenshot from ${record?.WebsiteURL || 'unknown'}`,
      };

      if (parentFolderId) {
        fileMetadata.parents = [parentFolderId];
      }

      // Create file stream
      const fileStream = fs.createReadStream(filePath);

      // Upload file
      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        media: {
          mimeType,
          body: fileStream,
        },
        fields: 'id, name, webViewLink, webContentLink, size',
      });

      const file = response.data;

      // Make public if requested
      if (options.makePublic) {
        await this.makeFilePublic(file.id);
      }

      const duration = Date.now() - startTime;

      logger.logUpload(true, fileName, 'gdrive', {
        fileId: file.id,
        size: file.size,
        duration,
        parentFolderId,
      });

      return {
        success: true,
        fileId: file.id,
        webViewLink: file.webViewLink,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.logUpload(false, path.basename(filePath), 'gdrive', {
        error: error.message,
        duration,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Ensure folder structure exists for organized uploads
   */
  private async ensureFolderStructure(record: AdRecord): Promise<string> {
    const cacheKey = this.getFolderCacheKey(record);
    
    if (this.folderCache.has(cacheKey)) {
      return this.folderCache.get(cacheKey)!;
    }

    try {
      let currentParentId = config.googleDrive.parentFolderId;

      switch (config.googleDrive.folderStructure) {
        case 'date':
          currentParentId = await this.ensureFolder(
            moment().format('YYYY-MM-DD'),
            currentParentId
          );
          break;

        case 'platform':
          const platform = this.extractPlatformFromUrl(record.WebsiteURL);
          currentParentId = await this.ensureFolder(platform, currentParentId);
          
          // Add date subfolder if enabled
          if (config.storage.createDateFolders) {
            currentParentId = await this.ensureFolder(
              moment().format('YYYY-MM-DD'),
              currentParentId
            );
          }
          break;

        case 'flat':
        default:
          // Use parent folder as-is
          break;
      }

      this.folderCache.set(cacheKey, currentParentId || '');
      return currentParentId || '';
    } catch (error) {
      logger.error('Failed to ensure folder structure', error, { record });
      return config.googleDrive.parentFolderId || '';
    }
  }

  /**
   * Ensure folder exists, create if necessary
   */
  private async ensureFolder(folderName: string, parentId?: string): Promise<string> {
    try {
      // Check if folder already exists
      const existingFolder = await this.findFolder(folderName, parentId);
      if (existingFolder) {
        return existingFolder.id;
      }

      // Create new folder
      const folderMetadata: any = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      };

      if (parentId) {
        folderMetadata.parents = [parentId];
      }

      const response = await this.drive.files.create({
        requestBody: folderMetadata,
        fields: 'id, name',
      });

      logger.debug('Google Drive folder created', {
        name: folderName,
        id: response.data.id,
        parentId,
      });

      return response.data.id;
    } catch (error) {
      logger.error('Failed to ensure folder', error, { folderName, parentId });
      throw error;
    }
  }

  /**
   * Find existing folder by name and parent
   */
  private async findFolder(folderName: string, parentId?: string): Promise<DriveFolder | null> {
    try {
      let query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      
      if (parentId) {
        query += ` and '${parentId}' in parents`;
      }

      const response = await this.drive.files.list({
        q: query,
        fields: 'files(id, name, parents, createdTime)',
      });

      const folders = response.data.files;
      if (folders && folders.length > 0) {
        const folder = folders[0];
        return {
          id: folder.id,
          name: folder.name,
          parents: folder.parents,
          created: new Date(folder.createdTime),
        };
      }

      return null;
    } catch (error) {
      logger.error('Failed to find folder', error, { folderName, parentId });
      return null;
    }
  }

  /**
   * Make file publicly accessible
   */
  private async makeFilePublic(fileId: string): Promise<void> {
    try {
      await this.drive.permissions.create({
        fileId,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      });

      logger.debug('File made public', { fileId });
    } catch (error) {
      logger.warn('Failed to make file public', { fileId, error: error.message });
    }
  }

  /**
   * Upload multiple files in batch
   */
  public async batchUpload(
    files: Array<{
      filePath: string;
      options?: UploadOptions;
      record?: AdRecord;
    }>,
    concurrency: number = 3
  ): Promise<BatchUploadResult> {
    const startTime = Date.now();
    const results: UploadResult[] = [];

    logger.info('Starting batch upload', {
      fileCount: files.length,
      concurrency,
    });

    // Process files in batches to avoid overwhelming the API
    for (let i = 0; i < files.length; i += concurrency) {
      const batch = files.slice(i, i + concurrency);
      const batchPromises = batch.map(async (file) => {
        try {
          return await this.uploadFile(file.filePath, file.options, file.record);
        } catch (error) {
          return {
            success: false,
            error: error.message,
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Log progress
      logger.debug('Batch upload progress', {
        completed: i + batch.length,
        total: files.length,
        successInBatch: batchResults.filter(r => r.success).length,
      });
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;
    const duration = Date.now() - startTime;

    logger.info('Batch upload completed', {
      totalFiles: files.length,
      successCount,
      failureCount,
      duration,
      successRate: ((successCount / files.length) * 100).toFixed(2) + '%',
    });

    return {
      totalFiles: files.length,
      successCount,
      failureCount,
      results,
      duration,
    };
  }

  /**
   * Delete file from Google Drive
   */
  public async deleteFile(fileId: string): Promise<boolean> {
    if (!this.drive) {
      return false;
    }

    try {
      await this.drive.files.delete({ fileId });
      
      logger.debug('File deleted from Google Drive', { fileId });
      return true;
    } catch (error) {
      logger.error('Failed to delete file from Google Drive', error, { fileId });
      return false;
    }
  }

  /**
   * Get file information
   */
  public async getFileInfo(fileId: string): Promise<any> {
    if (!this.drive) {
      throw new Error('Google Drive service not initialized');
    }

    try {
      const response = await this.drive.files.get({
        fileId,
        fields: 'id, name, size, createdTime, modifiedTime, webViewLink, webContentLink, parents',
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to get file info', error, { fileId });
      throw error;
    }
  }

  /**
   * List files in a folder
   */
  public async listFiles(
    folderId?: string,
    maxResults: number = 100
  ): Promise<any[]> {
    if (!this.drive) {
      throw new Error('Google Drive service not initialized');
    }

    try {
      let query = 'trashed=false';
      
      if (folderId) {
        query += ` and '${folderId}' in parents`;
      }

      const response = await this.drive.files.list({
        q: query,
        pageSize: maxResults,
        fields: 'files(id, name, size, createdTime, modifiedTime, webViewLink)',
        orderBy: 'createdTime desc',
      });

      return response.data.files || [];
    } catch (error) {
      logger.error('Failed to list files', error, { folderId });
      throw error;
    }
  }

  /**
   * Get storage quota information
   */
  public async getStorageQuota(): Promise<{
    limit: number;
    usage: number;
    usageInDrive: number;
    available: number;
  }> {
    if (!this.drive) {
      throw new Error('Google Drive service not initialized');
    }

    try {
      const response = await this.drive.about.get({
        fields: 'storageQuota',
      });

      const quota = response.data.storageQuota;
      const limit = parseInt(quota.limit) || 0;
      const usage = parseInt(quota.usage) || 0;
      const usageInDrive = parseInt(quota.usageInDrive) || 0;
      const available = limit - usage;

      return {
        limit,
        usage,
        usageInDrive,
        available,
      };
    } catch (error) {
      logger.error('Failed to get storage quota', error);
      throw error;
    }
  }

  /**
   * Test Google Drive connection
   */
  public async testConnection(): Promise<boolean> {
    if (!this.drive) {
      return false;
    }

    try {
      await this.drive.about.get({ fields: 'user' });
      logger.debug('Google Drive connection test successful');
      return true;
    } catch (error) {
      logger.error('Google Drive connection test failed', error);
      return false;
    }
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    
    const mimeTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.json': 'application/json',
      '.csv': 'text/csv',
      '.log': 'text/plain',
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Extract platform name from URL
   */
  private extractPlatformFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.replace(/^www\./, '');
      return hostname.split('.')[0] || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Generate cache key for folder structure
   */
  private getFolderCacheKey(record: AdRecord): string {
    switch (config.googleDrive.folderStructure) {
      case 'date':
        return `date_${moment().format('YYYY-MM-DD')}`;
      case 'platform':
        const platform = this.extractPlatformFromUrl(record.WebsiteURL);
        const date = config.storage.createDateFolders ? `_${moment().format('YYYY-MM-DD')}` : '';
        return `platform_${platform}${date}`;
      case 'flat':
      default:
        return 'flat';
    }
  }

  /**
   * Create shared link for file
   */
  public async createShareLink(fileId: string, viewOnly: boolean = true): Promise<string | null> {
    if (!this.drive) {
      return null;
    }

    try {
      // First, make sure file has appropriate permissions
      await this.drive.permissions.create({
        fileId,
        requestBody: {
          role: viewOnly ? 'reader' : 'writer',
          type: 'anyone',
        },
      });

      // Get the file info to return the web view link
      const response = await this.drive.files.get({
        fileId,
        fields: 'webViewLink',
      });

      return response.data.webViewLink;
    } catch (error) {
      logger.error('Failed to create share link', error, { fileId });
      return null;
    }
  }

  /**
   * Clean up old uploads
   */
  public async cleanupOldUploads(
    maxAge: number = 90, // days
    folderId?: string
  ): Promise<{ deletedCount: number; errors: string[] }> {
    if (!this.drive) {
      return { deletedCount: 0, errors: ['Google Drive service not initialized'] };
    }

    const result = { deletedCount: 0, errors: [] as string[] };
    const cutoffDate = moment().subtract(maxAge, 'days').toISOString();

    try {
      let query = `trashed=false and createdTime < '${cutoffDate}'`;
      
      if (folderId) {
        query += ` and '${folderId}' in parents`;
      }

      const response = await this.drive.files.list({
        q: query,
        fields: 'files(id, name, createdTime)',
      });

      const oldFiles = response.data.files || [];

      for (const file of oldFiles) {
        try {
          await this.drive.files.delete({ fileId: file.id });
          result.deletedCount++;
          
          logger.debug('Old file deleted', {
            fileId: file.id,
            name: file.name,
            age: moment().diff(moment(file.createdTime), 'days'),
          });
        } catch (error) {
          result.errors.push(`Failed to delete ${file.name}: ${error.message}`);
        }
      }

      logger.info('Google Drive cleanup completed', {
        deletedCount: result.deletedCount,
        errors: result.errors.length,
        maxAge,
      });

      return result;
    } catch (error) {
      logger.error('Google Drive cleanup failed', error);
      return { deletedCount: 0, errors: [error.message] };
    }
  }
}