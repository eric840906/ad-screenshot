/**
 * Core type definitions for the Ad Screenshot Automation System
 */

export interface AdRecord {
  WebsiteURL: string;
  PID: string;
  UID: string;
  AdType: string;
  Selector: string;
  DeviceUI: DeviceType;
}

export type DeviceType = 'Android' | 'iOS' | 'Desktop';

export interface ProcessingJob {
  id: string;
  record: AdRecord;
  batchId: string;
  retryCount: number;
  priority: JobPriority;
  createdAt: Date;
  updatedAt: Date;
}

export enum JobPriority {
  LOW = 1,
  NORMAL = 5,
  HIGH = 10,
  CRITICAL = 20
}

export interface DeviceProfile {
  name: string;
  userAgent: string;
  viewport: {
    width: number;
    height: number;
    deviceScaleFactor: number;
    isMobile: boolean;
    hasTouch: boolean;
    isLandscape: boolean;
  };
}

export interface ScreenshotResult {
  success: boolean;
  filePath?: string;
  fileName?: string;
  error?: string;
  metadata: {
    timestamp: Date;
    deviceType: DeviceType;
    pid: string;
    uid: string;
    adType: string;
    url: string;
  };
}

export interface BrowserSession {
  id: string;
  page: any; // Puppeteer Page type
  browser: any; // Puppeteer Browser type
  deviceProfile: DeviceProfile;
  isActive: boolean;
  lastActivity: Date;
}

export interface BookmarkletConfig {
  script: string;
  parameters: Record<string, any>;
  timeout: number;
  waitForSelector?: string;
}

export interface ChromeExtensionMessage {
  type: 'screenshot' | 'overlay' | 'element_highlight';
  payload: any;
  timestamp: Date;
}

export interface UploadResult {
  success: boolean;
  fileId?: string;
  webViewLink?: string;
  error?: string;
}

export interface ProcessingConfig {
  concurrency: number;
  retryAttempts: number;
  timeoutMs: number;
  screenshotDelay: number;
  batchSize: number;
}

export interface ErrorContext {
  jobId: string;
  url: string;
  selector: string;
  deviceType: DeviceType;
  retryCount: number;
  timestamp: Date;
}

export enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  SELECTOR_NOT_FOUND = 'SELECTOR_NOT_FOUND',
  BROWSER_CRASH = 'BROWSER_CRASH',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  UPLOAD_ERROR = 'UPLOAD_ERROR',
  PARSING_ERROR = 'PARSING_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR'
}

export interface RetryStrategy {
  maxAttempts: number;
  delayMs: number;
  backoffMultiplier: number;
  maxDelayMs: number;
}

export interface LogEntry {
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  context?: any;
  timestamp: Date;
}

export interface BatchProcessingResult {
  totalRecords: number;
  successCount: number;
  errorCount: number;
  skippedCount: number;
  errors: Array<{
    record: AdRecord;
    error: string;
  }>;
  duration: number;
}

export interface StorageOptions {
  baseDirectory: string;
  createDateFolders: boolean;
  organizationPattern: 'date' | 'platform' | 'flat';
}

export interface GoogleDriveConfig {
  keyFilePath: string;
  parentFolderId?: string;
  createFolders: boolean;
  folderStructure: 'date' | 'platform' | 'flat';
}

export interface QueueJobData extends ProcessingJob {
  attempt: number;
  delay?: number;
}

export interface ServiceHealth {
  serviceName: string;
  isHealthy: boolean;
  lastCheck: Date;
  errorMessage?: string;
}

export interface SystemStatus {
  services: ServiceHealth[];
  queueStats: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  };
  browserSessions: number;
  uptime: number;
}