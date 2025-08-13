"use strict";
/**
 * Browser automation engine using Puppeteer with mobile emulation
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
exports.BrowserAutomationEngine = void 0;
const puppeteer = __importStar(require("puppeteer"));
const LoggingService_1 = require("./LoggingService");
const config_1 = require("../config");
class BrowserAutomationEngine {
    browser = null;
    sessions = new Map();
    static instance;
    constructor() {
        this.setupCleanupHandlers();
    }
    /**
     * Get singleton instance
     */
    static getInstance() {
        if (!BrowserAutomationEngine.instance) {
            BrowserAutomationEngine.instance = new BrowserAutomationEngine();
        }
        return BrowserAutomationEngine.instance;
    }
    /**
     * Initialize browser instance
     */
    async initialize() {
        try {
            if (this.browser) {
                await this.browser.close();
            }
            this.browser = await puppeteer.launch({
                headless: config_1.config.browser.headless,
                args: config_1.config.browser.args,
                defaultViewport: null,
                devtools: !config_1.config.browser.headless && config_1.config.env === 'development',
                executablePath: config_1.config.browser.executablePath,
            });
            LoggingService_1.logger.info('Browser automation engine initialized', {
                headless: config_1.config.browser.headless,
                pid: this.browser.process()?.pid,
            });
        }
        catch (error) {
            LoggingService_1.logger.error('Failed to initialize browser', error);
            throw error;
        }
    }
    /**
     * Create a new browser session with device emulation
     */
    async createSession(deviceType, sessionId) {
        if (!this.browser) {
            await this.initialize();
        }
        const id = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const deviceProfile = (0, config_1.getDeviceProfile)(deviceType);
        try {
            const page = await this.browser.newPage();
            // Set device emulation
            await page.emulate({
                viewport: deviceProfile.viewport,
                userAgent: deviceProfile.userAgent,
            });
            // Set additional mobile-specific settings
            if (deviceProfile.viewport.isMobile) {
                await page.setExtraHTTPHeaders({
                    'Accept-Language': 'en-US,en;q=0.9',
                });
            }
            // Set reasonable timeouts
            page.setDefaultTimeout(config_1.config.browser.timeout);
            page.setDefaultNavigationTimeout(config_1.config.browser.timeout);
            // Setup page event handlers
            this.setupPageEventHandlers(page, id);
            const session = {
                id,
                page,
                browser: this.browser,
                deviceProfile,
                isActive: true,
                lastActivity: new Date(),
            };
            this.sessions.set(id, session);
            LoggingService_1.logger.logBrowserSession('created', id, {
                deviceType,
                viewport: deviceProfile.viewport,
                userAgent: deviceProfile.userAgent,
            });
            return session;
        }
        catch (error) {
            LoggingService_1.logger.error('Failed to create browser session', error, { deviceType, sessionId: id });
            throw error;
        }
    }
    /**
     * Setup page event handlers for monitoring
     */
    setupPageEventHandlers(page, sessionId) {
        page.on('error', (error) => {
            LoggingService_1.logger.error('Page error', error, { sessionId });
        });
        page.on('pageerror', (error) => {
            LoggingService_1.logger.error('Page JavaScript error', error, { sessionId });
        });
        page.on('response', (response) => {
            if (response.status() >= 400) {
                LoggingService_1.logger.debug('HTTP error response', {
                    sessionId,
                    url: response.url(),
                    status: response.status(),
                    statusText: response.statusText(),
                });
            }
        });
        page.on('console', (msg) => {
            if (msg.type() === 'error') {
                LoggingService_1.logger.debug('Console error', {
                    sessionId,
                    message: msg.text(),
                    location: msg.location(),
                });
            }
        });
    }
    /**
     * Navigate to URL with retry logic
     */
    async navigateToUrl(sessionId, url, options = {}) {
        const session = this.sessions.get(sessionId);
        if (!session || !session.isActive) {
            throw new Error(`Session ${sessionId} not found or inactive`);
        }
        const { timeout = config_1.config.browser.timeout, waitUntil = 'networkidle2', referer, } = options;
        try {
            // Set referer if provided
            if (referer) {
                await session.page.setExtraHTTPHeaders({ referer });
            }
            const response = await session.page.goto(url, {
                timeout,
                waitUntil,
            });
            if (!response) {
                throw new Error('Navigation failed - no response received');
            }
            if (!response.ok()) {
                throw new Error(`Navigation failed with status: ${response.status()}`);
            }
            // Update session activity
            session.lastActivity = new Date();
            LoggingService_1.logger.debug('Navigation successful', {
                sessionId,
                url,
                status: response.status(),
                loadTime: Date.now() - session.lastActivity.getTime(),
            });
        }
        catch (error) {
            LoggingService_1.logger.error('Navigation failed', error, { sessionId, url });
            throw error;
        }
    }
    /**
     * Wait for selector with timeout
     */
    async waitForSelector(sessionId, selector, timeout = config_1.config.browser.screenshotTimeout) {
        const session = this.sessions.get(sessionId);
        if (!session || !session.isActive) {
            throw new Error(`Session ${sessionId} not found or inactive`);
        }
        try {
            await session.page.waitForSelector(selector, {
                timeout,
                visible: true,
            });
            session.lastActivity = new Date();
            LoggingService_1.logger.debug('Selector found', { sessionId, selector });
        }
        catch (error) {
            LoggingService_1.logger.error('Selector not found', error, { sessionId, selector, timeout });
            throw error;
        }
    }
    /**
     * Take screenshot of page or element
     */
    async takeScreenshot(sessionId, options = {}) {
        const session = this.sessions.get(sessionId);
        if (!session || !session.isActive) {
            throw new Error(`Session ${sessionId} not found or inactive`);
        }
        try {
            const { selector, fullPage = false, clip, quality = 90, format = 'png', } = options;
            let screenshotData;
            if (selector) {
                // Screenshot specific element
                const element = await session.page.$(selector);
                if (!element) {
                    throw new Error(`Element not found: ${selector}`);
                }
                screenshotData = await element.screenshot({
                    type: format,
                    quality: format === 'jpeg' ? quality : undefined,
                });
            }
            else {
                // Screenshot full page or viewport
                screenshotData = await session.page.screenshot({
                    type: format,
                    quality: format === 'jpeg' ? quality : undefined,
                    fullPage,
                    clip,
                });
            }
            session.lastActivity = new Date();
            LoggingService_1.logger.debug('Screenshot captured', {
                sessionId,
                selector,
                fullPage,
                format,
                size: screenshotData.length,
            });
            return screenshotData;
        }
        catch (error) {
            LoggingService_1.logger.error('Screenshot failed', error, { sessionId, options });
            throw error;
        }
    }
    /**
     * Execute JavaScript in page context
     */
    async executeScript(sessionId, script, ...args) {
        const session = this.sessions.get(sessionId);
        if (!session || !session.isActive) {
            throw new Error(`Session ${sessionId} not found or inactive`);
        }
        try {
            const result = await session.page.evaluate(script, ...args);
            session.lastActivity = new Date();
            LoggingService_1.logger.debug('Script executed', {
                sessionId,
                scriptLength: script.length,
                argsCount: args.length,
            });
            return result;
        }
        catch (error) {
            LoggingService_1.logger.error('Script execution failed', error, { sessionId, script: script.substring(0, 100) });
            throw error;
        }
    }
    /**
     * Inject and execute bookmarklet
     */
    async executeBookmarklet(sessionId, bookmarkletCode, parameters = {}) {
        const session = this.sessions.get(sessionId);
        if (!session || !session.isActive) {
            throw new Error(`Session ${sessionId} not found or inactive`);
        }
        try {
            // Inject parameters into global scope
            await session.page.evaluate((params) => {
                globalThis.__bookmarkletParams = params;
            }, parameters);
            // Execute bookmarklet code
            const result = await session.page.evaluate(bookmarkletCode);
            session.lastActivity = new Date();
            LoggingService_1.logger.debug('Bookmarklet executed', {
                sessionId,
                parametersCount: Object.keys(parameters).length,
            });
            return result;
        }
        catch (error) {
            LoggingService_1.logger.error('Bookmarklet execution failed', error, { sessionId });
            throw error;
        }
    }
    /**
     * Check if element exists
     */
    async elementExists(sessionId, selector) {
        const session = this.sessions.get(sessionId);
        if (!session || !session.isActive) {
            throw new Error(`Session ${sessionId} not found or inactive`);
        }
        try {
            const element = await session.page.$(selector);
            return element !== null;
        }
        catch {
            return false;
        }
    }
    /**
     * Get page title
     */
    async getPageTitle(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session || !session.isActive) {
            throw new Error(`Session ${sessionId} not found or inactive`);
        }
        return session.page.title();
    }
    /**
     * Get current URL
     */
    async getCurrentUrl(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session || !session.isActive) {
            throw new Error(`Session ${sessionId} not found or inactive`);
        }
        return session.page.url();
    }
    /**
     * Destroy a session
     */
    async destroySession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return;
        }
        try {
            if (!session.page.isClosed()) {
                await session.page.close();
            }
            session.isActive = false;
            this.sessions.delete(sessionId);
            LoggingService_1.logger.logBrowserSession('destroyed', sessionId);
        }
        catch (error) {
            LoggingService_1.logger.error('Failed to destroy session', error, { sessionId });
        }
    }
    /**
     * Get active sessions count
     */
    getActiveSessionsCount() {
        return Array.from(this.sessions.values()).filter(session => session.isActive).length;
    }
    /**
     * Clean up inactive sessions
     */
    async cleanupInactiveSessions(maxIdleTime = 10 * 60 * 1000) {
        const now = new Date();
        const sessionsToCleanup = [];
        for (const [sessionId, session] of this.sessions) {
            if (now.getTime() - session.lastActivity.getTime() > maxIdleTime) {
                sessionsToCleanup.push(sessionId);
            }
        }
        for (const sessionId of sessionsToCleanup) {
            await this.destroySession(sessionId);
        }
        if (sessionsToCleanup.length > 0) {
            LoggingService_1.logger.info('Inactive sessions cleaned up', {
                cleanedSessions: sessionsToCleanup.length,
                remainingSessions: this.sessions.size,
            });
        }
    }
    /**
     * Close browser and cleanup all sessions
     */
    async close() {
        // Close all sessions
        const sessionIds = Array.from(this.sessions.keys());
        await Promise.all(sessionIds.map(id => this.destroySession(id)));
        // Close browser
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            LoggingService_1.logger.info('Browser automation engine closed');
        }
    }
    /**
     * Check if browser is healthy
     */
    async isHealthy() {
        try {
            if (!this.browser) {
                return false;
            }
            const pages = await this.browser.pages();
            return pages.length >= 0; // Should always be true if browser is connected
        }
        catch {
            return false;
        }
    }
    /**
     * Setup cleanup handlers for graceful shutdown
     */
    setupCleanupHandlers() {
        const cleanup = async () => {
            await this.close();
        };
        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);
        process.on('beforeExit', cleanup);
    }
    /**
     * Get session information
     */
    getSessionInfo(sessionId) {
        return this.sessions.get(sessionId);
    }
    /**
     * Get all active sessions
     */
    getActiveSessions() {
        return Array.from(this.sessions.values()).filter(session => session.isActive);
    }
    /**
     * Execute browser script with parameters
     */
    async executeBrowserScript(sessionId, script, parameters = {}) {
        const session = this.sessions.get(sessionId);
        if (!session || !session.isActive) {
            throw new Error(`Session ${sessionId} not found or inactive`);
        }
        try {
            // Inject parameters into page context
            await session.page.evaluate((params) => {
                globalThis.__scriptParams = params;
            }, parameters);
            // Execute the script
            const result = await session.page.evaluate(script);
            session.lastActivity = new Date();
            LoggingService_1.logger.debug('Browser script executed', {
                sessionId,
                scriptLength: script.length,
                parametersCount: Object.keys(parameters).length,
            });
            return result;
        }
        catch (error) {
            LoggingService_1.logger.error('Browser script execution failed', error, {
                sessionId,
                script: script.substring(0, 100)
            });
            throw error;
        }
    }
}
exports.BrowserAutomationEngine = BrowserAutomationEngine;
//# sourceMappingURL=BrowserAutomationEngine.js.map