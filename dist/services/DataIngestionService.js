"use strict";
/**
 * Data ingestion service for parsing Google Sheets and CSV files
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
exports.DataIngestionService = void 0;
const fs = __importStar(require("fs-extra"));
const csv_parser_1 = __importDefault(require("csv-parser"));
const googleapis_1 = require("googleapis");
const LoggingService_1 = require("./LoggingService");
const config_1 = require("../config");
class DataIngestionService {
    sheetsService;
    constructor() {
        this.initializeGoogleSheets();
    }
    /**
     * Initialize Google Sheets API service
     */
    async initializeGoogleSheets() {
        try {
            if (config_1.config.googleDrive.keyFilePath && fs.existsSync(config_1.config.googleDrive.keyFilePath)) {
                const auth = new googleapis_1.google.auth.GoogleAuth({
                    keyFile: config_1.config.googleDrive.keyFilePath,
                    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
                });
                this.sheetsService = googleapis_1.google.sheets({ version: 'v4', auth });
                LoggingService_1.logger.info('Google Sheets API initialized successfully');
            }
        }
        catch (error) {
            LoggingService_1.logger.warn('Failed to initialize Google Sheets API', error);
        }
    }
    /**
     * Parse data from various sources
     */
    async parseData(source) {
        LoggingService_1.logger.info('Starting data ingestion', { source });
        try {
            let rawData;
            switch (source.type) {
                case 'csv':
                    rawData = await this.parseCsvFile(source.path);
                    break;
                case 'google_sheets':
                    rawData = await this.parseGoogleSheet(source.spreadsheetId, source.range || source.sheetName || 'Sheet1');
                    break;
                default:
                    throw new Error(`Unsupported data source type: ${source.type}`);
            }
            const validationResult = this.validateAndTransformData(rawData);
            if (validationResult.errors.length > 0) {
                LoggingService_1.logger.warn('Data validation warnings', {
                    totalErrors: validationResult.errors.length,
                    validRecords: validationResult.validRecords.length,
                    invalidRecords: validationResult.invalidRecords.length,
                });
            }
            LoggingService_1.logger.info('Data ingestion completed', {
                totalRecords: rawData.length,
                validRecords: validationResult.validRecords.length,
                invalidRecords: validationResult.invalidRecords.length,
            });
            return validationResult.validRecords;
        }
        catch (error) {
            LoggingService_1.logger.error('Data ingestion failed', error, { source });
            throw error;
        }
    }
    /**
     * Parse CSV file
     */
    async parseCsvFile(filePath) {
        return new Promise((resolve, reject) => {
            const results = [];
            if (!fs.existsSync(filePath)) {
                reject(new Error(`CSV file not found: ${filePath}`));
                return;
            }
            fs.createReadStream(filePath)
                .pipe((0, csv_parser_1.default)())
                .on('data', (data) => results.push(data))
                .on('end', () => {
                LoggingService_1.logger.debug(`Parsed ${results.length} rows from CSV file: ${filePath}`);
                resolve(results);
            })
                .on('error', (error) => {
                LoggingService_1.logger.error('CSV parsing error', { error, filePath });
                reject(error);
            });
        });
    }
    /**
     * Parse Google Sheets data
     */
    async parseGoogleSheet(spreadsheetId, range) {
        if (!this.sheetsService) {
            throw new Error('Google Sheets service not initialized');
        }
        try {
            const response = await this.sheetsService.spreadsheets.values.get({
                spreadsheetId,
                range,
            });
            const rows = response.data.values;
            if (!rows || rows.length === 0) {
                throw new Error('No data found in the specified range');
            }
            // Convert rows to objects using first row as headers
            const headers = rows[0];
            const data = rows.slice(1).map((row) => {
                const obj = {};
                headers.forEach((header, index) => {
                    obj[header] = row[index] || '';
                });
                return obj;
            });
            LoggingService_1.logger.debug(`Parsed ${data.length} rows from Google Sheets`, {
                spreadsheetId,
                range,
            });
            return data;
        }
        catch (error) {
            LoggingService_1.logger.error('Google Sheets parsing error', error, {
                spreadsheetId,
                range,
            });
            throw error;
        }
    }
    /**
     * Validate and transform raw data to AdRecord format
     */
    validateAndTransformData(rawData) {
        const validRecords = [];
        const invalidRecords = [];
        const globalErrors = [];
        rawData.forEach((item, index) => {
            const rowErrors = [];
            const rowNumber = index + 2; // +2 because index is 0-based and we skip header
            // Validate required fields
            if (!item.WebsiteURL || typeof item.WebsiteURL !== 'string') {
                rowErrors.push('WebsiteURL is required and must be a string');
            }
            else if (!this.isValidUrl(item.WebsiteURL)) {
                rowErrors.push('WebsiteURL must be a valid URL');
            }
            if (!item.PID || typeof item.PID !== 'string') {
                rowErrors.push('PID is required and must be a string');
            }
            if (!item.UID || typeof item.UID !== 'string') {
                rowErrors.push('UID is required and must be a string');
            }
            if (!item.AdType || typeof item.AdType !== 'string') {
                rowErrors.push('AdType is required and must be a string');
            }
            if (!item.Selector || typeof item.Selector !== 'string') {
                rowErrors.push('Selector is required and must be a string');
            }
            if (!item.DeviceUI || typeof item.DeviceUI !== 'string') {
                rowErrors.push('DeviceUI is required and must be a string');
            }
            else if (!this.isValidDeviceType(item.DeviceUI)) {
                rowErrors.push('DeviceUI must be one of: Android, iOS, Desktop');
            }
            if (rowErrors.length > 0) {
                invalidRecords.push({
                    row: rowNumber,
                    data: item,
                    errors: rowErrors,
                });
            }
            else {
                // Transform to AdRecord
                const record = {
                    WebsiteURL: item.WebsiteURL.trim(),
                    PID: item.PID.trim(),
                    UID: item.UID.trim(),
                    AdType: item.AdType.trim(),
                    Selector: item.Selector.trim(),
                    DeviceUI: item.DeviceUI.trim(),
                };
                validRecords.push(record);
            }
        });
        // Log validation summary
        if (invalidRecords.length > 0) {
            LoggingService_1.logger.warn('Data validation found invalid records', {
                invalidCount: invalidRecords.length,
                validCount: validRecords.length,
                totalCount: rawData.length,
            });
            // Log details of invalid records (limit to first 10)
            invalidRecords.slice(0, 10).forEach((invalid) => {
                LoggingService_1.logger.debug('Invalid record details', {
                    row: invalid.row,
                    errors: invalid.errors,
                    data: invalid.data,
                });
            });
        }
        return {
            isValid: invalidRecords.length === 0,
            errors: globalErrors,
            validRecords,
            invalidRecords,
        };
    }
    /**
     * Validate URL format
     */
    isValidUrl(url) {
        try {
            new URL(url);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Validate device type
     */
    isValidDeviceType(deviceType) {
        return ['Android', 'iOS', 'Desktop'].includes(deviceType);
    }
    /**
     * Parse data from multiple sources and combine
     */
    async parseMultipleSources(sources) {
        LoggingService_1.logger.info('Parsing multiple data sources', { sourceCount: sources.length });
        const allRecords = [];
        const errors = [];
        for (const [index, source] of sources.entries()) {
            try {
                const records = await this.parseData(source);
                allRecords.push(...records);
                LoggingService_1.logger.debug(`Source ${index + 1} processed successfully`, {
                    recordCount: records.length,
                });
            }
            catch (error) {
                const errorMsg = `Failed to process source ${index + 1}: ${error}`;
                errors.push(errorMsg);
                LoggingService_1.logger.error(errorMsg, error, { source });
            }
        }
        if (errors.length > 0 && allRecords.length === 0) {
            throw new Error(`All data sources failed: ${errors.join(', ')}`);
        }
        // Remove duplicates based on PID + UID combination
        const uniqueRecords = this.removeDuplicates(allRecords);
        LoggingService_1.logger.info('Multiple sources parsing completed', {
            totalSources: sources.length,
            totalRecords: allRecords.length,
            uniqueRecords: uniqueRecords.length,
            duplicatesRemoved: allRecords.length - uniqueRecords.length,
            errors: errors.length,
        });
        return uniqueRecords;
    }
    /**
     * Remove duplicate records based on PID + UID combination
     */
    removeDuplicates(records) {
        const seen = new Set();
        const uniqueRecords = [];
        for (const record of records) {
            const key = `${record.PID}_${record.UID}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueRecords.push(record);
            }
        }
        return uniqueRecords;
    }
    /**
     * Export validation report
     */
    async exportValidationReport(validationResult, outputPath) {
        const report = {
            summary: {
                totalRecords: validationResult.validRecords.length + validationResult.invalidRecords.length,
                validRecords: validationResult.validRecords.length,
                invalidRecords: validationResult.invalidRecords.length,
                validationDate: new Date().toISOString(),
            },
            globalErrors: validationResult.errors,
            invalidRecords: validationResult.invalidRecords,
        };
        await fs.writeJson(outputPath, report, { spaces: 2 });
        LoggingService_1.logger.info('Validation report exported', { outputPath });
    }
    /**
     * Get sample data structure for reference
     */
    getSampleDataStructure() {
        return {
            WebsiteURL: 'https://example.com',
            PID: 'PROD123',
            UID: 'USER456',
            AdType: 'Banner',
            Selector: '.ad-container',
            DeviceUI: 'Android',
        };
    }
}
exports.DataIngestionService = DataIngestionService;
//# sourceMappingURL=DataIngestionService.js.map