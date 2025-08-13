/**
 * Configuration management for the Ad Screenshot Automation System
 */
import { DeviceProfile, ProcessingConfig, GoogleDriveConfig, StorageOptions, RetryStrategy } from '../types';
/**
 * Device profiles for mobile emulation
 */
export declare const DEVICE_PROFILES: Record<string, DeviceProfile>;
/**
 * Application configuration
 */
export declare const config: {
    env: any;
    port: any;
    redis: {
        host: any;
        port: any;
        password: any;
        db: any;
    };
    browser: {
        headless: any;
        timeout: any;
        screenshotTimeout: any;
        executablePath: any;
        args: string[];
    };
    processing: ProcessingConfig;
    storage: StorageOptions;
    googleDrive: GoogleDriveConfig & {
        enabled: boolean;
    };
    logging: {
        level: any;
        filePath: any;
    };
    chromeExtension: {
        id: any;
        port: any;
    };
    retryStrategies: {
        network: RetryStrategy;
        selector: RetryStrategy;
        browser: RetryStrategy;
        upload: RetryStrategy;
    };
};
/**
 * Get device profile by name or device type
 */
export declare function getDeviceProfile(deviceType: string): DeviceProfile;
/**
 * Validate configuration on startup
 */
export declare function validateConfig(): void;
export default config;
//# sourceMappingURL=index.d.ts.map