/**
 * Chrome Extension Bridge for UI overlay communication
 */

import * as http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { ChromeExtensionMessage } from '@/types';
import { logger } from './LoggingService';
import { config } from '@/config';

export interface ExtensionCommand {
  type: 'screenshot' | 'highlight' | 'overlay' | 'extract_data' | 'mobile_screenshot' | 'configure_mobile_ui';
  target?: string; // CSS selector
  data?: any;
  options?: {
    duration?: number;
    color?: string;
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
    deviceType?: 'ios' | 'android';
    time?: string;
    url?: string;
    saveToFile?: boolean;
    returnAsBuffer?: boolean;
    quality?: number;
    format?: string;
    includeMetadata?: boolean;
  };
}

export interface ExtensionResponse {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: Date;
}

export class ChromeExtensionBridge {
  private server: http.Server | null = null;
  private wsServer: WebSocketServer | null = null;
  private activeConnections: Map<string, WebSocket> = new Map();
  private messageHandlers: Map<string, (data: any) => Promise<any>> = new Map();
  private static instance: ChromeExtensionBridge;

  constructor() {
    this.setupMessageHandlers();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ChromeExtensionBridge {
    if (!ChromeExtensionBridge.instance) {
      ChromeExtensionBridge.instance = new ChromeExtensionBridge();
    }
    return ChromeExtensionBridge.instance;
  }

  /**
   * Initialize the bridge server
   */
  public async initialize(): Promise<void> {
    try {
      // Create HTTP server for health check and REST endpoints
      this.server = http.createServer((req, res) => {
        this.handleHttpRequest(req, res);
      });

      // Create WebSocket server for real-time communication
      this.wsServer = new WebSocketServer({ 
        server: this.server,
        path: '/extension-bridge'
      });

      this.setupWebSocketHandlers();

      // Start listening
      this.server.listen(config.chromeExtension.port, () => {
        logger.info('Chrome Extension Bridge initialized', {
          port: config.chromeExtension.port,
          endpoints: ['/health', '/extension-bridge'],
        });
      });

    } catch (error) {
      logger.error('Failed to initialize Chrome Extension Bridge', error);
      throw error;
    }
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupWebSocketHandlers(): void {
    if (!this.wsServer) return;

    this.wsServer.on('connection', (ws, req) => {
      const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const clientIP = req.socket.remoteAddress;

      this.activeConnections.set(connectionId, ws);

      logger.debug('Extension connection established', {
        connectionId,
        clientIP,
        totalConnections: this.activeConnections.size,
      });

      // Setup message handling
      ws.on('message', async (message) => {
        try {
          await this.handleWebSocketMessage(connectionId, message.toString());
        } catch (error) {
          logger.error('WebSocket message handling error', error, { connectionId });
        }
      });

      // Handle connection close
      ws.on('close', (code, reason) => {
        this.activeConnections.delete(connectionId);
        logger.debug('Extension connection closed', {
          connectionId,
          code,
          reason: reason.toString(),
          totalConnections: this.activeConnections.size,
        });
      });

      // Handle errors
      ws.on('error', (error) => {
        logger.error('WebSocket connection error', error, { connectionId });
        this.activeConnections.delete(connectionId);
      });

      // Send welcome message
      this.sendMessage(connectionId, {
        type: 'connection_established',
        data: { connectionId, timestamp: new Date() },
      });
    });
  }

  /**
   * Handle HTTP requests
   */
  private handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://localhost:${config.chromeExtension.port}`);

    switch (url.pathname) {
      case '/health':
        this.handleHealthCheck(res);
        break;
      case '/connections':
        this.handleConnectionsStatus(res);
        break;
      case '/send-command':
        this.handleSendCommand(req, res);
        break;
      default:
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Endpoint not found' }));
    }
  }

  /**
   * Handle health check endpoint
   */
  private handleHealthCheck(res: http.ServerResponse): void {
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      connections: this.activeConnections.size,
      uptime: process.uptime(),
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(healthStatus));
  }

  /**
   * Handle connections status endpoint
   */
  private handleConnectionsStatus(res: http.ServerResponse): void {
    const connections = Array.from(this.activeConnections.keys()).map(id => ({
      id,
      status: 'active',
    }));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ connections, total: connections.length }));
  }

  /**
   * Handle send command endpoint
   */
  private async handleSendCommand(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    try {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const command = JSON.parse(body) as ExtensionCommand;
          const result = await this.sendCommandToAllConnections(command);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }

  /**
   * Handle WebSocket messages
   */
  private async handleWebSocketMessage(connectionId: string, message: string): Promise<void> {
    try {
      const parsedMessage: ChromeExtensionMessage = JSON.parse(message);

      logger.debug('Received extension message', {
        connectionId,
        type: parsedMessage.type,
        timestamp: parsedMessage.timestamp,
      });

      // Handle different message types
      const handler = this.messageHandlers.get(parsedMessage.type);
      if (handler) {
        const response = await handler(parsedMessage.payload);
        await this.sendMessage(connectionId, {
          type: `${parsedMessage.type}_response`,
          data: response,
        });
      } else {
        logger.warn('Unhandled message type', { type: parsedMessage.type, connectionId });
      }

    } catch (error) {
      logger.error('Failed to handle WebSocket message', error, { connectionId, message });
    }
  }

  /**
   * Setup default message handlers
   */
  private setupMessageHandlers(): void {
    // Screenshot completion handler
    this.messageHandlers.set('screenshot_complete', async (data) => {
      logger.info('Screenshot completed by extension', { data });
      return { acknowledged: true };
    });

    // Mobile screenshot completion handler
    this.messageHandlers.set('mobile_screenshot_complete', async (data) => {
      logger.info('Mobile screenshot completed by extension', {
        deviceType: data?.deviceType,
        dataSize: data?.imageData?.length || 0
      });
      return { acknowledged: true, data: data?.imageData };
    });

    // Mobile UI configuration confirmation
    this.messageHandlers.set('mobile_ui_configured', async (data) => {
      logger.debug('Mobile UI configured by extension', { data });
      return { acknowledged: true };
    });

    // AD543 status updates
    this.messageHandlers.set('ad543_status', async (data) => {
      logger.debug('AD543 status update from extension', { data });
      return { acknowledged: true };
    });

    // AD543 injection completion
    this.messageHandlers.set('ad543_injection_complete', async (data) => {
      logger.info('AD543 injection completed', {
        adElements: data?.adElements || 0,
        hasVideo: data?.hasVideo || false
      });
      return { acknowledged: true };
    });

    // Element highlight confirmation
    this.messageHandlers.set('element_highlighted', async (data) => {
      logger.debug('Element highlighted by extension', { data });
      return { acknowledged: true };
    });

    // Data extraction results
    this.messageHandlers.set('data_extracted', async (data) => {
      logger.info('Data extracted by extension', { 
        elementsCount: data?.elements?.length || 0 
      });
      return { acknowledged: true };
    });

    // Error reports
    this.messageHandlers.set('error_report', async (data) => {
      logger.error('Extension reported error', new Error(data.message), { data });
      return { acknowledged: true };
    });

    // Extension status updates
    this.messageHandlers.set('status_update', async (data) => {
      logger.debug('Extension status update', { data });
      return { acknowledged: true };
    });
  }

  /**
   * Send message to specific connection
   */
  public async sendMessage(
    connectionId: string,
    message: { type: string; data?: any }
  ): Promise<boolean> {
    const connection = this.activeConnections.get(connectionId);
    if (!connection || connection.readyState !== WebSocket.OPEN) {
      logger.warn('Cannot send message: connection not available', { connectionId });
      return false;
    }

    try {
      const messageWithTimestamp = {
        ...message,
        timestamp: new Date(),
      };

      connection.send(JSON.stringify(messageWithTimestamp));
      
      logger.debug('Message sent to extension', {
        connectionId,
        type: message.type,
      });

      return true;
    } catch (error) {
      logger.error('Failed to send message to extension', error, { connectionId });
      return false;
    }
  }

  /**
   * Send command to all active connections
   */
  public async sendCommandToAllConnections(command: ExtensionCommand): Promise<{
    sent: number;
    failed: number;
    results: Array<{ connectionId: string; success: boolean; error?: string }>;
  }> {
    const results: Array<{ connectionId: string; success: boolean; error?: string }> = [];
    let sent = 0;
    let failed = 0;

    for (const [connectionId, connection] of this.activeConnections) {
      try {
        if (connection.readyState === WebSocket.OPEN) {
          const success = await this.sendMessage(connectionId, {
            type: 'command',
            data: command,
          });

          if (success) {
            sent++;
            results.push({ connectionId, success: true });
          } else {
            failed++;
            results.push({ connectionId, success: false, error: 'Send failed' });
          }
        } else {
          failed++;
          results.push({ connectionId, success: false, error: 'Connection not open' });
        }
      } catch (error) {
        failed++;
        results.push({ 
          connectionId, 
          success: false, 
          error: (error as Error).message 
        });
      }
    }

    logger.info('Command sent to all connections', {
      command: command.type,
      sent,
      failed,
      totalConnections: this.activeConnections.size,
    });

    return { sent, failed, results };
  }

  /**
   * Register custom message handler
   */
  public registerMessageHandler(
    type: string,
    handler: (data: any) => Promise<any>
  ): void {
    this.messageHandlers.set(type, handler);
    logger.debug('Message handler registered', { type });
  }

  /**
   * Remove message handler
   */
  public removeMessageHandler(type: string): void {
    this.messageHandlers.delete(type);
    logger.debug('Message handler removed', { type });
  }

  /**
   * Send screenshot command to extension
   */
  public async requestScreenshot(
    selector?: string,
    options?: { quality?: number; format?: string }
  ): Promise<any> {
    const command: ExtensionCommand = {
      type: 'screenshot',
      target: selector,
      options,
    };

    return this.sendCommandToAllConnections(command);
  }

  /**
   * Request mobile screenshot with UI overlay from enhanced extension
   */
  public async requestMobileScreenshot(
    deviceType: 'ios' | 'android' = 'ios',
    options?: {
      time?: string;
      url?: string;
      saveToFile?: boolean;
      returnAsBuffer?: boolean;
    }
  ): Promise<any> {
    const command: ExtensionCommand = {
      type: 'mobile_screenshot',
      options: {
        deviceType,
        time: options?.time,
        url: options?.url,
        saveToFile: options?.saveToFile || false,
        returnAsBuffer: options?.returnAsBuffer || true,
      },
    };

    logger.debug('Requesting mobile screenshot', {
      deviceType,
      options,
      activeConnections: this.activeConnections.size
    });

    return this.sendCommandToAllConnections(command);
  }

  /**
   * Configure mobile UI settings in extension
   */
  public async configureMobileUI(
    deviceType: 'ios' | 'android',
    options: {
      time?: string;
      url?: string;
    }
  ): Promise<any> {
    const command: ExtensionCommand = {
      type: 'configure_mobile_ui',
      options: {
        deviceType,
        time: options.time,
        url: options.url,
      },
    };

    logger.debug('Configuring mobile UI', {
      deviceType,
      options
    });

    return this.sendCommandToAllConnections(command);
  }

  /**
   * Trigger screenshot with AD543 integration
   */
  public async triggerAD543Screenshot(
    sessionId: string,
    deviceType: 'ios' | 'android' = 'ios',
    options?: {
      waitForAd?: boolean;
      timeout?: number;
    }
  ): Promise<Buffer> {
    try {
      logger.debug('Triggering AD543 screenshot', {
        sessionId,
        deviceType,
        options
      });

      // Configure mobile UI first
      await this.configureMobileUI(deviceType, {
        time: new Date().toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit'
        })
      });

      // Wait for configuration to apply
      await new Promise(resolve => setTimeout(resolve, 500));

      // Wait for ad to render if requested
      if (options?.waitForAd) {
        await this.waitForAdToRender(sessionId, options.timeout || 10000);
      }

      // Capture mobile screenshot
      const result = await this.requestMobileScreenshot(deviceType, {
        returnAsBuffer: true
      });

      // Extract base64 data from response
      if (result.results && result.results.length > 0) {
        const response = result.results[0];
        if (response.success && response.data) {
          // Convert base64 to buffer
          return Buffer.from(response.data, 'base64');
        }
      }

      throw new Error('Failed to capture mobile screenshot');
    } catch (error) {
      logger.error('AD543 screenshot failed', error, { sessionId, deviceType });
      throw error;
    }
  }

  /**
   * Wait for ad content to render
   */
  private async waitForAdToRender(sessionId: string, timeout: number = 10000): Promise<void> {
    const startTime = Date.now();
    const checkInterval = 1000;

    while (Date.now() - startTime < timeout) {
      try {
        // Use extract_data command to check for ad elements
        const adCheck = await this.extractData([
          '[id*="onead"]',
          '[class*="onead"]',
          '.gliaplayer-container video',
          '.trv-player-container video',
          'iframe[src*="doubleclick"]'
        ]);

        if (adCheck.results && adCheck.results.length > 0) {
          const response = adCheck.results[0];
          if (response.success && response.data?.elements?.length > 0) {
            logger.debug('Ad content detected, proceeding with screenshot', {
              sessionId,
              adElements: response.data.elements.length
            });
            return;
          }
        }

        await new Promise(resolve => setTimeout(resolve, checkInterval));
      } catch (error) {
        logger.warn('Error checking for ad content', { error, sessionId });
        await new Promise(resolve => setTimeout(resolve, checkInterval));
      }
    }

    logger.warn('Ad content not detected within timeout, proceeding anyway', {
      sessionId,
      timeout
    });
  }

  /**
   * Send element highlight command
   */
  public async highlightElement(
    selector: string,
    options?: {
      duration?: number;
      color?: string;
    }
  ): Promise<any> {
    const command: ExtensionCommand = {
      type: 'highlight',
      target: selector,
      options: {
        duration: options?.duration || 3000,
        color: options?.color || '#ff0000',
      },
    };

    return this.sendCommandToAllConnections(command);
  }

  /**
   * Send overlay display command
   */
  public async showOverlay(
    content: string,
    options?: {
      position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
      duration?: number;
    }
  ): Promise<any> {
    const command: ExtensionCommand = {
      type: 'overlay',
      data: { content },
      options: {
        position: options?.position || 'top-right',
        duration: options?.duration || 5000,
      },
    };

    return this.sendCommandToAllConnections(command);
  }

  /**
   * Request data extraction from page
   */
  public async extractData(
    selectors: string[],
    options?: { includeMetadata?: boolean }
  ): Promise<any> {
    const command: ExtensionCommand = {
      type: 'extract_data',
      data: { selectors },
      options,
    };

    return this.sendCommandToAllConnections(command);
  }

  /**
   * Get connection statistics
   */
  public getConnectionStats(): {
    totalConnections: number;
    activeConnections: number;
    connectionIds: string[];
  } {
    const activeConnections = Array.from(this.activeConnections.values())
      .filter(conn => conn.readyState === WebSocket.OPEN).length;

    return {
      totalConnections: this.activeConnections.size,
      activeConnections,
      connectionIds: Array.from(this.activeConnections.keys()),
    };
  }

  /**
   * Check if extension is connected
   */
  public isExtensionConnected(): boolean {
    return Array.from(this.activeConnections.values())
      .some(conn => conn.readyState === WebSocket.OPEN);
  }

  /**
   * Close specific connection
   */
  public closeConnection(connectionId: string): boolean {
    const connection = this.activeConnections.get(connectionId);
    if (connection) {
      connection.close();
      this.activeConnections.delete(connectionId);
      logger.info('Connection closed manually', { connectionId });
      return true;
    }
    return false;
  }

  /**
   * Close the bridge server
   */
  public async close(): Promise<void> {
    // Close all WebSocket connections
    for (const [_connectionId, connection] of this.activeConnections) {
      connection.close();
    }
    this.activeConnections.clear();

    // Close WebSocket server
    if (this.wsServer) {
      this.wsServer.close();
      this.wsServer = null;
    }

    // Close HTTP server
    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(() => {
          this.server = null;
          logger.info('Chrome Extension Bridge closed');
          resolve();
        });
      });
    }
  }

  /**
   * Generate sample Chrome extension manifest and content script
   */
  public static generateExtensionSample(): {
    manifest: any;
    contentScript: string;
    background: string;
  } {
    const manifest = {
      manifest_version: 3,
      name: "Ad Screenshot Automation Helper",
      version: "1.0.0",
      description: "Helper extension for ad screenshot automation",
      permissions: ["activeTab", "scripting"],
      content_scripts: [
        {
          matches: ["<all_urls>"],
          js: ["content.js"],
          run_at: "document_idle"
        }
      ],
      background: {
        service_worker: "background.js"
      },
      action: {
        default_popup: "popup.html"
      }
    };

    const contentScript = `
      // Chrome Extension Content Script for Ad Automation
      
      let websocket = null;
      
      function connectToAutomationBridge() {
        websocket = new WebSocket('ws://localhost:${config.chromeExtension.port}/extension-bridge');
        
        websocket.onopen = function() {
          console.log('Connected to automation bridge');
          sendMessage('status_update', { status: 'connected', url: window.location.href });
        };
        
        websocket.onmessage = function(event) {
          try {
            const message = JSON.parse(event.data);
            handleAutomationCommand(message);
          } catch (error) {
            console.error('Failed to parse message:', error);
          }
        };
        
        websocket.onclose = function() {
          console.log('Disconnected from automation bridge');
          // Reconnect after 5 seconds
          setTimeout(connectToAutomationBridge, 5000);
        };
      }
      
      function handleAutomationCommand(message) {
        if (message.type !== 'command') return;
        
        const command = message.data;
        
        switch (command.type) {
          case 'screenshot':
            handleScreenshotCommand(command);
            break;
          case 'highlight':
            handleHighlightCommand(command);
            break;
          case 'overlay':
            handleOverlayCommand(command);
            break;
          case 'extract_data':
            handleDataExtractionCommand(command);
            break;
        }
      }
      
      function handleScreenshotCommand(command) {
        // Implementation would use Chrome Extension APIs
        sendMessage('screenshot_complete', { 
          selector: command.target,
          timestamp: new Date().toISOString()
        });
      }
      
      function handleHighlightCommand(command) {
        const elements = document.querySelectorAll(command.target);
        elements.forEach(el => {
          el.style.outline = '3px solid ' + (command.options.color || '#ff0000');
          setTimeout(() => {
            el.style.outline = '';
          }, command.options.duration || 3000);
        });
        
        sendMessage('element_highlighted', { 
          selector: command.target,
          count: elements.length
        });
      }
      
      function handleOverlayCommand(command) {
        const overlay = document.createElement('div');
        overlay.innerHTML = command.data.content;
        overlay.style.cssText = \`
          position: fixed;
          top: 10px;
          right: 10px;
          z-index: 999999;
          background: rgba(0,0,0,0.8);
          color: white;
          padding: 10px;
          border-radius: 5px;
          font-family: Arial, sans-serif;
        \`;
        
        document.body.appendChild(overlay);
        
        setTimeout(() => {
          overlay.remove();
        }, command.options.duration || 5000);
      }
      
      function handleDataExtractionCommand(command) {
        const results = [];
        command.data.selectors.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            results.push({
              selector,
              text: el.textContent?.trim(),
              html: el.innerHTML,
              attributes: Object.fromEntries(
                Array.from(el.attributes).map(attr => [attr.name, attr.value])
              )
            });
          });
        });
        
        sendMessage('data_extracted', { elements: results });
      }
      
      function sendMessage(type, data) {
        if (websocket && websocket.readyState === WebSocket.OPEN) {
          websocket.send(JSON.stringify({
            type,
            payload: data,
            timestamp: new Date().toISOString()
          }));
        }
      }
      
      // Initialize connection when page loads
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', connectToAutomationBridge);
      } else {
        connectToAutomationBridge();
      }
    `;

    const background = `
      // Background script for automation helper
      
      chrome.runtime.onInstalled.addListener(() => {
        console.log('Ad Screenshot Automation Helper installed');
      });
      
      // Handle messages from content script if needed
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        // Handle cross-tab communication if needed
        sendResponse({ received: true });
      });
    `;

    return { manifest, contentScript, background };
  }
}