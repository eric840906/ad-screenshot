"use strict";
/**
 * Configuration management for the Ad Screenshot Automation System
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = exports.DEVICE_PROFILES = void 0;
exports.getDeviceProfile = getDeviceProfile;
exports.validateConfig = validateConfig;
const Joi = __importStar(require("joi"));
const dotenv = __importStar(require("dotenv"));
// Load environment variables
dotenv.config();
const configSchema = Joi.object({
    NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
    PORT: Joi.number().default(3000),
    // Redis Configuration
    REDIS_HOST: Joi.string().default('localhost'),
    REDIS_PORT: Joi.number().default(6379),
    REDIS_PASSWORD: Joi.string().allow('').optional(),
    REDIS_DB: Joi.number().default(0),
    // Browser Configuration
    BROWSER_HEADLESS: Joi.boolean().default(true),
    BROWSER_TIMEOUT: Joi.number().default(30000),
    SCREENSHOT_TIMEOUT: Joi.number().default(10000),
    CHROME_EXECUTABLE_PATH: Joi.string().allow('').optional(),
    // Processing Configuration
    CONCURRENT_JOBS: Joi.number().default(3),
    BATCH_SIZE: Joi.number().default(50),
    MAX_RETRIES: Joi.number().default(3),
    // Storage Configuration
    STORAGE_BASE_DIR: Joi.string().default('./screenshots'),
    CREATE_DATE_FOLDERS: Joi.boolean().default(true),
    // Google Drive Configuration
    GOOGLE_DRIVE_KEY_FILE: Joi.string().allow('').optional(),
    GOOGLE_DRIVE_PARENT_FOLDER: Joi.string().allow('').optional(),
    ENABLE_DRIVE_UPLOAD: Joi.boolean().default(false),
    // Logging Configuration
    LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
    LOG_FILE_PATH: Joi.string().default('./logs'),
    // Chrome Extension Configuration
    EXTENSION_ID: Joi.string().allow('').optional(),
    EXTENSION_PORT: Joi.number().default(9222),
});
const { error, value: envVars } = configSchema.validate(process.env, {
    allowUnknown: true,
    stripUnknown: true,
});
if (error) {
    throw new Error(`Config validation error: ${error.message}`);
}
/**
 * Device profiles for mobile emulation
 */
exports.DEVICE_PROFILES = {
    'iPhone 14 Pro': {
        name: 'iPhone 14 Pro',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        viewport: {
            width: 393,
            height: 852,
            deviceScaleFactor: 3,
            isMobile: true,
            hasTouch: true,
            isLandscape: false,
        },
    },
    'iPhone 14 Pro Landscape': {
        name: 'iPhone 14 Pro Landscape',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        viewport: {
            width: 852,
            height: 393,
            deviceScaleFactor: 3,
            isMobile: true,
            hasTouch: true,
            isLandscape: true,
        },
    },
    'Samsung Galaxy S23': {
        name: 'Samsung Galaxy S23',
        userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
        viewport: {
            width: 360,
            height: 780,
            deviceScaleFactor: 3,
            isMobile: true,
            hasTouch: true,
            isLandscape: false,
        },
    },
    'Samsung Galaxy S23 Landscape': {
        name: 'Samsung Galaxy S23 Landscape',
        userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
        viewport: {
            width: 780,
            height: 360,
            deviceScaleFactor: 3,
            isMobile: true,
            hasTouch: true,
            isLandscape: true,
        },
    },
    'iPad Pro': {
        name: 'iPad Pro',
        userAgent: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        viewport: {
            width: 1024,
            height: 1366,
            deviceScaleFactor: 2,
            isMobile: true,
            hasTouch: true,
            isLandscape: false,
        },
    },
    'Desktop': {
        name: 'Desktop',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: {
            width: 1920,
            height: 1080,
            deviceScaleFactor: 1,
            isMobile: false,
            hasTouch: false,
            isLandscape: true,
        },
    },
};
/**
 * Application configuration
 */
exports.config = {
    env: envVars.NODE_ENV,
    port: envVars.PORT,
    redis: {
        host: envVars.REDIS_HOST,
        port: envVars.REDIS_PORT,
        password: envVars.REDIS_PASSWORD || undefined,
        db: envVars.REDIS_DB,
    },
    browser: {
        headless: envVars.BROWSER_HEADLESS,
        timeout: envVars.BROWSER_TIMEOUT,
        screenshotTimeout: envVars.SCREENSHOT_TIMEOUT,
        executablePath: envVars.CHROME_EXECUTABLE_PATH || undefined,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-cloud-management-enrollment',
            '--disable-component-cloud-policy',
            '--disable-default-apps',
            '--disable-extensions',
            '--disable-sync',
            '--disable-web-security',
            '--allow-running-insecure-content',
        ],
    },
    processing: {
        concurrency: envVars.CONCURRENT_JOBS,
        retryAttempts: envVars.MAX_RETRIES,
        timeoutMs: envVars.BROWSER_TIMEOUT,
        screenshotDelay: 2000,
        batchSize: envVars.BATCH_SIZE,
    },
    storage: {
        baseDirectory: envVars.STORAGE_BASE_DIR,
        createDateFolders: envVars.CREATE_DATE_FOLDERS,
        organizationPattern: 'date',
    },
    googleDrive: {
        keyFilePath: envVars.GOOGLE_DRIVE_KEY_FILE || '',
        parentFolderId: envVars.GOOGLE_DRIVE_PARENT_FOLDER,
        createFolders: true,
        folderStructure: 'date',
        enabled: envVars.ENABLE_DRIVE_UPLOAD,
    },
    logging: {
        level: envVars.LOG_LEVEL,
        filePath: envVars.LOG_FILE_PATH,
    },
    chromeExtension: {
        id: envVars.EXTENSION_ID,
        port: envVars.EXTENSION_PORT,
    },
    retryStrategies: {
        network: {
            maxAttempts: 5,
            delayMs: 1000,
            backoffMultiplier: 2,
            maxDelayMs: 10000,
        },
        selector: {
            maxAttempts: 3,
            delayMs: 2000,
            backoffMultiplier: 1.5,
            maxDelayMs: 8000,
        },
        browser: {
            maxAttempts: 2,
            delayMs: 5000,
            backoffMultiplier: 1,
            maxDelayMs: 5000,
        },
        upload: {
            maxAttempts: 4,
            delayMs: 1500,
            backoffMultiplier: 2,
            maxDelayMs: 12000,
        },
    },
};
/**
 * Get device profile by name or device type
 */
function getDeviceProfile(deviceType) {
    const profile = exports.DEVICE_PROFILES[deviceType];
    if (!profile) {
        // Fallback mapping for common device types
        switch (deviceType.toLowerCase()) {
            case 'android':
                return exports.DEVICE_PROFILES['Samsung Galaxy S23'];
            case 'ios':
                return exports.DEVICE_PROFILES['iPhone 14 Pro'];
            case 'desktop':
                return exports.DEVICE_PROFILES['Desktop'];
            default:
                throw new Error(`Unknown device type: ${deviceType}`);
        }
    }
    return profile;
}
/**
 * Validate configuration on startup
 */
function validateConfig() {
    if (exports.config.googleDrive.enabled && !exports.config.googleDrive.keyFilePath) {
        throw new Error('Google Drive upload is enabled but no key file path provided');
    }
    if (exports.config.processing.concurrency > 10) {
        console.warn('High concurrency detected. This may cause resource issues.');
    }
    if (exports.config.processing.batchSize > 100) {
        console.warn('Large batch size detected. Consider reducing for better memory usage.');
    }
}
exports.default = exports.config;
//# sourceMappingURL=index.js.map