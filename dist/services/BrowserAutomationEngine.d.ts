/**
 * Browser automation engine using Puppeteer with mobile emulation
 */
import { BrowserSession } from '../types';
export interface NavigationOptions {
    timeout?: number;
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
    referer?: string;
}
export interface ScreenshotOptions {
    selector?: string;
    fullPage?: boolean;
    clip?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    quality?: number;
    format?: 'png' | 'jpeg' | 'webp';
}
export declare class BrowserAutomationEngine {
    private browser;
    private sessions;
    private static instance;
    constructor();
    /**
     * Get singleton instance
     */
    static getInstance(): BrowserAutomationEngine;
    /**
     * Initialize browser instance
     */
    initialize(): Promise<void>;
    /**
     * Create a new browser session with device emulation
     */
    createSession(deviceType: string, sessionId?: string): Promise<BrowserSession>;
    /**
     * Setup page event handlers for monitoring
     */
    private setupPageEventHandlers;
    /**
     * Navigate to URL with retry logic
     */
    navigateToUrl(sessionId: string, url: string, options?: NavigationOptions): Promise<void>;
    /**
     * Wait for selector with timeout
     */
    waitForSelector(sessionId: string, selector: string, timeout?: number): Promise<void>;
    /**
     * Take screenshot of page or element
     */
    takeScreenshot(sessionId: string, options?: ScreenshotOptions): Promise<Buffer>;
    /**
     * Execute JavaScript in page context
     */
    executeScript(sessionId: string, script: string, ...args: any[]): Promise<any>;
    /**
     * Inject and execute bookmarklet
     */
    executeBookmarklet(sessionId: string, bookmarkletCode: string, parameters?: Record<string, any>): Promise<any>;
    /**
     * Check if element exists
     */
    elementExists(sessionId: string, selector: string): Promise<boolean>;
    /**
     * Get page title
     */
    getPageTitle(sessionId: string): Promise<string>;
    /**
     * Get current URL
     */
    getCurrentUrl(sessionId: string): Promise<string>;
    /**
     * Destroy a session
     */
    destroySession(sessionId: string): Promise<void>;
    /**
     * Get active sessions count
     */
    getActiveSessionsCount(): number;
    /**
     * Clean up inactive sessions
     */
    cleanupInactiveSessions(maxIdleTime?: number): Promise<void>;
    /**
     * Close browser and cleanup all sessions
     */
    close(): Promise<void>;
    /**
     * Check if browser is healthy
     */
    isHealthy(): Promise<boolean>;
    /**
     * Setup cleanup handlers for graceful shutdown
     */
    private setupCleanupHandlers;
    /**
     * Get session information
     */
    getSessionInfo(sessionId: string): BrowserSession | undefined;
    /**
     * Get all active sessions
     */
    getActiveSessions(): BrowserSession[];
    /**
     * Execute browser script with parameters
     */
    executeBrowserScript(sessionId: string, script: string, parameters?: Record<string, any>): Promise<any>;
}
//# sourceMappingURL=BrowserAutomationEngine.d.ts.map