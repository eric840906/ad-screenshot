"use strict";
/**
 * Bookmarklet execution service for JavaScript injection with parameters
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookmarkletExecutor = void 0;
const LoggingService_1 = require("./LoggingService");
const BrowserAutomationEngine_1 = require("./BrowserAutomationEngine");
class BookmarkletExecutor {
    browserEngine;
    static instance;
    constructor() {
        this.browserEngine = BrowserAutomationEngine_1.BrowserAutomationEngine.getInstance();
    }
    /**
     * Get singleton instance
     */
    static getInstance() {
        if (!BookmarkletExecutor.instance) {
            BookmarkletExecutor.instance = new BookmarkletExecutor();
        }
        return BookmarkletExecutor.instance;
    }
    /**
     * Execute bookmarklet with parameters
     */
    async executeBookmarklet(sessionId, config) {
        const startTime = Date.now();
        try {
            // Validate and prepare parameters
            const preparedScript = this.prepareScript(config.script, config.parameters);
            LoggingService_1.logger.debug('Executing bookmarklet', {
                sessionId,
                parametersCount: Object.keys(config.parameters).length,
                timeout: config.timeout,
            });
            // Execute the bookmarklet script
            const result = await this.browserEngine.executeBookmarklet(sessionId, preparedScript, config.parameters);
            // Wait for selector if specified
            if (config.waitForSelector) {
                await this.browserEngine.waitForSelector(sessionId, config.waitForSelector, config.timeout);
            }
            const executionTime = Date.now() - startTime;
            LoggingService_1.logger.debug('Bookmarklet executed successfully', {
                sessionId,
                executionTime,
                resultType: typeof result,
            });
            return {
                success: true,
                result,
                executionTime,
            };
        }
        catch (error) {
            const executionTime = Date.now() - startTime;
            LoggingService_1.logger.error('Bookmarklet execution failed', error, {
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
    prepareScript(script, parameters) {
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
    getUtilityFunctions() {
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
    generateParametersInjection(parameters) {
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
     * Execute company AD543 bookmarklet for ad search and analysis
     */
    async executeAD543Bookmarklet(sessionId, options = {}) {
        const startTime = Date.now();
        const { openPanel = false, waitForReady = true, timeout = 30000 } = options;
        try {
            LoggingService_1.logger.debug('Executing AD543 bookmarklet', {
                sessionId,
                openPanel,
                waitForReady,
                timeout
            });
            // Execute the company's AD543 bookmarklet
            const ad543Script = this.getAD543BookmarkletScript();
            await this.browserEngine.executeBrowserScript(sessionId, ad543Script);
            // Wait for AD543 to be loaded if requested
            if (waitForReady) {
                await this.waitForAD543Ready(sessionId, timeout);
            }
            // Optionally open the search panel with Shift+W
            if (openPanel) {
                await this.triggerAD543Panel(sessionId);
            }
            const executionTime = Date.now() - startTime;
            LoggingService_1.logger.debug('AD543 bookmarklet executed successfully', {
                sessionId,
                executionTime,
                panelOpened: openPanel
            });
            return {
                success: true,
                result: { ad543Loaded: true, panelOpened: openPanel },
                executionTime
            };
        }
        catch (error) {
            const executionTime = Date.now() - startTime;
            LoggingService_1.logger.error('AD543 bookmarklet execution failed', error, {
                sessionId,
                executionTime
            });
            return {
                success: false,
                error: error.message,
                executionTime
            };
        }
    }
    /**
     * Get the company's AD543 bookmarklet script
     */
    getAD543BookmarkletScript() {
        return `
      (function() {
        // Check if already loaded to prevent duplicate loading
        if (window.AD543Loaded) {
          console.log('查廣告543 已經載入！請按 Shift+W 開啟面板');
          return { alreadyLoaded: true };
        }
        
        // Set loaded flag
        window.AD543Loaded = true;
        
        // Define CSS URLs for the ad search panel
        window.AD543_CSS_URL = 'https://ad-specs.guoshipartners.com/static/tampermonkeyScript/searchPanelStyle.css';
        window.AD543_SV_CSS_URL = 'https://ad-specs.guoshipartners.com/static/tampermonkeyScript/svStyle.css';
        
        var cssPromises = [];
        
        // Load and cache search panel CSS
        cssPromises.push(
          fetch('https://ad-specs.guoshipartners.com/static/tampermonkeyScript/searchPanelStyle.css')
            .then(function(r) { return r.text() })
            .then(function(css) {
              window.AD543_CSS_CACHE = window.AD543_CSS_CACHE || {};
              window.AD543_CSS_CACHE['IMPORTED_CSS'] = css;
              try {
                sessionStorage.setItem('AD543_CSS_IMPORTED_CSS', css);
              } catch(e) {}
            })
            .catch(function(e) {
              console.error('Failed to load searchPanelStyle.css:', e);
            })
        );
        
        // Load and cache SV CSS
        cssPromises.push(
          fetch('https://ad-specs.guoshipartners.com/static/tampermonkeyScript/svStyle.css')
            .then(function(r) { return r.text() })
            .then(function(css) {
              window.AD543_CSS_CACHE = window.AD543_CSS_CACHE || {};
              window.AD543_CSS_CACHE['IMPORTED_SV_CSS'] = css;
              try {
                sessionStorage.setItem('AD543_CSS_IMPORTED_SV_CSS', css);
              } catch(e) {}
            })
            .catch(function(e) {
              console.error('Failed to load svStyle.css:', e);
            })
        );
        
        // Inject CSS links into document head
        var cssUrls = [
          'https://ad-specs.guoshipartners.com/static/tampermonkeyScript/searchPanelStyle.css',
          'https://ad-specs.guoshipartners.com/static/tampermonkeyScript/svStyle.css'
        ];
        
        cssUrls.forEach(function(url) {
          var link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = url;
          document.head.appendChild(link);
        });
        
        // After CSS is loaded, load the polyfill and main script
        return Promise.all(cssPromises).then(function() {
          console.log('CSS preloaded, loading polyfill...');
          
          return new Promise(function(resolve, reject) {
            // Load GM polyfill (Greasemonkey/Tampermonkey compatibility)
            var polyfill = document.createElement('script');
            polyfill.src = 'https://rd-dev.onead.tw/test_demo/ericchiu/bookmarklet/gm-polyfill.js';
            polyfill.onload = function() {
              console.log('Polyfill loaded, loading main script...');
              
              // Load main search panel script
              var script = document.createElement('script');
              script.src = 'https://rd-dev.onead.tw/test_demo/ericchiu/bookmarklet/searchPanel.js';
              script.onload = function() {
                console.log('查廣告543 載入成功！按 Shift+W 開啟面板');
                resolve({ loaded: true, panelReady: true });
              };
              script.onerror = function() {
                reject(new Error('載入 searchPanel.js 失敗，請檢查網址是否正確'));
              };
              document.body.appendChild(script);
            };
            polyfill.onerror = function() {
              reject(new Error('載入 gm-polyfill.js 失敗，請檢查網址是否正確'));
            };
            document.body.appendChild(polyfill);
          });
        });
      })()
    `;
    }
    /**
     * Wait for AD543 to be fully loaded and ready
     */
    async waitForAD543Ready(sessionId, timeout = 30000) {
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            try {
                const isReady = await this.browserEngine.executeBrowserScript(sessionId, `
          return window.AD543Loaded === true && 
                 window.AD543_CSS_CACHE && 
                 (window.AD543_CSS_CACHE.IMPORTED_CSS || window.AD543_CSS_CACHE.IMPORTED_SV_CSS);
        `);
                if (isReady) {
                    LoggingService_1.logger.debug('AD543 is ready', { sessionId, waitTime: Date.now() - startTime });
                    return;
                }
                // Wait 500ms before checking again
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            catch (error) {
                LoggingService_1.logger.warn('Error checking AD543 readiness', { error, sessionId });
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        throw new Error(`AD543 not ready within ${timeout}ms timeout`);
    }
    /**
     * Trigger AD543 search panel with Shift+W keyboard shortcut
     */
    async triggerAD543Panel(sessionId) {
        try {
            LoggingService_1.logger.debug('Triggering AD543 panel with Shift+W', { sessionId });
            // Simulate Shift+W keypress to open the panel
            await this.browserEngine.executeBrowserScript(sessionId, `
        // Dispatch keydown event for Shift+W
        const event = new KeyboardEvent('keydown', {
          key: 'W',
          code: 'KeyW',
          shiftKey: true,
          bubbles: true,
          cancelable: true
        });
        
        document.dispatchEvent(event);
        
        // Also try on document.body and window
        document.body.dispatchEvent(event);
        window.dispatchEvent(event);
        
        return 'Panel trigger event dispatched';
      `);
            // Wait a moment for the panel to appear
            await new Promise(resolve => setTimeout(resolve, 1000));
            LoggingService_1.logger.debug('AD543 panel trigger completed', { sessionId });
        }
        catch (error) {
            LoggingService_1.logger.error('Failed to trigger AD543 panel', error, { sessionId });
            throw error;
        }
    }
    /**
     * Check if AD543 panel is currently visible
     */
    async isAD543PanelVisible(sessionId) {
        try {
            return await this.browserEngine.executeBrowserScript(sessionId, `
        // Check if dialog modal is open
        const shadowHost = document.querySelector('onead-ui');
        if (!shadowHost) return false;
        
        // We can't access closed shadow DOM, so check for modal backdrop or other indicators
        const dialogs = document.querySelectorAll('dialog');
        for (const dialog of dialogs) {
          if (dialog.id === 'onead-dialog777' && dialog.open) {
            return true;
          }
        }
        
        // Fallback: check if shadow host exists and is visible
        const style = window.getComputedStyle(shadowHost);
        return style.display !== 'none' && style.visibility !== 'hidden';
      `);
        }
        catch (error) {
            LoggingService_1.logger.error('Error checking AD543 panel visibility', error, { sessionId });
            return false;
        }
    }
    /**
     * Configure AD543 outstream ad settings
     */
    async configureAD543Outstream(sessionId, config) {
        try {
            LoggingService_1.logger.debug('Configuring AD543 outstream settings', { sessionId, config });
            await this.browserEngine.executeBrowserScript(sessionId, `
        // Wait for AD543 to be ready
        if (!window.AD543Loaded) {
          throw new Error('AD543 not loaded');
        }

        // Update GM storage with new config
        const adInfo = {
          sourceValue: '${config.source}',
          playmodeValue: '${config.playMode}',
          pid: '${config.pid}',
          uid: '${config.uid}'
        };

        // Save to GM storage (simulated)
        if (typeof GM_setValue === 'function') {
          GM_setValue('adInfo', JSON.stringify(adInfo));
        } else {
          // Fallback to sessionStorage if GM functions not available
          sessionStorage.setItem('AD543_adInfo', JSON.stringify(adInfo));
        }

        return { success: true, config: adInfo };
      `);
            return { success: true };
        }
        catch (error) {
            LoggingService_1.logger.error('Failed to configure AD543 outstream', error, { sessionId });
            return { success: false, error: error.message };
        }
    }
    /**
     * Configure AD543 instream video settings
     */
    async configureAD543Instream(sessionId, config) {
        try {
            LoggingService_1.logger.debug('Configuring AD543 instream settings', { sessionId, config });
            await this.browserEngine.executeBrowserScript(sessionId, `
        if (!window.AD543Loaded) {
          throw new Error('AD543 not loaded');
        }

        const svInfo = {
          playerValue: '${config.player === 'glia' ? '1' : '0'}',
          url: '${config.videoUrl}',
          link: '${config.clickUrl}'
        };

        if (typeof GM_setValue === 'function') {
          GM_setValue('svInfo', JSON.stringify(svInfo));
        } else {
          sessionStorage.setItem('AD543_svInfo', JSON.stringify(svInfo));
        }

        return { success: true, config: svInfo };
      `);
            return { success: true };
        }
        catch (error) {
            LoggingService_1.logger.error('Failed to configure AD543 instream', error, { sessionId });
            return { success: false, error: error.message };
        }
    }
    /**
     * Configure AD543 DV360 settings
     */
    async configureAD543DV360(sessionId, config) {
        try {
            LoggingService_1.logger.debug('Configuring AD543 DV360 settings', { sessionId, config });
            await this.browserEngine.executeBrowserScript(sessionId, `
        if (!window.AD543Loaded) {
          throw new Error('AD543 not loaded');
        }

        const dv360Info = {
          url: '${config.campaignUrl}',
          target: '${config.targetIframe}'
        };

        if (typeof GM_setValue === 'function') {
          GM_setValue('dv360Info', JSON.stringify(dv360Info));
        } else {
          sessionStorage.setItem('AD543_dv360Info', JSON.stringify(dv360Info));
        }

        return { success: true, config: dv360Info };
      `);
            return { success: true };
        }
        catch (error) {
            LoggingService_1.logger.error('Failed to configure AD543 DV360', error, { sessionId });
            return { success: false, error: error.message };
        }
    }
    /**
     * Execute AD543 ad injection (Shift+R functionality)
     */
    async executeAD543Injection(sessionId, targetSelector) {
        try {
            LoggingService_1.logger.debug('Executing AD543 ad injection', { sessionId, targetSelector });
            await this.browserEngine.executeBrowserScript(sessionId, `
        if (!window.AD543Loaded) {
          throw new Error('AD543 not loaded');
        }

        // Get current ad configuration
        let adInfo;
        try {
          adInfo = typeof GM_getValue === 'function' 
            ? JSON.parse(GM_getValue('adInfo') || '{}')
            : JSON.parse(sessionStorage.getItem('AD543_adInfo') || '{}');
        } catch (e) {
          throw new Error('No ad configuration found');
        }

        // Check if selector is required for this playmode
        const requiresSelector = ['MIR', 'TD', 'IP', 'IR'].includes(adInfo.playmodeValue);
        
        let targetElement;
        if (requiresSelector) {
          const selector = '${targetSelector}' || '.content-area';
          targetElement = document.querySelector(selector);
          if (!targetElement) {
            throw new Error('Target element not found: ' + selector);
          }
          targetElement.innerHTML = ''; // Clear existing content
        } else {
          targetElement = document.body;
        }

        // Execute the ad injection (simulate Shift+R)
        const event = new KeyboardEvent('keydown', {
          key: 'R',
          keyCode: 82,
          shiftKey: true,
          bubbles: true,
          cancelable: true
        });
        
        document.dispatchEvent(event);
        
        return { 
          success: true, 
          targetSelector: requiresSelector ? (targetSelector || '.content-area') : 'body',
          adConfig: adInfo
        };
      `);
            // Wait for ad injection to complete
            await new Promise(resolve => setTimeout(resolve, 3000));
            LoggingService_1.logger.debug('AD543 ad injection completed', { sessionId });
            return { success: true };
        }
        catch (error) {
            LoggingService_1.logger.error('Failed to execute AD543 injection', error, { sessionId });
            return { success: false, error: error.message };
        }
    }
    /**
     * Get current AD543 configuration
     */
    async getAD543Config(sessionId) {
        try {
            return await this.browserEngine.executeBrowserScript(sessionId, `
        if (!window.AD543Loaded) {
          return {};
        }

        const getStoredValue = (key) => {
          try {
            if (typeof GM_getValue === 'function') {
              return JSON.parse(GM_getValue(key) || '{}');
            } else {
              return JSON.parse(sessionStorage.getItem('AD543_' + key) || '{}');
            }
          } catch (e) {
            return {};
          }
        };

        return {
          outstream: getStoredValue('adInfo'),
          instream: getStoredValue('svInfo'),
          dv360: getStoredValue('dv360Info')
        };
      `);
        }
        catch (error) {
            LoggingService_1.logger.error('Failed to get AD543 config', error, { sessionId });
            return {};
        }
    }
    /**
     * Open AD543 panel programmatically
     */
    async openAD543Panel(sessionId, tab) {
        try {
            LoggingService_1.logger.debug('Opening AD543 panel', { sessionId, tab });
            await this.triggerAD543Panel(sessionId);
            // Switch to specific tab if requested
            if (tab) {
                await this.browserEngine.executeBrowserScript(sessionId, `
          // Wait a moment for panel to open
          setTimeout(() => {
            const shadowHost = document.querySelector('onead-ui');
            if (shadowHost && shadowHost.shadowRoot) {
              const tabElement = shadowHost.shadowRoot.querySelector('#${tab}-tab');
              if (tabElement) {
                tabElement.click();
              }
            }
          }, 500);
        `);
            }
            return { success: true };
        }
        catch (error) {
            LoggingService_1.logger.error('Failed to open AD543 panel', error, { sessionId });
            return { success: false, error: error.message };
        }
    }
    /**
     * Get predefined bookmarklet templates including AD543
     */
    getBookmarkletTemplates() {
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
            },
            {
                name: 'AD543 Company Tool',
                description: 'Company-specific ad injection and testing tool (查廣告543)',
                script: `
          // AD543 Advanced Integration Template
          const adType = getParam('adType', 'outstream'); // outstream, instream, dv360
          const source = getParam('source', 'staging'); // staging, onevision
          const playMode = getParam('playMode', 'MIR'); // MFS, MIR, Desktop, TD, IP, IR
          const pid = getParam('pid', '');
          const uid = getParam('uid', '');
          const selector = getParam('selector', '.content-area');
          const executeInjection = getParam('executeInjection', true);
          
          logMessage('AD543 Advanced Integration - Type: ' + adType);
          
          if (adType === 'outstream') {
            // Configure outstream ad
            logMessage('Configuring outstream ad: ' + playMode + ' (PID: ' + pid + ', UID: ' + uid + ')');
          } else if (adType === 'instream') {
            // Configure instream video
            const videoUrl = getParam('videoUrl', '');
            const clickUrl = getParam('clickUrl', '');
            const player = getParam('player', 'glia');
            logMessage('Configuring instream video: ' + player + ' player');
          } else if (adType === 'dv360') {
            // Configure DV360 campaign
            const campaignUrl = getParam('campaignUrl', '');
            const targetIframe = getParam('targetIframe', '');
            logMessage('Configuring DV360 campaign injection');
          }
          
          return {
            adType: adType,
            configuration: {
              source: source,
              playMode: playMode,
              pid: pid,
              uid: uid,
              selector: selector
            },
            executeInjection: executeInjection,
            message: 'Use specific AD543 methods for full automation control'
          };
        `,
                parameters: [
                    {
                        name: 'adType',
                        type: 'string',
                        required: false,
                        defaultValue: 'outstream',
                        description: 'Type of ad to configure: outstream, instream, or dv360'
                    },
                    {
                        name: 'source',
                        type: 'string',
                        required: false,
                        defaultValue: 'staging',
                        description: 'Ad source: staging or onevision'
                    },
                    {
                        name: 'playMode',
                        type: 'string',
                        required: false,
                        defaultValue: 'MIR',
                        description: 'Play mode: MFS, MIR, Desktop, TD, IP, IR'
                    },
                    {
                        name: 'pid',
                        type: 'string',
                        required: true,
                        description: 'Product ID for ad configuration'
                    },
                    {
                        name: 'uid',
                        type: 'string',
                        required: true,
                        description: 'User ID for ad configuration'
                    },
                    {
                        name: 'selector',
                        type: 'string',
                        required: false,
                        defaultValue: '.content-area',
                        description: 'CSS selector for ad injection target (required for MIR, TD, IP, IR)'
                    },
                    {
                        name: 'executeInjection',
                        type: 'boolean',
                        required: false,
                        defaultValue: true,
                        description: 'Whether to immediately execute ad injection after configuration'
                    }
                ]
            },
            {
                name: 'AD543 Outstream Injector',
                description: 'Inject OneAD outstream advertisements (MFS, MIR, Desktop, etc.)',
                script: `
          const source = getParam('source', 'staging');
          const playMode = getParam('playMode', 'MIR');
          const pid = getParam('pid');
          const uid = getParam('uid');
          const selector = getParam('selector', '.content-area');
          
          if (!pid || !uid) {
            throw new Error('PID and UID are required for AD543 outstream injection');
          }
          
          logMessage('Configuring AD543 outstream: ' + playMode + ' on ' + source);
          
          // This would be handled by the enhanced AD543 methods
          return {
            type: 'outstream',
            config: { source, playMode, pid, uid, selector },
            message: 'Use configureAD543Outstream() and executeAD543Injection() methods'
          };
        `,
                parameters: [
                    { name: 'source', type: 'string', required: false, defaultValue: 'staging', description: 'Ad source (staging/onevision)' },
                    { name: 'playMode', type: 'string', required: false, defaultValue: 'MIR', description: 'Play mode (MFS/MIR/Desktop/TD/IP/IR)' },
                    { name: 'pid', type: 'string', required: true, description: 'Product ID' },
                    { name: 'uid', type: 'string', required: true, description: 'User ID' },
                    { name: 'selector', type: 'string', required: false, defaultValue: '.content-area', description: 'Target CSS selector' }
                ]
            },
            {
                name: 'AD543 Instream Video',
                description: 'Replace video players with AD543 Glia/Truvid players',
                script: `
          const player = getParam('player', 'glia');
          const videoUrl = getParam('videoUrl');
          const clickUrl = getParam('clickUrl');
          
          if (!videoUrl || !clickUrl) {
            throw new Error('Video URL and click URL are required for instream injection');
          }
          
          logMessage('Configuring AD543 instream: ' + player + ' player');
          
          return {
            type: 'instream',
            config: { player, videoUrl, clickUrl },
            message: 'Use configureAD543Instream() method for instream video injection'
          };
        `,
                parameters: [
                    { name: 'player', type: 'string', required: false, defaultValue: 'glia', description: 'Player type (glia/truvid)' },
                    { name: 'videoUrl', type: 'string', required: true, description: 'Video source URL' },
                    { name: 'clickUrl', type: 'string', required: true, description: 'Click-through URL' }
                ]
            },
            {
                name: 'AD543 DV360 Campaign',
                description: 'Inject Display & Video 360 campaigns into iframes',
                script: `
          const campaignUrl = getParam('campaignUrl');
          const targetIframe = getParam('targetIframe');
          
          if (!campaignUrl || !targetIframe) {
            throw new Error('Campaign URL and target iframe are required for DV360 injection');
          }
          
          logMessage('Configuring AD543 DV360 campaign injection');
          
          return {
            type: 'dv360',
            config: { campaignUrl, targetIframe },
            message: 'Use configureAD543DV360() method for DV360 campaign injection'
          };
        `,
                parameters: [
                    { name: 'campaignUrl', type: 'string', required: true, description: 'DV360 campaign URL' },
                    { name: 'targetIframe', type: 'string', required: true, description: 'Target iframe CSS selector' }
                ]
            }
        ];
    }
    /**
     * Create bookmarklet configuration from template
     */
    createConfigFromTemplate(templateName, parameters = {}, options = {}) {
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
    validateConfig(config) {
        const errors = [];
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
    async executeWithRetry(sessionId, config, maxRetries = 3, retryDelay = 1000) {
        let lastError = null;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const result = await this.executeBookmarklet(sessionId, config);
                if (result.success) {
                    if (attempt > 1) {
                        LoggingService_1.logger.info('Bookmarklet succeeded on retry', {
                            sessionId,
                            attempt,
                            totalAttempts: maxRetries,
                        });
                    }
                    return result;
                }
                lastError = new Error(result.error || 'Unknown error');
            }
            catch (error) {
                lastError = error;
            }
            if (attempt < maxRetries) {
                LoggingService_1.logger.warn('Bookmarklet failed, retrying', {
                    sessionId,
                    attempt,
                    totalAttempts: maxRetries,
                    error: lastError?.message,
                });
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
        LoggingService_1.logger.error('Bookmarklet failed after all retries', lastError, {
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
exports.BookmarkletExecutor = BookmarkletExecutor;
//# sourceMappingURL=BookmarkletExecutor.js.map