"use strict";
/**
 * File storage service for local storage with organized folder structure
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
exports.FileStorageService = void 0;
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const moment_1 = __importDefault(require("moment"));
const LoggingService_1 = require("./LoggingService");
const config_1 = require("../config");
class FileStorageService {
    baseDirectory;
    static instance;
    constructor() {
        this.baseDirectory = config_1.config.storage.baseDirectory;
        this.initializeStorage();
    }
    /**
     * Get singleton instance
     */
    static getInstance() {
        if (!FileStorageService.instance) {
            FileStorageService.instance = new FileStorageService();
        }
        return FileStorageService.instance;
    }
    /**
     * Initialize storage directories
     */
    async initializeStorage() {
        try {
            await fs.ensureDir(this.baseDirectory);
            // Create subdirectories
            const subdirs = ['screenshots', 'logs', 'reports', 'temp', 'data'];
            for (const subdir of subdirs) {
                await fs.ensureDir(path.join(this.baseDirectory, subdir));
            }
            LoggingService_1.logger.info('File storage service initialized', {
                baseDirectory: this.baseDirectory,
                subdirectories: subdirs,
            });
        }
        catch (error) {
            LoggingService_1.logger.error('Failed to initialize storage', error);
            throw error;
        }
    }
    /**
     * Get organized file path based on storage options
     */
    getOrganizedPath(fileName, type = 'screenshot', record) {
        let basePath = path.join(this.baseDirectory, type + 's');
        switch (config_1.config.storage.organizationPattern) {
            case 'date':
                const dateFolder = (0, moment_1.default)().format('YYYY-MM-DD');
                basePath = path.join(basePath, dateFolder);
                break;
            case 'platform':
                if (record) {
                    const platform = this.extractPlatformFromUrl(record.WebsiteURL);
                    basePath = path.join(basePath, platform);
                    if (config_1.config.storage.createDateFolders) {
                        const dateFolder = (0, moment_1.default)().format('YYYY-MM-DD');
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
    async saveFile(content, fileName, type = 'screenshot', record) {
        try {
            const filePath = this.getOrganizedPath(fileName, type, record);
            // Ensure directory exists
            await fs.ensureDir(path.dirname(filePath));
            // Save file
            await fs.writeFile(filePath, content);
            // Get file stats
            const stats = await fs.stat(filePath);
            const metadata = {
                fileName,
                filePath,
                size: stats.size,
                created: stats.birthtime,
                modified: stats.mtime,
                type,
                record,
            };
            LoggingService_1.logger.debug('File saved', {
                fileName,
                filePath,
                size: stats.size,
                type,
            });
            return metadata;
        }
        catch (error) {
            LoggingService_1.logger.error('Failed to save file', error, { fileName, type });
            throw error;
        }
    }
    /**
     * Read file from storage
     */
    async readFile(filePath) {
        try {
            const absolutePath = path.isAbsolute(filePath)
                ? filePath
                : path.join(this.baseDirectory, filePath);
            const content = await fs.readFile(absolutePath);
            LoggingService_1.logger.debug('File read', { filePath: absolutePath, size: content.length });
            return content;
        }
        catch (error) {
            LoggingService_1.logger.error('Failed to read file', error, { filePath });
            throw error;
        }
    }
    /**
     * Check if file exists
     */
    async fileExists(filePath) {
        try {
            const absolutePath = path.isAbsolute(filePath)
                ? filePath
                : path.join(this.baseDirectory, filePath);
            return await fs.pathExists(absolutePath);
        }
        catch {
            return false;
        }
    }
    /**
     * Delete file
     */
    async deleteFile(filePath) {
        try {
            const absolutePath = path.isAbsolute(filePath)
                ? filePath
                : path.join(this.baseDirectory, filePath);
            await fs.remove(absolutePath);
            LoggingService_1.logger.debug('File deleted', { filePath: absolutePath });
        }
        catch (error) {
            LoggingService_1.logger.error('Failed to delete file', error, { filePath });
            throw error;
        }
    }
    /**
     * Move file to different location
     */
    async moveFile(sourcePath, destinationPath) {
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
            LoggingService_1.logger.debug('File moved', {
                source: absoluteSource,
                destination: absoluteDestination
            });
        }
        catch (error) {
            LoggingService_1.logger.error('Failed to move file', error, { sourcePath, destinationPath });
            throw error;
        }
    }
    /**
     * Copy file to different location
     */
    async copyFile(sourcePath, destinationPath) {
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
            LoggingService_1.logger.debug('File copied', {
                source: absoluteSource,
                destination: absoluteDestination
            });
        }
        catch (error) {
            LoggingService_1.logger.error('Failed to copy file', error, { sourcePath, destinationPath });
            throw error;
        }
    }
    /**
     * List files in directory with metadata
     */
    async listFiles(directory = '', type, recursive = false) {
        try {
            const searchPath = directory
                ? path.join(this.baseDirectory, directory)
                : type
                    ? path.join(this.baseDirectory, type + 's')
                    : this.baseDirectory;
            const files = [];
            if (!await fs.pathExists(searchPath)) {
                return files;
            }
            await this.scanDirectory(searchPath, files, recursive, type);
            // Sort by modification date (newest first)
            files.sort((a, b) => b.modified.getTime() - a.modified.getTime());
            LoggingService_1.logger.debug('Files listed', {
                directory: searchPath,
                count: files.length,
                recursive,
                type,
            });
            return files;
        }
        catch (error) {
            LoggingService_1.logger.error('Failed to list files', error, { directory, type });
            throw error;
        }
    }
    /**
     * Recursively scan directory for files
     */
    async scanDirectory(dirPath, files, recursive, fileType) {
        const items = await fs.readdir(dirPath);
        for (const item of items) {
            const fullPath = path.join(dirPath, item);
            const stats = await fs.stat(fullPath);
            if (stats.isDirectory() && recursive) {
                await this.scanDirectory(fullPath, files, recursive, fileType);
            }
            else if (stats.isFile()) {
                const metadata = {
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
    getFileTypeFromPath(filePath) {
        const relativePath = path.relative(this.baseDirectory, filePath);
        const parts = relativePath.split(path.sep);
        if (parts[0]?.endsWith('s')) {
            const type = parts[0].slice(0, -1); // Remove 's' suffix
            if (['screenshot', 'log', 'report', 'data'].includes(type)) {
                return type;
            }
        }
        // Fallback based on file extension
        const ext = path.extname(filePath).toLowerCase();
        if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
            return 'screenshot';
        }
        else if (['.log', '.txt'].includes(ext)) {
            return 'log';
        }
        else if (['.json', '.csv'].includes(ext)) {
            return 'data';
        }
        else {
            return 'report';
        }
    }
    /**
     * Get storage statistics
     */
    async getStorageStats() {
        try {
            const allFiles = await this.listFiles('', undefined, true);
            const stats = {
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
            LoggingService_1.logger.debug('Storage stats calculated', stats);
            return stats;
        }
        catch (error) {
            LoggingService_1.logger.error('Failed to get storage stats', error);
            throw error;
        }
    }
    /**
     * Clean up old files
     */
    async cleanup(maxAge = 30, // days
    types = ['log', 'report'], dryRun = false) {
        const result = {
            deletedFiles: 0,
            freedSpace: 0,
            errors: [],
        };
        try {
            const cutoffDate = (0, moment_1.default)().subtract(maxAge, 'days').toDate();
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
                        }
                        catch (error) {
                            result.errors.push(`Failed to delete ${file.filePath}: ${error.message}`);
                        }
                    }
                }
            }
            LoggingService_1.logger.info('Storage cleanup completed', {
                ...result,
                dryRun,
                maxAge,
                types,
                freedSpaceMB: (result.freedSpace / 1024 / 1024).toFixed(2),
            });
            return result;
        }
        catch (error) {
            LoggingService_1.logger.error('Storage cleanup failed', error);
            throw error;
        }
    }
    /**
     * Archive old files to compressed format
     */
    async archiveFiles(maxAge = 60, // days
    types = ['screenshot', 'log']) {
        try {
            const cutoffDate = (0, moment_1.default)().subtract(maxAge, 'days').toDate();
            const archiveName = `archive_${(0, moment_1.default)().format('YYYY-MM-DD_HH-mm-ss')}.tar.gz`;
            const archivePath = path.join(this.baseDirectory, 'archives', archiveName);
            // Ensure archive directory exists
            await fs.ensureDir(path.dirname(archivePath));
            let archivedFiles = 0;
            const filesToArchive = [];
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
                LoggingService_1.logger.info('Files marked for archiving', {
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
            LoggingService_1.logger.info('File archiving completed', {
                archivedFiles,
                archivePath,
            });
            return { archivedFiles, archivePath };
        }
        catch (error) {
            LoggingService_1.logger.error('File archiving failed', error);
            throw error;
        }
    }
    /**
     * Extract platform name from URL
     */
    extractPlatformFromUrl(url) {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.replace(/^www\./, '');
            return hostname.split('.')[0] || 'unknown';
        }
        catch {
            return 'unknown';
        }
    }
    /**
     * Create backup of important files
     */
    async createBackup(backupName, types = ['screenshot', 'data']) {
        try {
            const backupDir = backupName || `backup_${(0, moment_1.default)().format('YYYY-MM-DD_HH-mm-ss')}`;
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
            LoggingService_1.logger.info('Backup created', {
                backupPath,
                totalFiles,
                totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
                types,
            });
            return backupPath;
        }
        catch (error) {
            LoggingService_1.logger.error('Backup creation failed', error);
            throw error;
        }
    }
    /**
     * Get available disk space
     */
    async getDiskSpace() {
        try {
            // Note: This is a simplified implementation
            // In production, you'd use a library like 'check-disk-space'
            await fs.stat(this.baseDirectory); // Check if directory exists
            // Placeholder values - replace with actual disk space check
            return {
                free: 1024 * 1024 * 1024 * 10, // 10GB
                total: 1024 * 1024 * 1024 * 100, // 100GB
                used: 1024 * 1024 * 1024 * 90, // 90GB
                usedPercentage: 90,
            };
        }
        catch (error) {
            LoggingService_1.logger.error('Failed to get disk space', error);
            throw error;
        }
    }
}
exports.FileStorageService = FileStorageService;
//# sourceMappingURL=FileStorageService.js.map