"use strict";
/**
 * Chrome Extension Bridge for UI overlay communication
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
exports.ChromeExtensionBridge = void 0;
const http = __importStar(require("http"));
const ws_1 = __importStar(require("ws"));
const LoggingService_1 = require("./LoggingService");
const config_1 = require("../config");
class ChromeExtensionBridge {
    server = null;
    wsServer = null;
    activeConnections = new Map();
    messageHandlers = new Map();
    static instance;
    constructor() {
        this.setupMessageHandlers();
    }
    /**
     * Get singleton instance
     */
    static getInstance() {
        if (!ChromeExtensionBridge.instance) {
            ChromeExtensionBridge.instance = new ChromeExtensionBridge();
        }
        return ChromeExtensionBridge.instance;
    }
    /**
     * Initialize the bridge server
     */
    async initialize() {
        try {
            // Create HTTP server for health check and REST endpoints
            this.server = http.createServer((req, res) => {
                this.handleHttpRequest(req, res);
            });
            // Create WebSocket server for real-time communication
            this.wsServer = new ws_1.WebSocketServer({
                server: this.server,
                path: '/extension-bridge'
            });
            this.setupWebSocketHandlers();
            // Start listening
            this.server.listen(config_1.config.chromeExtension.port, () => {
                LoggingService_1.logger.info('Chrome Extension Bridge initialized', {
                    port: config_1.config.chromeExtension.port,
                    endpoints: ['/health', '/extension-bridge'],
                });
            });
        }
        catch (error) {
            LoggingService_1.logger.error('Failed to initialize Chrome Extension Bridge', error);
            throw error;
        }
    }
    /**
     * Setup WebSocket event handlers
     */
    setupWebSocketHandlers() {
        if (!this.wsServer)
            return;
        this.wsServer.on('connection', (ws, req) => {
            const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const clientIP = req.socket.remoteAddress;
            this.activeConnections.set(connectionId, ws);
            LoggingService_1.logger.debug('Extension connection established', {
                connectionId,
                clientIP,
                totalConnections: this.activeConnections.size,
            });
            // Setup message handling
            ws.on('message', async (message) => {
                try {
                    await this.handleWebSocketMessage(connectionId, message.toString());
                }
                catch (error) {
                    LoggingService_1.logger.error('WebSocket message handling error', error, { connectionId });
                }
            });
            // Handle connection close
            ws.on('close', (code, reason) => {
                this.activeConnections.delete(connectionId);
                LoggingService_1.logger.debug('Extension connection closed', {
                    connectionId,
                    code,
                    reason: reason.toString(),
                    totalConnections: this.activeConnections.size,
                });
            });
            // Handle errors
            ws.on('error', (error) => {
                LoggingService_1.logger.error('WebSocket connection error', error, { connectionId });
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
    handleHttpRequest(req, res) {
        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }
        const url = new URL(req.url || '/', `http://localhost:${config_1.config.chromeExtension.port}`);
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
    handleHealthCheck(res) {
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
    handleConnectionsStatus(res) {
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
    async handleSendCommand(req, res) {
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
                    const command = JSON.parse(body);
                    const result = await this.sendCommandToAllConnections(command);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(result));
                }
                catch (error) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid JSON' }));
                }
            });
        }
        catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
        }
    }
    /**
     * Handle WebSocket messages
     */
    async handleWebSocketMessage(connectionId, message) {
        try {
            const parsedMessage = JSON.parse(message);
            LoggingService_1.logger.debug('Received extension message', {
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
            }
            else {
                LoggingService_1.logger.warn('Unhandled message type', { type: parsedMessage.type, connectionId });
            }
        }
        catch (error) {
            LoggingService_1.logger.error('Failed to handle WebSocket message', error, { connectionId, message });
        }
    }
    /**
     * Setup default message handlers
     */
    setupMessageHandlers() {
        // Screenshot completion handler
        this.messageHandlers.set('screenshot_complete', async (data) => {
            LoggingService_1.logger.info('Screenshot completed by extension', { data });
            return { acknowledged: true };
        });
        // Mobile screenshot completion handler
        this.messageHandlers.set('mobile_screenshot_complete', async (data) => {
            LoggingService_1.logger.info('Mobile screenshot completed by extension', {
                deviceType: data?.deviceType,
                dataSize: data?.imageData?.length || 0
            });
            return { acknowledged: true, data: data?.imageData };
        });
        // Mobile UI configuration confirmation
        this.messageHandlers.set('mobile_ui_configured', async (data) => {
            LoggingService_1.logger.debug('Mobile UI configured by extension', { data });
            return { acknowledged: true };
        });
        // AD543 status updates
        this.messageHandlers.set('ad543_status', async (data) => {
            LoggingService_1.logger.debug('AD543 status update from extension', { data });
            return { acknowledged: true };
        });
        // AD543 injection completion
        this.messageHandlers.set('ad543_injection_complete', async (data) => {
            LoggingService_1.logger.info('AD543 injection completed', {
                adElements: data?.adElements || 0,
                hasVideo: data?.hasVideo || false
            });
            return { acknowledged: true };
        });
        // Element highlight confirmation
        this.messageHandlers.set('element_highlighted', async (data) => {
            LoggingService_1.logger.debug('Element highlighted by extension', { data });
            return { acknowledged: true };
        });
        // Data extraction results
        this.messageHandlers.set('data_extracted', async (data) => {
            LoggingService_1.logger.info('Data extracted by extension', {
                elementsCount: data?.elements?.length || 0
            });
            return { acknowledged: true };
        });
        // Error reports
        this.messageHandlers.set('error_report', async (data) => {
            LoggingService_1.logger.error('Extension reported error', new Error(data.message), { data });
            return { acknowledged: true };
        });
        // Extension status updates
        this.messageHandlers.set('status_update', async (data) => {
            LoggingService_1.logger.debug('Extension status update', { data });
            return { acknowledged: true };
        });
    }
    /**
     * Send message to specific connection
     */
    async sendMessage(connectionId, message) {
        const connection = this.activeConnections.get(connectionId);
        if (!connection || connection.readyState !== ws_1.default.OPEN) {
            LoggingService_1.logger.warn('Cannot send message: connection not available', { connectionId });
            return false;
        }
        try {
            const messageWithTimestamp = {
                ...message,
                timestamp: new Date(),
            };
            connection.send(JSON.stringify(messageWithTimestamp));
            LoggingService_1.logger.debug('Message sent to extension', {
                connectionId,
                type: message.type,
            });
            return true;
        }
        catch (error) {
            LoggingService_1.logger.error('Failed to send message to extension', error, { connectionId });
            return false;
        }
    }
    /**
     * Send command to all active connections
     */
    async sendCommandToAllConnections(command) {
        const results = [];
        let sent = 0;
        let failed = 0;
        for (const [connectionId, connection] of this.activeConnections) {
            try {
                if (connection.readyState === ws_1.default.OPEN) {
                    const success = await this.sendMessage(connectionId, {
                        type: 'command',
                        data: command,
                    });
                    if (success) {
                        sent++;
                        results.push({ connectionId, success: true });
                    }
                    else {
                        failed++;
                        results.push({ connectionId, success: false, error: 'Send failed' });
                    }
                }
                else {
                    failed++;
                    results.push({ connectionId, success: false, error: 'Connection not open' });
                }
            }
            catch (error) {
                failed++;
                results.push({
                    connectionId,
                    success: false,
                    error: error.message
                });
            }
        }
        LoggingService_1.logger.info('Command sent to all connections', {
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
    registerMessageHandler(type, handler) {
        this.messageHandlers.set(type, handler);
        LoggingService_1.logger.debug('Message handler registered', { type });
    }
    /**
     * Remove message handler
     */
    removeMessageHandler(type) {
        this.messageHandlers.delete(type);
        LoggingService_1.logger.debug('Message handler removed', { type });
    }
    /**
     * Send screenshot command to extension
     */
    async requestScreenshot(selector, options) {
        const command = {
            type: 'screenshot',
            target: selector,
            options,
        };
        return this.sendCommandToAllConnections(command);
    }
    /**
     * Request mobile screenshot with UI overlay from enhanced extension
     */
    async requestMobileScreenshot(deviceType = 'ios', options) {
        const command = {
            type: 'mobile_screenshot',
            options: {
                deviceType,
                time: options?.time,
                url: options?.url,
                saveToFile: options?.saveToFile || false,
                returnAsBuffer: options?.returnAsBuffer || true,
            },
        };
        LoggingService_1.logger.debug('Requesting mobile screenshot', {
            deviceType,
            options,
            activeConnections: this.activeConnections.size
        });
        return this.sendCommandToAllConnections(command);
    }
    /**
     * Configure mobile UI settings in extension
     */
    async configureMobileUI(deviceType, options) {
        const command = {
            type: 'configure_mobile_ui',
            options: {
                deviceType,
                time: options.time,
                url: options.url,
            },
        };
        LoggingService_1.logger.debug('Configuring mobile UI', {
            deviceType,
            options
        });
        return this.sendCommandToAllConnections(command);
    }
    /**
     * Trigger screenshot with AD543 integration
     */
    async triggerAD543Screenshot(sessionId, deviceType = 'ios', options) {
        try {
            LoggingService_1.logger.debug('Triggering AD543 screenshot', {
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
        }
        catch (error) {
            LoggingService_1.logger.error('AD543 screenshot failed', error, { sessionId, deviceType });
            throw error;
        }
    }
    /**
     * Wait for ad content to render
     */
    async waitForAdToRender(sessionId, timeout = 10000) {
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
                        LoggingService_1.logger.debug('Ad content detected, proceeding with screenshot', {
                            sessionId,
                            adElements: response.data.elements.length
                        });
                        return;
                    }
                }
                await new Promise(resolve => setTimeout(resolve, checkInterval));
            }
            catch (error) {
                LoggingService_1.logger.warn('Error checking for ad content', { error, sessionId });
                await new Promise(resolve => setTimeout(resolve, checkInterval));
            }
        }
        LoggingService_1.logger.warn('Ad content not detected within timeout, proceeding anyway', {
            sessionId,
            timeout
        });
    }
    /**
     * Send element highlight command
     */
    async highlightElement(selector, options) {
        const command = {
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
    async showOverlay(content, options) {
        const command = {
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
    async extractData(selectors, options) {
        const command = {
            type: 'extract_data',
            data: { selectors },
            options,
        };
        return this.sendCommandToAllConnections(command);
    }
    /**
     * Get connection statistics
     */
    getConnectionStats() {
        const activeConnections = Array.from(this.activeConnections.values())
            .filter(conn => conn.readyState === ws_1.default.OPEN).length;
        return {
            totalConnections: this.activeConnections.size,
            activeConnections,
            connectionIds: Array.from(this.activeConnections.keys()),
        };
    }
    /**
     * Check if extension is connected
     */
    isExtensionConnected() {
        return Array.from(this.activeConnections.values())
            .some(conn => conn.readyState === ws_1.default.OPEN);
    }
    /**
     * Close specific connection
     */
    closeConnection(connectionId) {
        const connection = this.activeConnections.get(connectionId);
        if (connection) {
            connection.close();
            this.activeConnections.delete(connectionId);
            LoggingService_1.logger.info('Connection closed manually', { connectionId });
            return true;
        }
        return false;
    }
    /**
     * Close the bridge server
     */
    async close() {
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
                this.server.close(() => {
                    this.server = null;
                    LoggingService_1.logger.info('Chrome Extension Bridge closed');
                    resolve();
                });
            });
        }
    }
    /**
     * Generate sample Chrome extension manifest and content script
     */
    static generateExtensionSample() {
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
        websocket = new WebSocket('ws://localhost:${config_1.config.chromeExtension.port}/extension-bridge');
        
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
exports.ChromeExtensionBridge = ChromeExtensionBridge;
//# sourceMappingURL=ChromeExtensionBridge.js.map