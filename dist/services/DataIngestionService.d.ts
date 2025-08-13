/**
 * Data ingestion service for parsing Google Sheets and CSV files
 */
import { AdRecord } from '../types';
export interface DataSource {
    type: 'csv' | 'google_sheets';
    path?: string;
    spreadsheetId?: string;
    range?: string;
    sheetName?: string;
}
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    validRecords: AdRecord[];
    invalidRecords: Array<{
        row: number;
        data: any;
        errors: string[];
    }>;
}
export declare class DataIngestionService {
    private sheetsService;
    constructor();
    /**
     * Initialize Google Sheets API service
     */
    private initializeGoogleSheets;
    /**
     * Parse data from various sources
     */
    parseData(source: DataSource): Promise<AdRecord[]>;
    /**
     * Parse CSV file
     */
    private parseCsvFile;
    /**
     * Parse Google Sheets data
     */
    private parseGoogleSheet;
    /**
     * Validate and transform raw data to AdRecord format
     */
    private validateAndTransformData;
    /**
     * Validate URL format
     */
    private isValidUrl;
    /**
     * Validate device type
     */
    private isValidDeviceType;
    /**
     * Parse data from multiple sources and combine
     */
    parseMultipleSources(sources: DataSource[]): Promise<AdRecord[]>;
    /**
     * Remove duplicate records based on PID + UID combination
     */
    private removeDuplicates;
    /**
     * Export validation report
     */
    exportValidationReport(validationResult: ValidationResult, outputPath: string): Promise<void>;
    /**
     * Get sample data structure for reference
     */
    getSampleDataStructure(): any;
}
//# sourceMappingURL=DataIngestionService.d.ts.map