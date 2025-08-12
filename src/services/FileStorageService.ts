/**
 * File storage service for local storage with organized folder structure
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as moment from 'moment';
import { StorageOptions, AdRecord } from '@/types';
import { logger } from './LoggingService';
import { config } from '@/config';

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

export class FileStorageService {
  private baseDirectory: string;
  private static instance: FileStorageService;

  constructor() {
    this.baseDirectory = config.storage.baseDirectory;
    this.initializeStorage();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): FileStorageService {
    if (!FileStorageService.instance) {
      FileStorageService.instance = new FileStorageService();
    }
    return FileStorageService.instance;
  }

  /**
   * Initialize storage directories
   */
  private async initializeStorage(): Promise<void> {
    try {
      await fs.ensureDir(this.baseDirectory);
      
      // Create subdirectories
      const subdirs = ['screenshots', 'logs', 'reports', 'temp', 'data'];
      for (const subdir of subdirs) {
        await fs.ensureDir(path.join(this.baseDirectory, subdir));
      }

      logger.info('File storage service initialized', {
        baseDirectory: this.baseDirectory,
        subdirectories: subdirs,
      });
    } catch (error) {
      logger.error('Failed to initialize storage', error);
      throw error;
    }
  }

  /**
   * Get organized file path based on storage options
   */
  public getOrganizedPath(
    fileName: string,
    type: 'screenshot' | 'log' | 'report' | 'data' = 'screenshot',
    record?: AdRecord
  ): string {
    let basePath = path.join(this.baseDirectory, type + 's');

    switch (config.storage.organizationPattern) {
      case 'date':
        const dateFolder = moment().format('YYYY-MM-DD');
        basePath = path.join(basePath, dateFolder);
        break;

      case 'platform':
        if (record) {
          const platform = this.extractPlatformFromUrl(record.WebsiteURL);
          basePath = path.join(basePath, platform);
          
          if (config.storage.createDateFolders) {
            const dateFolder = moment().format('YYYY-MM-DD');
            basePath = path.join(basePath, dateFolder);
          }
        }
        break;

      case 'flat':
      default:
        // Keep flat structure
        break;
    }

    return path.join(basePath, fileName);
  }

  /**
   * Save file with organized structure
   */
  public async saveFile(
    content: Buffer | string,
    fileName: string,
    type: 'screenshot' | 'log' | 'report' | 'data' = 'screenshot',
    record?: AdRecord
  ): Promise<FileMetadata> {
    try {
      const filePath = this.getOrganizedPath(fileName, type, record);
      
      // Ensure directory exists
      await fs.ensureDir(path.dirname(filePath));

      // Save file
      await fs.writeFile(filePath, content);

      // Get file stats
      const stats = await fs.stat(filePath);

      const metadata: FileMetadata = {
        fileName,
        filePath,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        type,
        record,
      };

      logger.debug('File saved', {
        fileName,
        filePath,
        size: stats.size,
        type,
      });

      return metadata;
    } catch (error) {
      logger.error('Failed to save file', error, { fileName, type });
      throw error;
    }
  }

  /**
   * Read file from storage
   */
  public async readFile(filePath: string): Promise<Buffer> {
    try {
      const absolutePath = path.isAbsolute(filePath) 
        ? filePath 
        : path.join(this.baseDirectory, filePath);

      const content = await fs.readFile(absolutePath);
      
      logger.debug('File read', { filePath: absolutePath, size: content.length });
      
      return content;
    } catch (error) {
      logger.error('Failed to read file', error, { filePath });
      throw error;
    }
  }

  /**
   * Check if file exists
   */
  public async fileExists(filePath: string): Promise<boolean> {
    try {
      const absolutePath = path.isAbsolute(filePath) 
        ? filePath 
        : path.join(this.baseDirectory, filePath);

      return await fs.pathExists(absolutePath);
    } catch {
      return false;
    }
  }

  /**
   * Delete file
   */
  public async deleteFile(filePath: string): Promise<void> {
    try {
      const absolutePath = path.isAbsolute(filePath) 
        ? filePath 
        : path.join(this.baseDirectory, filePath);

      await fs.remove(absolutePath);
      
      logger.debug('File deleted', { filePath: absolutePath });
    } catch (error) {
      logger.error('Failed to delete file', error, { filePath });
      throw error;
    }
  }

  /**
   * Move file to different location
   */
  public async moveFile(sourcePath: string, destinationPath: string): Promise<void> {
    try {
      const absoluteSource = path.isAbsolute(sourcePath) 
        ? sourcePath 
        : path.join(this.baseDirectory, sourcePath);
      
      const absoluteDestination = path.isAbsolute(destinationPath) 
        ? destinationPath 
        : path.join(this.baseDirectory, destinationPath);

      // Ensure destination directory exists
      await fs.ensureDir(path.dirname(absoluteDestination));

      await fs.move(absoluteSource, absoluteDestination);
      
      logger.debug('File moved', { 
        source: absoluteSource, 
        destination: absoluteDestination 
      });
    } catch (error) {
      logger.error('Failed to move file', error, { sourcePath, destinationPath });
      throw error;
    }
  }

  /**
   * Copy file to different location
   */
  public async copyFile(sourcePath: string, destinationPath: string): Promise<void> {
    try {
      const absoluteSource = path.isAbsolute(sourcePath) 
        ? sourcePath 
        : path.join(this.baseDirectory, sourcePath);
      
      const absoluteDestination = path.isAbsolute(destinationPath) 
        ? destinationPath 
        : path.join(this.baseDirectory, destinationPath);

      // Ensure destination directory exists
      await fs.ensureDir(path.dirname(absoluteDestination));

      await fs.copy(absoluteSource, absoluteDestination);
      
      logger.debug('File copied', { 
        source: absoluteSource, 
        destination: absoluteDestination 
      });
    } catch (error) {
      logger.error('Failed to copy file', error, { sourcePath, destinationPath });
      throw error;
    }
  }

  /**
   * List files in directory with metadata
   */
  public async listFiles(
    directory: string = '',
    type?: 'screenshot' | 'log' | 'report' | 'data',
    recursive: boolean = false
  ): Promise<FileMetadata[]> {
    try {
      const searchPath = directory 
        ? path.join(this.baseDirectory, directory)
        : type 
        ? path.join(this.baseDirectory, type + 's')
        : this.baseDirectory;

      const files: FileMetadata[] = [];

      if (!await fs.pathExists(searchPath)) {
        return files;
      }

      await this.scanDirectory(searchPath, files, recursive, type);

      // Sort by modification date (newest first)
      files.sort((a, b) => b.modified.getTime() - a.modified.getTime());

      logger.debug('Files listed', {
        directory: searchPath,
        count: files.length,
        recursive,
        type,
      });

      return files;
    } catch (error) {
      logger.error('Failed to list files', error, { directory, type });
      throw error;
    }
  }

  /**
   * Recursively scan directory for files
   */
  private async scanDirectory(
    dirPath: string,
    files: FileMetadata[],
    recursive: boolean,
    fileType?: string
  ): Promise<void> {
    const items = await fs.readdir(dirPath);

    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const stats = await fs.stat(fullPath);

      if (stats.isDirectory() && recursive) {
        await this.scanDirectory(fullPath, files, recursive, fileType);
      } else if (stats.isFile()) {
        const metadata: FileMetadata = {
          fileName: item,
          filePath: fullPath,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          type: this.getFileTypeFromPath(fullPath),
        };

        // Filter by type if specified
        if (!fileType || metadata.type === fileType) {
          files.push(metadata);
        }
      }
    }
  }

  /**
   * Get file type from path
   */
  private getFileTypeFromPath(filePath: string): 'screenshot' | 'log' | 'report' | 'data' {
    const relativePath = path.relative(this.baseDirectory, filePath);
    const parts = relativePath.split(path.sep);

    if (parts[0]?.endsWith('s')) {
      const type = parts[0].slice(0, -1); // Remove 's' suffix
      if (['screenshot', 'log', 'report', 'data'].includes(type)) {
        return type as 'screenshot' | 'log' | 'report' | 'data';
      }
    }

    // Fallback based on file extension
    const ext = path.extname(filePath).toLowerCase();
    if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
      return 'screenshot';
    } else if (['.log', '.txt'].includes(ext)) {
      return 'log';
    } else if (['.json', '.csv'].includes(ext)) {
      return 'data';
    } else {
      return 'report';
    }
  }

  /**
   * Get storage statistics
   */
  public async getStorageStats(): Promise<StorageStats> {
    try {
      const allFiles = await this.listFiles('', undefined, true);

      const stats: StorageStats = {
        totalFiles: allFiles.length,
        totalSize: 0,
        filesByType: { screenshot: 0, log: 0, report: 0, data: 0 },
        sizeByType: { screenshot: 0, log: 0, report: 0, data: 0 },
        oldestFile: null,
        newestFile: null,
      };

      for (const file of allFiles) {
        stats.totalSize += file.size;
        stats.filesByType[file.type]++;
        stats.sizeByType[file.type] += file.size;

        if (!stats.oldestFile || file.created < stats.oldestFile) {
          stats.oldestFile = file.created;
        }
        if (!stats.newestFile || file.created > stats.newestFile) {
          stats.newestFile = file.created;
        }
      }

      logger.debug('Storage stats calculated', stats);

      return stats;
    } catch (error) {
      logger.error('Failed to get storage stats', error);
      throw error;
    }
  }

  /**
   * Clean up old files
   */
  public async cleanup(
    maxAge: number = 30, // days
    types: Array<'screenshot' | 'log' | 'report' | 'data'> = ['log', 'report'],
    dryRun: boolean = false
  ): Promise<CleanupResult> {
    const result: CleanupResult = {
      deletedFiles: 0,
      freedSpace: 0,
      errors: [],
    };

    try {
      const cutoffDate = moment().subtract(maxAge, 'days').toDate();

      for (const type of types) {
        const files = await this.listFiles('', type, true);
        
        for (const file of files) {
          if (file.created < cutoffDate) {
            try {
              if (!dryRun) {
                await this.deleteFile(file.filePath);
              }
              result.deletedFiles++;
              result.freedSpace += file.size;
            } catch (error) {
              result.errors.push(`Failed to delete ${file.filePath}: ${error.message}`);
            }
          }
        }
      }

      logger.info('Storage cleanup completed', {
        ...result,
        dryRun,
        maxAge,
        types,
        freedSpaceMB: (result.freedSpace / 1024 / 1024).toFixed(2),
      });

      return result;
    } catch (error) {
      logger.error('Storage cleanup failed', error);
      throw error;
    }
  }

  /**
   * Archive old files to compressed format
   */
  public async archiveFiles(
    maxAge: number = 60, // days
    types: Array<'screenshot' | 'log' | 'report' | 'data'> = ['screenshot', 'log']
  ): Promise<{ archivedFiles: number; archivePath: string }> {
    try {
      const cutoffDate = moment().subtract(maxAge, 'days').toDate();
      const archiveName = `archive_${moment().format('YYYY-MM-DD_HH-mm-ss')}.tar.gz`;
      const archivePath = path.join(this.baseDirectory, 'archives', archiveName);

      // Ensure archive directory exists
      await fs.ensureDir(path.dirname(archivePath));

      let archivedFiles = 0;
      const filesToArchive: string[] = [];

      for (const type of types) {
        const files = await this.listFiles('', type, true);
        
        for (const file of files) {
          if (file.created < cutoffDate) {
            filesToArchive.push(file.filePath);
            archivedFiles++;
          }
        }
      }

      if (filesToArchive.length > 0) {
        // Note: In a real implementation, you'd use a library like node-tar
        // This is a simplified version
        logger.info('Files marked for archiving', {
          count: filesToArchive.length,
          archivePath,
        });

        // For now, just move files to archive directory
        const archiveDataPath = path.join(path.dirname(archivePath), 'data');
        await fs.ensureDir(archiveDataPath);

        for (const filePath of filesToArchive) {
          const relativePath = path.relative(this.baseDirectory, filePath);
          const archiveFilePath = path.join(archiveDataPath, relativePath);
          await fs.ensureDir(path.dirname(archiveFilePath));
          await fs.move(filePath, archiveFilePath);
        }
      }

      logger.info('File archiving completed', {
        archivedFiles,
        archivePath,
      });

      return { archivedFiles, archivePath };
    } catch (error) {
      logger.error('File archiving failed', error);
      throw error;
    }
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
   * Create backup of important files
   */
  public async createBackup(
    backupName?: string,
    types: Array<'screenshot' | 'log' | 'report' | 'data'> = ['screenshot', 'data']
  ): Promise<string> {
    try {
      const backupDir = backupName || `backup_${moment().format('YYYY-MM-DD_HH-mm-ss')}`;
      const backupPath = path.join(this.baseDirectory, 'backups', backupDir);

      await fs.ensureDir(backupPath);

      let totalFiles = 0;
      let totalSize = 0;

      for (const type of types) {
        const sourcePath = path.join(this.baseDirectory, type + 's');
        const destinationPath = path.join(backupPath, type + 's');

        if (await fs.pathExists(sourcePath)) {
          await fs.copy(sourcePath, destinationPath);
          
          const files = await this.listFiles(type + 's', undefined, true);
          totalFiles += files.length;
          totalSize += files.reduce((sum, file) => sum + file.size, 0);
        }
      }

      // Create backup metadata
      const metadata = {
        created: new Date().toISOString(),
        types,
        totalFiles,
        totalSize,
        version: '1.0.0',
      };

      await fs.writeJson(path.join(backupPath, 'metadata.json'), metadata, { spaces: 2 });

      logger.info('Backup created', {
        backupPath,
        totalFiles,
        totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
        types,
      });

      return backupPath;
    } catch (error) {
      logger.error('Backup creation failed', error);
      throw error;
    }
  }

  /**
   * Get available disk space
   */
  public async getDiskSpace(): Promise<{
    free: number;
    total: number;
    used: number;
    usedPercentage: number;
  }> {
    try {
      // Note: This is a simplified implementation
      // In production, you'd use a library like 'check-disk-space'
      const stats = await fs.stat(this.baseDirectory);
      
      // Placeholder values - replace with actual disk space check
      return {
        free: 1024 * 1024 * 1024 * 10, // 10GB
        total: 1024 * 1024 * 1024 * 100, // 100GB
        used: 1024 * 1024 * 1024 * 90, // 90GB
        usedPercentage: 90,
      };
    } catch (error) {
      logger.error('Failed to get disk space', error);
      throw error;
    }
  }
}