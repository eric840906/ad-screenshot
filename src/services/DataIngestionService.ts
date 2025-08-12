/**
 * Data ingestion service for parsing Google Sheets and CSV files
 */

import * as fs from 'fs-extra';
import * as csvParser from 'csv-parser';
import { google } from 'googleapis';
import { AdRecord, DeviceType } from '@/types';
import { logger } from './LoggingService';
import { config } from '@/config';

export interface DataSource {
  type: 'csv' | 'google_sheets';
  path?: string; // For CSV files
  spreadsheetId?: string; // For Google Sheets
  range?: string; // For Google Sheets
  sheetName?: string; // For Google Sheets
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  validRecords: AdRecord[];
  invalidRecords: Array<{ row: number; data: any; errors: string[] }>;
}

export class DataIngestionService {
  private sheetsService: any;

  constructor() {
    this.initializeGoogleSheets();
  }

  /**
   * Initialize Google Sheets API service
   */
  private async initializeGoogleSheets(): Promise<void> {
    try {
      if (config.googleDrive.keyFilePath && fs.existsSync(config.googleDrive.keyFilePath)) {
        const auth = new google.auth.GoogleAuth({
          keyFile: config.googleDrive.keyFilePath,
          scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });

        this.sheetsService = google.sheets({ version: 'v4', auth });
        logger.info('Google Sheets API initialized successfully');
      }
    } catch (error) {
      logger.warn('Failed to initialize Google Sheets API', error);
    }
  }

  /**
   * Parse data from various sources
   */
  public async parseData(source: DataSource): Promise<AdRecord[]> {
    logger.info('Starting data ingestion', { source });

    try {
      let rawData: any[];

      switch (source.type) {
        case 'csv':
          rawData = await this.parseCsvFile(source.path!);
          break;
        case 'google_sheets':
          rawData = await this.parseGoogleSheet(
            source.spreadsheetId!,
            source.range || source.sheetName || 'Sheet1'
          );
          break;
        default:
          throw new Error(`Unsupported data source type: ${source.type}`);
      }

      const validationResult = this.validateAndTransformData(rawData);
      
      if (validationResult.errors.length > 0) {
        logger.warn('Data validation warnings', {
          totalErrors: validationResult.errors.length,
          validRecords: validationResult.validRecords.length,
          invalidRecords: validationResult.invalidRecords.length,
        });
      }

      logger.info('Data ingestion completed', {
        totalRecords: rawData.length,
        validRecords: validationResult.validRecords.length,
        invalidRecords: validationResult.invalidRecords.length,
      });

      return validationResult.validRecords;
    } catch (error) {
      logger.error('Data ingestion failed', error, { source });
      throw error;
    }
  }

  /**
   * Parse CSV file
   */
  private async parseCsvFile(filePath: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const results: any[] = [];

      if (!fs.existsSync(filePath)) {
        reject(new Error(`CSV file not found: ${filePath}`));
        return;
      }

      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (data) => results.push(data))
        .on('end', () => {
          logger.debug(`Parsed ${results.length} rows from CSV file: ${filePath}`);
          resolve(results);
        })
        .on('error', (error) => {
          logger.error('CSV parsing error', error, { filePath });
          reject(error);
        });
    });
  }

  /**
   * Parse Google Sheets data
   */
  private async parseGoogleSheet(
    spreadsheetId: string,
    range: string
  ): Promise<any[]> {
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
      const data = rows.slice(1).map((row: any[]) => {
        const obj: any = {};
        headers.forEach((header: string, index: number) => {
          obj[header] = row[index] || '';
        });
        return obj;
      });

      logger.debug(`Parsed ${data.length} rows from Google Sheets`, {
        spreadsheetId,
        range,
      });

      return data;
    } catch (error) {
      logger.error('Google Sheets parsing error', error, {
        spreadsheetId,
        range,
      });
      throw error;
    }
  }

  /**
   * Validate and transform raw data to AdRecord format
   */
  private validateAndTransformData(rawData: any[]): ValidationResult {
    const validRecords: AdRecord[] = [];
    const invalidRecords: Array<{ row: number; data: any; errors: string[] }> = [];
    const globalErrors: string[] = [];

    rawData.forEach((item, index) => {
      const rowErrors: string[] = [];
      const rowNumber = index + 2; // +2 because index is 0-based and we skip header

      // Validate required fields
      if (!item.WebsiteURL || typeof item.WebsiteURL !== 'string') {
        rowErrors.push('WebsiteURL is required and must be a string');
      } else if (!this.isValidUrl(item.WebsiteURL)) {
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
      } else if (!this.isValidDeviceType(item.DeviceUI)) {
        rowErrors.push('DeviceUI must be one of: Android, iOS, Desktop');
      }

      if (rowErrors.length > 0) {
        invalidRecords.push({
          row: rowNumber,
          data: item,
          errors: rowErrors,
        });
      } else {
        // Transform to AdRecord
        const record: AdRecord = {
          WebsiteURL: item.WebsiteURL.trim(),
          PID: item.PID.trim(),
          UID: item.UID.trim(),
          AdType: item.AdType.trim(),
          Selector: item.Selector.trim(),
          DeviceUI: item.DeviceUI.trim() as DeviceType,
        };

        validRecords.push(record);
      }
    });

    // Log validation summary
    if (invalidRecords.length > 0) {
      logger.warn('Data validation found invalid records', {
        invalidCount: invalidRecords.length,
        validCount: validRecords.length,
        totalCount: rawData.length,
      });

      // Log details of invalid records (limit to first 10)
      invalidRecords.slice(0, 10).forEach((invalid) => {
        logger.debug('Invalid record details', {
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
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate device type
   */
  private isValidDeviceType(deviceType: string): boolean {
    return ['Android', 'iOS', 'Desktop'].includes(deviceType);
  }

  /**
   * Parse data from multiple sources and combine
   */
  public async parseMultipleSources(sources: DataSource[]): Promise<AdRecord[]> {
    logger.info('Parsing multiple data sources', { sourceCount: sources.length });

    const allRecords: AdRecord[] = [];
    const errors: string[] = [];

    for (const [index, source] of sources.entries()) {
      try {
        const records = await this.parseData(source);
        allRecords.push(...records);
        logger.debug(`Source ${index + 1} processed successfully`, {
          recordCount: records.length,
        });
      } catch (error) {
        const errorMsg = `Failed to process source ${index + 1}: ${error}`;
        errors.push(errorMsg);
        logger.error(errorMsg, error, { source });
      }
    }

    if (errors.length > 0 && allRecords.length === 0) {
      throw new Error(`All data sources failed: ${errors.join(', ')}`);
    }

    // Remove duplicates based on PID + UID combination
    const uniqueRecords = this.removeDuplicates(allRecords);

    logger.info('Multiple sources parsing completed', {
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
  private removeDuplicates(records: AdRecord[]): AdRecord[] {
    const seen = new Set<string>();
    const uniqueRecords: AdRecord[] = [];

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
  public async exportValidationReport(
    validationResult: ValidationResult,
    outputPath: string
  ): Promise<void> {
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
    logger.info('Validation report exported', { outputPath });
  }

  /**
   * Get sample data structure for reference
   */
  public getSampleDataStructure(): any {
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