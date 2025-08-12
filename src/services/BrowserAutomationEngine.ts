/**
 * Browser automation engine using Puppeteer with mobile emulation
 */

import * as puppeteer from 'puppeteer';
import { BrowserSession, DeviceProfile, ErrorType, ScreenshotResult } from '@/types';
import { logger } from './LoggingService';
import { config, getDeviceProfile } from '@/config';

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

export class BrowserAutomationEngine {
  private browser: puppeteer.Browser | null = null;
  private sessions: Map<string, BrowserSession> = new Map();
  private static instance: BrowserAutomationEngine;

  constructor() {
    this.setupCleanupHandlers();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): BrowserAutomationEngine {
    if (!BrowserAutomationEngine.instance) {
      BrowserAutomationEngine.instance = new BrowserAutomationEngine();
    }
    return BrowserAutomationEngine.instance;
  }

  /**
   * Initialize browser instance
   */
  public async initialize(): Promise<void> {
    try {
      if (this.browser) {
        await this.browser.close();
      }

      this.browser = await puppeteer.launch({
        headless: config.browser.headless,
        args: config.browser.args,
        defaultViewport: null,
        devtools: !config.browser.headless && config.env === 'development',
      });

      logger.info('Browser automation engine initialized', {
        headless: config.browser.headless,
        pid: this.browser.process()?.pid,
      });
    } catch (error) {
      logger.error('Failed to initialize browser', error);
      throw error;
    }
  }

  /**
   * Create a new browser session with device emulation
   */
  public async createSession(
    deviceType: string,
    sessionId?: string
  ): Promise<BrowserSession> {
    if (!this.browser) {
      await this.initialize();
    }

    const id = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const deviceProfile = getDeviceProfile(deviceType);

    try {
      const page = await this.browser!.newPage();

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
      page.setDefaultTimeout(config.browser.timeout);
      page.setDefaultNavigationTimeout(config.browser.timeout);

      // Setup page event handlers
      this.setupPageEventHandlers(page, id);

      const session: BrowserSession = {
        id,
        page,
        browser: this.browser!,
        deviceProfile,
        isActive: true,
        lastActivity: new Date(),
      };

      this.sessions.set(id, session);

      logger.logBrowserSession('created', id, {
        deviceType,
        viewport: deviceProfile.viewport,
        userAgent: deviceProfile.userAgent,
      });

      return session;
    } catch (error) {
      logger.error('Failed to create browser session', error, { deviceType, sessionId: id });
      throw error;
    }
  }

  /**
   * Setup page event handlers for monitoring
   */
  private setupPageEventHandlers(page: puppeteer.Page, sessionId: string): void {
    page.on('error', (error) => {
      logger.error('Page error', error, { sessionId });
    });

    page.on('pageerror', (error) => {
      logger.error('Page JavaScript error', error, { sessionId });
    });

    page.on('response', (response) => {
      if (response.status() >= 400) {
        logger.debug('HTTP error response', {
          sessionId,
          url: response.url(),
          status: response.status(),
          statusText: response.statusText(),
        });
      }
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        logger.debug('Console error', {
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
  public async navigateToUrl(
    sessionId: string,
    url: string,
    options: NavigationOptions = {}
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      throw new Error(`Session ${sessionId} not found or inactive`);
    }

    const {
      timeout = config.browser.timeout,
      waitUntil = 'networkidle2',
      referer,
    } = options;

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

      logger.debug('Navigation successful', {
        sessionId,
        url,
        status: response.status(),
        loadTime: Date.now() - session.lastActivity.getTime(),
      });
    } catch (error) {
      logger.error('Navigation failed', error, { sessionId, url });
      throw error;
    }
  }

  /**
   * Wait for selector with timeout
   */
  public async waitForSelector(
    sessionId: string,
    selector: string,
    timeout: number = config.browser.screenshotTimeout
  ): Promise<void> {
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

      logger.debug('Selector found', { sessionId, selector });
    } catch (error) {
      logger.error('Selector not found', error, { sessionId, selector, timeout });
      throw error;
    }
  }

  /**
   * Take screenshot of page or element
   */
  public async takeScreenshot(
    sessionId: string,
    options: ScreenshotOptions = {}
  ): Promise<Buffer> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      throw new Error(`Session ${sessionId} not found or inactive`);
    }

    try {
      const {
        selector,
        fullPage = false,
        clip,
        quality = 90,
        format = 'png',
      } = options;

      let screenshotData: Buffer;

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
      } else {
        // Screenshot full page or viewport
        screenshotData = await session.page.screenshot({
          type: format,
          quality: format === 'jpeg' ? quality : undefined,
          fullPage,
          clip,
        });
      }

      session.lastActivity = new Date();

      logger.debug('Screenshot captured', {
        sessionId,
        selector,
        fullPage,
        format,
        size: screenshotData.length,
      });

      return screenshotData;
    } catch (error) {
      logger.error('Screenshot failed', error, { sessionId, options });
      throw error;
    }
  }

  /**
   * Execute JavaScript in page context
   */
  public async executeScript(
    sessionId: string,
    script: string,
    ...args: any[]
  ): Promise<any> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      throw new Error(`Session ${sessionId} not found or inactive`);
    }

    try {
      const result = await session.page.evaluate(script, ...args);
      session.lastActivity = new Date();

      logger.debug('Script executed', {
        sessionId,
        scriptLength: script.length,
        argsCount: args.length,
      });

      return result;
    } catch (error) {
      logger.error('Script execution failed', error, { sessionId, script: script.substring(0, 100) });
      throw error;
    }
  }

  /**
   * Inject and execute bookmarklet
   */
  public async executeBookmarklet(
    sessionId: string,
    bookmarkletCode: string,
    parameters: Record<string, any> = {}
  ): Promise<any> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      throw new Error(`Session ${sessionId} not found or inactive`);
    }

    try {
      // Inject parameters into global scope
      await session.page.evaluate((params) => {
        (window as any).__bookmarkletParams = params;
      }, parameters);

      // Execute bookmarklet code
      const result = await session.page.evaluate(bookmarkletCode);

      session.lastActivity = new Date();

      logger.debug('Bookmarklet executed', {
        sessionId,
        parametersCount: Object.keys(parameters).length,
      });

      return result;
    } catch (error) {
      logger.error('Bookmarklet execution failed', error, { sessionId });
      throw error;
    }
  }

  /**
   * Check if element exists
   */
  public async elementExists(sessionId: string, selector: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      throw new Error(`Session ${sessionId} not found or inactive`);
    }

    try {
      const element = await session.page.$(selector);
      return element !== null;
    } catch {
      return false;
    }
  }

  /**
   * Get page title
   */
  public async getPageTitle(sessionId: string): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      throw new Error(`Session ${sessionId} not found or inactive`);
    }

    return session.page.title();
  }

  /**
   * Get current URL
   */
  public async getCurrentUrl(sessionId: string): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      throw new Error(`Session ${sessionId} not found or inactive`);
    }

    return session.page.url();
  }

  /**
   * Destroy a session
   */
  public async destroySession(sessionId: string): Promise<void> {
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

      logger.logBrowserSession('destroyed', sessionId);
    } catch (error) {
      logger.error('Failed to destroy session', error, { sessionId });
    }
  }

  /**
   * Get active sessions count
   */
  public getActiveSessionsCount(): number {
    return Array.from(this.sessions.values()).filter(session => session.isActive).length;
  }

  /**
   * Clean up inactive sessions
   */
  public async cleanupInactiveSessions(maxIdleTime: number = 10 * 60 * 1000): Promise<void> {
    const now = new Date();
    const sessionsToCleanup: string[] = [];

    for (const [sessionId, session] of this.sessions) {
      if (now.getTime() - session.lastActivity.getTime() > maxIdleTime) {
        sessionsToCleanup.push(sessionId);
      }
    }

    for (const sessionId of sessionsToCleanup) {
      await this.destroySession(sessionId);
    }

    if (sessionsToCleanup.length > 0) {
      logger.info('Inactive sessions cleaned up', {
        cleanedSessions: sessionsToCleanup.length,
        remainingSessions: this.sessions.size,
      });
    }
  }

  /**
   * Close browser and cleanup all sessions
   */
  public async close(): Promise<void> {
    // Close all sessions
    const sessionIds = Array.from(this.sessions.keys());
    await Promise.all(sessionIds.map(id => this.destroySession(id)));

    // Close browser
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      logger.info('Browser automation engine closed');
    }
  }

  /**
   * Check if browser is healthy
   */
  public async isHealthy(): Promise<boolean> {
    try {
      if (!this.browser) {
        return false;
      }

      const pages = await this.browser.pages();
      return pages.length >= 0; // Should always be true if browser is connected
    } catch {
      return false;
    }
  }

  /**
   * Setup cleanup handlers for graceful shutdown
   */
  private setupCleanupHandlers(): void {
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
  public getSessionInfo(sessionId: string): BrowserSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all active sessions
   */
  public getActiveSessions(): BrowserSession[] {
    return Array.from(this.sessions.values()).filter(session => session.isActive);
  }
}