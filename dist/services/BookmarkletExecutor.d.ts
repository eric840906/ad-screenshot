/**
 * Bookmarklet execution service for JavaScript injection with parameters
 */
import { BookmarkletConfig } from '../types';
export interface BookmarkletResult {
    success: boolean;
    result?: any;
    error?: string;
    executionTime: number;
}
export interface BookmarkletTemplate {
    name: string;
    description: string;
    script: string;
    parameters: Array<{
        name: string;
        type: 'string' | 'number' | 'boolean' | 'object';
        required: boolean;
        defaultValue?: any;
        description?: string;
    }>;
}
export declare class BookmarkletExecutor {
    private browserEngine;
    private static instance;
    constructor();
    /**
     * Get singleton instance
     */
    static getInstance(): BookmarkletExecutor;
    /**
     * Execute bookmarklet with parameters
     */
    executeBookmarklet(sessionId: string, config: BookmarkletConfig): Promise<BookmarkletResult>;
    /**
     * Prepare script by injecting parameters and utilities
     */
    private prepareScript;
    /**
     * Generate utility functions for bookmarklets
     */
    private getUtilityFunctions;
    /**
     * Generate parameters injection code
     */
    private generateParametersInjection;
    /**
     * Execute company AD543 bookmarklet for ad search and analysis
     */
    executeAD543Bookmarklet(sessionId: string, options?: {
        openPanel?: boolean;
        waitForReady?: boolean;
        timeout?: number;
    }): Promise<BookmarkletResult>;
    /**
     * Get the company's AD543 bookmarklet script
     */
    private getAD543BookmarkletScript;
    /**
     * Wait for AD543 to be fully loaded and ready
     */
    private waitForAD543Ready;
    /**
     * Trigger AD543 search panel with Shift+W keyboard shortcut
     */
    private triggerAD543Panel;
    /**
     * Check if AD543 panel is currently visible
     */
    isAD543PanelVisible(sessionId: string): Promise<boolean>;
    /**
     * Configure AD543 outstream ad settings
     */
    configureAD543Outstream(sessionId: string, config: {
        source: 'staging' | 'onevision';
        playMode: 'MFS' | 'MIR' | 'Desktop' | 'TD' | 'IP' | 'IR';
        pid: string;
        uid: string;
        selector?: string;
    }): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Configure AD543 instream video settings
     */
    configureAD543Instream(sessionId: string, config: {
        player: 'glia' | 'truvid';
        videoUrl: string;
        clickUrl: string;
    }): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Configure AD543 DV360 settings
     */
    configureAD543DV360(sessionId: string, config: {
        campaignUrl: string;
        targetIframe: string;
    }): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Execute AD543 ad injection (Shift+R functionality)
     */
    executeAD543Injection(sessionId: string, targetSelector?: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Get current AD543 configuration
     */
    getAD543Config(sessionId: string): Promise<{
        outstream?: any;
        instream?: any;
        dv360?: any;
    }>;
    /**
     * Open AD543 panel programmatically
     */
    openAD543Panel(sessionId: string, tab?: 'outstream' | 'instream' | 'dv360'): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Get predefined bookmarklet templates including AD543
     */
    getBookmarkletTemplates(): BookmarkletTemplate[];
    /**
     * Create bookmarklet configuration from template
     */
    createConfigFromTemplate(templateName: string, parameters?: Record<string, any>, options?: {
        timeout?: number;
        waitForSelector?: string;
    }): BookmarkletConfig;
    /**
     * Validate bookmarklet configuration
     */
    validateConfig(config: BookmarkletConfig): {
        isValid: boolean;
        errors: string[];
    };
    /**
     * Execute bookmarklet with retry logic
     */
    executeWithRetry(sessionId: string, config: BookmarkletConfig, maxRetries?: number, retryDelay?: number): Promise<BookmarkletResult>;
}
//# sourceMappingURL=BookmarkletExecutor.d.ts.map