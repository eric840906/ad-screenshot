"use strict";
/**
 * Upload service for Google Drive integration
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
exports.UploadService = void 0;
const googleapis_1 = require("googleapis");
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const moment_1 = __importDefault(require("moment"));
const LoggingService_1 = require("./LoggingService");
const config_1 = require("../config");
class UploadService {
    drive;
    auth;
    folderCache = new Map();
    static instance;
    constructor() {
        this.initializeGoogleDrive();
    }
    /**
     * Get singleton instance
     */
    static getInstance() {
        if (!UploadService.instance) {
            UploadService.instance = new UploadService();
        }
        return UploadService.instance;
    }
    /**
     * Initialize Google Drive API
     */
    async initializeGoogleDrive() {
        try {
            if (!config_1.config.googleDrive.enabled || !config_1.config.googleDrive.keyFilePath) {
                LoggingService_1.logger.warn('Google Drive upload is disabled or no key file provided');
                return;
            }
            if (!await fs.pathExists(config_1.config.googleDrive.keyFilePath)) {
                throw new Error(`Google Drive key file not found: ${config_1.config.googleDrive.keyFilePath}`);
            }
            this.auth = new googleapis_1.google.auth.GoogleAuth({
                keyFile: config_1.config.googleDrive.keyFilePath,
                scopes: [
                    'https://www.googleapis.com/auth/drive.file',
                    'https://www.googleapis.com/auth/drive.metadata',
                ],
            });
            this.drive = googleapis_1.google.drive({ version: 'v3', auth: this.auth });
            // Test connection
            await this.drive.about.get({ fields: 'user' });
            LoggingService_1.logger.info('Google Drive service initialized successfully');
        }
        catch (error) {
            LoggingService_1.logger.error('Failed to initialize Google Drive service', error);
            throw error;
        }
    }
    /**
     * Upload file to Google Drive
     */
    async uploadFile(filePath, options = {}, record) {
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
            let parentFolderId = options.parentFolderId || config_1.config.googleDrive.parentFolderId;
            if (config_1.config.googleDrive.createFolders && record) {
                parentFolderId = await this.ensureFolderStructure(record);
            }
            // Prepare file metadata
            const fileMetadata = {
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
            LoggingService_1.logger.logUpload(true, fileName, 'gdrive', {
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
        }
        catch (error) {
            const duration = Date.now() - startTime;
            LoggingService_1.logger.logUpload(false, path.basename(filePath), 'gdrive', {
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
    async ensureFolderStructure(record) {
        const cacheKey = this.getFolderCacheKey(record);
        if (this.folderCache.has(cacheKey)) {
            return this.folderCache.get(cacheKey);
        }
        try {
            let currentParentId = config_1.config.googleDrive.parentFolderId;
            switch (config_1.config.googleDrive.folderStructure) {
                case 'date':
                    currentParentId = await this.ensureFolder((0, moment_1.default)().format('YYYY-MM-DD'), currentParentId);
                    break;
                case 'platform':
                    const platform = this.extractPlatformFromUrl(record.WebsiteURL);
                    currentParentId = await this.ensureFolder(platform, currentParentId);
                    // Add date subfolder if enabled
                    if (config_1.config.storage.createDateFolders) {
                        currentParentId = await this.ensureFolder((0, moment_1.default)().format('YYYY-MM-DD'), currentParentId);
                    }
                    break;
                case 'flat':
                default:
                    // Use parent folder as-is
                    break;
            }
            this.folderCache.set(cacheKey, currentParentId || '');
            return currentParentId || '';
        }
        catch (error) {
            LoggingService_1.logger.error('Failed to ensure folder structure', error, { record });
            return config_1.config.googleDrive.parentFolderId || '';
        }
    }
    /**
     * Ensure folder exists, create if necessary
     */
    async ensureFolder(folderName, parentId) {
        try {
            // Check if folder already exists
            const existingFolder = await this.findFolder(folderName, parentId);
            if (existingFolder) {
                return existingFolder.id;
            }
            // Create new folder
            const folderMetadata = {
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
            LoggingService_1.logger.debug('Google Drive folder created', {
                name: folderName,
                id: response.data.id,
                parentId,
            });
            return response.data.id;
        }
        catch (error) {
            LoggingService_1.logger.error('Failed to ensure folder', error, { folderName, parentId });
            throw error;
        }
    }
    /**
     * Find existing folder by name and parent
     */
    async findFolder(folderName, parentId) {
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
        }
        catch (error) {
            LoggingService_1.logger.error('Failed to find folder', error, { folderName, parentId });
            return null;
        }
    }
    /**
     * Make file publicly accessible
     */
    async makeFilePublic(fileId) {
        try {
            await this.drive.permissions.create({
                fileId,
                requestBody: {
                    role: 'reader',
                    type: 'anyone',
                },
            });
            LoggingService_1.logger.debug('File made public', { fileId });
        }
        catch (error) {
            LoggingService_1.logger.warn('Failed to make file public', { fileId, error: error.message });
        }
    }
    /**
     * Upload multiple files in batch
     */
    async batchUpload(files, concurrency = 3) {
        const startTime = Date.now();
        const results = [];
        LoggingService_1.logger.info('Starting batch upload', {
            fileCount: files.length,
            concurrency,
        });
        // Process files in batches to avoid overwhelming the API
        for (let i = 0; i < files.length; i += concurrency) {
            const batch = files.slice(i, i + concurrency);
            const batchPromises = batch.map(async (file) => {
                try {
                    return await this.uploadFile(file.filePath, file.options, file.record);
                }
                catch (error) {
                    return {
                        success: false,
                        error: error.message,
                    };
                }
            });
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
            // Log progress
            LoggingService_1.logger.debug('Batch upload progress', {
                completed: i + batch.length,
                total: files.length,
                successInBatch: batchResults.filter(r => r.success).length,
            });
        }
        const successCount = results.filter(r => r.success).length;
        const failureCount = results.length - successCount;
        const duration = Date.now() - startTime;
        LoggingService_1.logger.info('Batch upload completed', {
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
    async deleteFile(fileId) {
        if (!this.drive) {
            return false;
        }
        try {
            await this.drive.files.delete({ fileId });
            LoggingService_1.logger.debug('File deleted from Google Drive', { fileId });
            return true;
        }
        catch (error) {
            LoggingService_1.logger.error('Failed to delete file from Google Drive', error, { fileId });
            return false;
        }
    }
    /**
     * Get file information
     */
    async getFileInfo(fileId) {
        if (!this.drive) {
            throw new Error('Google Drive service not initialized');
        }
        try {
            const response = await this.drive.files.get({
                fileId,
                fields: 'id, name, size, createdTime, modifiedTime, webViewLink, webContentLink, parents',
            });
            return response.data;
        }
        catch (error) {
            LoggingService_1.logger.error('Failed to get file info', error, { fileId });
            throw error;
        }
    }
    /**
     * List files in a folder
     */
    async listFiles(folderId, maxResults = 100) {
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
        }
        catch (error) {
            LoggingService_1.logger.error('Failed to list files', error, { folderId });
            throw error;
        }
    }
    /**
     * Get storage quota information
     */
    async getStorageQuota() {
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
        }
        catch (error) {
            LoggingService_1.logger.error('Failed to get storage quota', error);
            throw error;
        }
    }
    /**
     * Test Google Drive connection
     */
    async testConnection() {
        if (!this.drive) {
            return false;
        }
        try {
            await this.drive.about.get({ fields: 'user' });
            LoggingService_1.logger.debug('Google Drive connection test successful');
            return true;
        }
        catch (error) {
            LoggingService_1.logger.error('Google Drive connection test failed', error);
            return false;
        }
    }
    /**
     * Get MIME type from file extension
     */
    getMimeType(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
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
     * Generate cache key for folder structure
     */
    getFolderCacheKey(record) {
        switch (config_1.config.googleDrive.folderStructure) {
            case 'date':
                return `date_${(0, moment_1.default)().format('YYYY-MM-DD')}`;
            case 'platform':
                const platform = this.extractPlatformFromUrl(record.WebsiteURL);
                const date = config_1.config.storage.createDateFolders ? `_${(0, moment_1.default)().format('YYYY-MM-DD')}` : '';
                return `platform_${platform}${date}`;
            case 'flat':
            default:
                return 'flat';
        }
    }
    /**
     * Create shared link for file
     */
    async createShareLink(fileId, viewOnly = true) {
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
        }
        catch (error) {
            LoggingService_1.logger.error('Failed to create share link', error, { fileId });
            return null;
        }
    }
    /**
     * Clean up old uploads
     */
    async cleanupOldUploads(maxAge = 90, // days
    folderId) {
        if (!this.drive) {
            return { deletedCount: 0, errors: ['Google Drive service not initialized'] };
        }
        const result = { deletedCount: 0, errors: [] };
        const cutoffDate = (0, moment_1.default)().subtract(maxAge, 'days').toISOString();
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
                    LoggingService_1.logger.debug('Old file deleted', {
                        fileId: file.id,
                        name: file.name,
                        age: (0, moment_1.default)().diff((0, moment_1.default)(file.createdTime), 'days'),
                    });
                }
                catch (error) {
                    result.errors.push(`Failed to delete ${file.name}: ${error.message}`);
                }
            }
            LoggingService_1.logger.info('Google Drive cleanup completed', {
                deletedCount: result.deletedCount,
                errors: result.errors.length,
                maxAge,
            });
            return result;
        }
        catch (error) {
            LoggingService_1.logger.error('Google Drive cleanup failed', error);
            return { deletedCount: 0, errors: [error.message] };
        }
    }
}
exports.UploadService = UploadService;
//# sourceMappingURL=UploadService.js.map