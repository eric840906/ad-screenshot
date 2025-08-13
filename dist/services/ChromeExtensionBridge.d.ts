/**
 * Chrome Extension Bridge for UI overlay communication
 */
export interface ExtensionCommand {
    type: 'screenshot' | 'highlight' | 'overlay' | 'extract_data' | 'mobile_screenshot' | 'configure_mobile_ui';
    target?: string;
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
export declare class ChromeExtensionBridge {
    private server;
    private wsServer;
    private activeConnections;
    private messageHandlers;
    private static instance;
    constructor();
    /**
     * Get singleton instance
     */
    static getInstance(): ChromeExtensionBridge;
    /**
     * Initialize the bridge server
     */
    initialize(): Promise<void>;
    /**
     * Setup WebSocket event handlers
     */
    private setupWebSocketHandlers;
    /**
     * Handle HTTP requests
     */
    private handleHttpRequest;
    /**
     * Handle health check endpoint
     */
    private handleHealthCheck;
    /**
     * Handle connections status endpoint
     */
    private handleConnectionsStatus;
    /**
     * Handle send command endpoint
     */
    private handleSendCommand;
    /**
     * Handle WebSocket messages
     */
    private handleWebSocketMessage;
    /**
     * Setup default message handlers
     */
    private setupMessageHandlers;
    /**
     * Send message to specific connection
     */
    sendMessage(connectionId: string, message: {
        type: string;
        data?: any;
    }): Promise<boolean>;
    /**
     * Send command to all active connections
     */
    sendCommandToAllConnections(command: ExtensionCommand): Promise<{
        sent: number;
        failed: number;
        results: Array<{
            connectionId: string;
            success: boolean;
            error?: string;
        }>;
    }>;
    /**
     * Register custom message handler
     */
    registerMessageHandler(type: string, handler: (data: any) => Promise<any>): void;
    /**
     * Remove message handler
     */
    removeMessageHandler(type: string): void;
    /**
     * Send screenshot command to extension
     */
    requestScreenshot(selector?: string, options?: {
        quality?: number;
        format?: string;
    }): Promise<any>;
    /**
     * Request mobile screenshot with UI overlay from enhanced extension
     */
    requestMobileScreenshot(deviceType?: 'ios' | 'android', options?: {
        time?: string;
        url?: string;
        saveToFile?: boolean;
        returnAsBuffer?: boolean;
    }): Promise<any>;
    /**
     * Configure mobile UI settings in extension
     */
    configureMobileUI(deviceType: 'ios' | 'android', options: {
        time?: string;
        url?: string;
    }): Promise<any>;
    /**
     * Trigger screenshot with AD543 integration
     */
    triggerAD543Screenshot(sessionId: string, deviceType?: 'ios' | 'android', options?: {
        waitForAd?: boolean;
        timeout?: number;
    }): Promise<Buffer>;
    /**
     * Wait for ad content to render
     */
    private waitForAdToRender;
    /**
     * Send element highlight command
     */
    highlightElement(selector: string, options?: {
        duration?: number;
        color?: string;
    }): Promise<any>;
    /**
     * Send overlay display command
     */
    showOverlay(content: string, options?: {
        position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
        duration?: number;
    }): Promise<any>;
    /**
     * Request data extraction from page
     */
    extractData(selectors: string[], options?: {
        includeMetadata?: boolean;
    }): Promise<any>;
    /**
     * Get connection statistics
     */
    getConnectionStats(): {
        totalConnections: number;
        activeConnections: number;
        connectionIds: string[];
    };
    /**
     * Check if extension is connected
     */
    isExtensionConnected(): boolean;
    /**
     * Close specific connection
     */
    closeConnection(connectionId: string): boolean;
    /**
     * Close the bridge server
     */
    close(): Promise<void>;
    /**
     * Generate sample Chrome extension manifest and content script
     */
    static generateExtensionSample(): {
        manifest: any;
        contentScript: string;
        background: string;
    };
}
//# sourceMappingURL=ChromeExtensionBridge.d.ts.map