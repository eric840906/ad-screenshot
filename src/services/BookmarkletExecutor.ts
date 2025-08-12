/**
 * Bookmarklet execution service for JavaScript injection with parameters
 */

import { BookmarkletConfig } from '@/types';
import { logger } from './LoggingService';
import { BrowserAutomationEngine } from './BrowserAutomationEngine';

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

export class BookmarkletExecutor {
  private browserEngine: BrowserAutomationEngine;
  private static instance: BookmarkletExecutor;

  constructor() {
    this.browserEngine = BrowserAutomationEngine.getInstance();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): BookmarkletExecutor {
    if (!BookmarkletExecutor.instance) {
      BookmarkletExecutor.instance = new BookmarkletExecutor();
    }
    return BookmarkletExecutor.instance;
  }

  /**
   * Execute bookmarklet with parameters
   */
  public async executeBookmarklet(
    sessionId: string,
    config: BookmarkletConfig
  ): Promise<BookmarkletResult> {
    const startTime = Date.now();

    try {
      // Validate and prepare parameters
      const preparedScript = this.prepareScript(config.script, config.parameters);

      logger.debug('Executing bookmarklet', {
        sessionId,
        parametersCount: Object.keys(config.parameters).length,
        timeout: config.timeout,
      });

      // Execute the bookmarklet script
      const result = await this.browserEngine.executeBookmarklet(
        sessionId,
        preparedScript,
        config.parameters
      );

      // Wait for selector if specified
      if (config.waitForSelector) {
        await this.browserEngine.waitForSelector(
          sessionId,
          config.waitForSelector,
          config.timeout
        );
      }

      const executionTime = Date.now() - startTime;

      logger.debug('Bookmarklet executed successfully', {
        sessionId,
        executionTime,
        resultType: typeof result,
      });

      return {
        success: true,
        result,
        executionTime,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      logger.error('Bookmarklet execution failed', error, {
        sessionId,
        executionTime,
      });

      return {
        success: false,
        error: error.message,
        executionTime,
      };
    }
  }

  /**
   * Prepare script by injecting parameters and utilities
   */
  private prepareScript(script: string, parameters: Record<string, any>): string {
    const utilityFunctions = this.getUtilityFunctions();
    const parametersInjection = this.generateParametersInjection(parameters);

    return `
      (function() {
        'use strict';
        
        ${utilityFunctions}
        ${parametersInjection}
        
        try {
          ${script}
        } catch (error) {
          console.error('Bookmarklet execution error:', error);
          throw error;
        }
      })();
    `;
  }

  /**
   * Generate utility functions for bookmarklets
   */
  private getUtilityFunctions(): string {
    return `
      // Utility functions for bookmarklets
      
      function waitForElement(selector, timeout = 5000) {
        return new Promise((resolve, reject) => {
          const element = document.querySelector(selector);
          if (element) {
            resolve(element);
            return;
          }
          
          const observer = new MutationObserver((mutations, obs) => {
            const element = document.querySelector(selector);
            if (element) {
              obs.disconnect();
              resolve(element);
            }
          });
          
          observer.observe(document.body, {
            childList: true,
            subtree: true
          });
          
          setTimeout(() => {
            observer.disconnect();
            reject(new Error('Element not found: ' + selector));
          }, timeout);
        });
      }
      
      function highlightElement(element, color = '#ff0000', duration = 2000) {
        if (!element) return;
        
        const originalStyle = element.style.cssText;
        element.style.outline = '3px solid ' + color;
        element.style.outlineOffset = '2px';
        element.style.backgroundColor = color + '20';
        
        setTimeout(() => {
          element.style.cssText = originalStyle;
        }, duration);
      }
      
      function createOverlay(content, position = 'top-right') {
        const overlay = document.createElement('div');
        overlay.id = 'bookmarklet-overlay-' + Date.now();
        overlay.innerHTML = content;
        
        const positions = {
          'top-left': { top: '10px', left: '10px' },
          'top-right': { top: '10px', right: '10px' },
          'bottom-left': { bottom: '10px', left: '10px' },
          'bottom-right': { bottom: '10px', right: '10px' },
          'center': { 
            top: '50%', 
            left: '50%', 
            transform: 'translate(-50%, -50%)' 
          }
        };
        
        Object.assign(overlay.style, {
          position: 'fixed',
          zIndex: '999999',
          padding: '10px',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          borderRadius: '5px',
          fontSize: '14px',
          fontFamily: 'Arial, sans-serif',
          maxWidth: '300px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          ...positions[position]
        });
        
        document.body.appendChild(overlay);
        
        return {
          element: overlay,
          remove: () => overlay.remove(),
          update: (newContent) => overlay.innerHTML = newContent
        };
      }
      
      function logMessage(message, type = 'info') {
        const timestamp = new Date().toISOString();
        console.log('[Bookmarklet ' + timestamp + '] ' + type.toUpperCase() + ':', message);
        
        // Send message to extension if available
        if (window.postMessage) {
          window.postMessage({
            type: 'BOOKMARKLET_LOG',
            data: { message, type, timestamp }
          }, '*');
        }
      }
      
      function getElementMetadata(element) {
        if (!element) return null;
        
        const rect = element.getBoundingClientRect();
        return {
          tagName: element.tagName.toLowerCase(),
          id: element.id,
          className: element.className,
          textContent: element.textContent?.slice(0, 100),
          position: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          },
          isVisible: rect.width > 0 && rect.height > 0,
          computedStyle: window.getComputedStyle(element)
        };
      }
    `;
  }

  /**
   * Generate parameters injection code
   */
  private generateParametersInjection(parameters: Record<string, any>): string {
    const serializedParams = JSON.stringify(parameters, null, 2);
    
    return `
      // Injected parameters
      const PARAMS = ${serializedParams};
      
      // Helper function to get parameter with default
      function getParam(name, defaultValue = null) {
        return PARAMS.hasOwnProperty(name) ? PARAMS[name] : defaultValue;
      }
      
      // Make parameters available globally
      window.__bookmarkletParams = PARAMS;
    `;
  }

  /**
   * Get predefined bookmarklet templates
   */
  public getBookmarkletTemplates(): BookmarkletTemplate[] {
    return [
      {
        name: 'Element Highlighter',
        description: 'Highlights elements matching a CSS selector',
        script: `
          const selector = getParam('selector', '.ad');
          const color = getParam('color', '#ff0000');
          const duration = getParam('duration', 5000);
          
          const elements = document.querySelectorAll(selector);
          logMessage('Found ' + elements.length + ' elements with selector: ' + selector);
          
          elements.forEach(element => {
            highlightElement(element, color, duration);
          });
          
          if (elements.length > 0) {
            const overlay = createOverlay(
              'Highlighted ' + elements.length + ' elements',
              'top-right'
            );
            
            setTimeout(() => overlay.remove(), 3000);
          }
          
          return {
            elementsFound: elements.length,
            selector: selector
          };
        `,
        parameters: [
          {
            name: 'selector',
            type: 'string',
            required: true,
            description: 'CSS selector to target elements'
          },
          {
            name: 'color',
            type: 'string',
            required: false,
            defaultValue: '#ff0000',
            description: 'Highlight color'
          },
          {
            name: 'duration',
            type: 'number',
            required: false,
            defaultValue: 5000,
            description: 'Highlight duration in milliseconds'
          }
        ]
      },
      {
        name: 'Ad Information Extractor',
        description: 'Extracts information from ad elements',
        script: `
          const selector = getParam('selector', '.ad');
          const includeMetadata = getParam('includeMetadata', true);
          
          const elements = document.querySelectorAll(selector);
          const results = [];
          
          elements.forEach((element, index) => {
            const info = {
              index: index,
              text: element.textContent?.trim(),
              html: element.innerHTML,
              attributes: {},
              links: []
            };
            
            // Extract attributes
            for (let attr of element.attributes) {
              info.attributes[attr.name] = attr.value;
            }
            
            // Extract links
            const links = element.querySelectorAll('a[href]');
            links.forEach(link => {
              info.links.push({
                text: link.textContent?.trim(),
                href: link.href,
                target: link.target
              });
            });
            
            // Include metadata if requested
            if (includeMetadata) {
              info.metadata = getElementMetadata(element);
            }
            
            results.push(info);
          });
          
          logMessage('Extracted information from ' + results.length + ' ad elements');
          
          return {
            elementsFound: results.length,
            data: results,
            extractedAt: new Date().toISOString()
          };
        `,
        parameters: [
          {
            name: 'selector',
            type: 'string',
            required: true,
            description: 'CSS selector for ad elements'
          },
          {
            name: 'includeMetadata',
            type: 'boolean',
            required: false,
            defaultValue: true,
            description: 'Include element metadata in results'
          }
        ]
      },
      {
        name: 'Page Scanner',
        description: 'Scans page for various ad-related elements',
        script: `
          const adSelectors = getParam('adSelectors', [
            '.ad', '.advertisement', '[class*="ad-"]', '[id*="ad-"]',
            '.banner', '.promo', '.sponsored', '[data-ad]'
          ]);
          
          const results = {
            pageInfo: {
              url: window.location.href,
              title: document.title,
              timestamp: new Date().toISOString()
            },
            adElements: {},
            totalAds: 0
          };
          
          adSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
              results.adElements[selector] = {
                count: elements.length,
                elements: Array.from(elements).map(el => getElementMetadata(el))
              };
              results.totalAds += elements.length;
            }
          });
          
          // Create summary overlay
          const summaryText = 'Found ' + results.totalAds + ' ad elements using ' + 
                             Object.keys(results.adElements).length + ' selectors';
          
          const overlay = createOverlay(summaryText, 'bottom-right');
          setTimeout(() => overlay.remove(), 5000);
          
          logMessage(summaryText);
          
          return results;
        `,
        parameters: [
          {
            name: 'adSelectors',
            type: 'object',
            required: false,
            defaultValue: ['.ad', '.advertisement', '[class*="ad-"]'],
            description: 'Array of CSS selectors to scan for ads'
          }
        ]
      }
    ];
  }

  /**
   * Create bookmarklet configuration from template
   */
  public createConfigFromTemplate(
    templateName: string,
    parameters: Record<string, any> = {},
    options: {
      timeout?: number;
      waitForSelector?: string;
    } = {}
  ): BookmarkletConfig {
    const template = this.getBookmarkletTemplates().find(t => t.name === templateName);
    if (!template) {
      throw new Error(`Bookmarklet template not found: ${templateName}`);
    }

    // Validate required parameters
    const missingParams = template.parameters
      .filter(param => param.required && !(param.name in parameters))
      .map(param => param.name);

    if (missingParams.length > 0) {
      throw new Error(`Missing required parameters: ${missingParams.join(', ')}`);
    }

    // Apply default values for missing optional parameters
    const finalParameters = { ...parameters };
    template.parameters.forEach(param => {
      if (!(param.name in finalParameters) && param.defaultValue !== undefined) {
        finalParameters[param.name] = param.defaultValue;
      }
    });

    return {
      script: template.script,
      parameters: finalParameters,
      timeout: options.timeout || 10000,
      waitForSelector: options.waitForSelector,
    };
  }

  /**
   * Validate bookmarklet configuration
   */
  public validateConfig(config: BookmarkletConfig): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.script || typeof config.script !== 'string') {
      errors.push('Script is required and must be a string');
    }

    if (!config.parameters || typeof config.parameters !== 'object') {
      errors.push('Parameters must be an object');
    }

    if (config.timeout && (typeof config.timeout !== 'number' || config.timeout <= 0)) {
      errors.push('Timeout must be a positive number');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Execute bookmarklet with retry logic
   */
  public async executeWithRetry(
    sessionId: string,
    config: BookmarkletConfig,
    maxRetries: number = 3,
    retryDelay: number = 1000
  ): Promise<BookmarkletResult> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.executeBookmarklet(sessionId, config);
        
        if (result.success) {
          if (attempt > 1) {
            logger.info('Bookmarklet succeeded on retry', {
              sessionId,
              attempt,
              totalAttempts: maxRetries,
            });
          }
          return result;
        }
        
        lastError = new Error(result.error || 'Unknown error');
      } catch (error) {
        lastError = error as Error;
      }

      if (attempt < maxRetries) {
        logger.warn('Bookmarklet failed, retrying', {
          sessionId,
          attempt,
          totalAttempts: maxRetries,
          error: lastError?.message,
        });
        
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
      }
    }

    logger.error('Bookmarklet failed after all retries', lastError, {
      sessionId,
      totalAttempts: maxRetries,
    });

    return {
      success: false,
      error: lastError?.message || 'Failed after all retries',
      executionTime: 0,
    };
  }
}