/**
 * Enhanced Screenshot Extension - Content Script
 * Monitors AD543 activity and communicates with automation system
 */

class AD543Monitor {
  constructor() {
    this.isAD543Loaded = false;
    this.isAD543PanelOpen = false;
    this.injectionCount = 0;
    this.setupMonitoring();
  }

  setupMonitoring() {
    // Monitor for AD543 loading
    this.checkForAD543();
    
    // Setup mutation observer to detect AD543 changes
    this.setupMutationObserver();
    
    // Monitor for AD543 keyboard shortcuts
    this.setupKeyboardMonitoring();
    
    // Listen for window messages from AD543
    this.setupMessageListener();
    
    // Periodic checks for AD543 state
    setInterval(() => this.checkAD543State(), 1000);
  }

  checkForAD543() {
    // Check if AD543 is loaded
    if (window.AD543Loaded) {
      this.handleAD543Loaded();
    }

    // Check for AD543 shadow DOM element
    const shadowHost = document.querySelector('onead-ui');
    if (shadowHost) {
      this.handleAD543ShadowDetected();
    }
  }

  setupMutationObserver() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        // Check for new nodes that might be AD543 related
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check for AD543 elements
            if (node.tagName === 'ONEAD-UI' || 
                node.querySelector && node.querySelector('onead-ui')) {
              this.handleAD543ShadowDetected();
            }

            // Check for OneAD containers (ad injection)
            if (node.id && node.id.includes('onead') ||
                node.className && node.className.includes('onead')) {
              this.handleAdInjectionDetected(node);
            }

            // Check for video players (Glia/Truvid)
            if (node.className && 
                (node.className.includes('gliaplayer') || 
                 node.className.includes('trv-player'))) {
              this.handleVideoPlayerDetected(node);
            }
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'id', 'style']
    });
  }

  setupKeyboardMonitoring() {
    document.addEventListener('keydown', (event) => {
      // Monitor for AD543 keyboard shortcuts
      if (event.shiftKey && event.keyCode === 87) { // Shift+W
        console.log('AD543 panel shortcut detected');
        setTimeout(() => this.checkForPanelOpen(), 100);
      }
      
      if (event.shiftKey && event.keyCode === 82) { // Shift+R
        console.log('AD543 injection shortcut detected');
        setTimeout(() => this.checkForNewInjections(), 500);
      }
    });
  }

  setupMessageListener() {
    window.addEventListener('message', (event) => {
      // Listen for messages from AD543 bookmarklet
      if (event.data && event.data.type === 'BOOKMARKLET_LOG') {
        console.log('AD543 Log:', event.data.data);
      }

      // Listen for other AD543 related messages
      if (event.data && event.data.source === 'AD543') {
        this.handleAD543Message(event.data);
      }
    });
  }

  handleAD543Loaded() {
    if (!this.isAD543Loaded) {
      this.isAD543Loaded = true;
      console.log('AD543 system detected as loaded');
      
      // Notify background script
      chrome.runtime.sendMessage({
        source: 'content',
        type: 'AD543_LOADED',
        url: window.location.href,
        timestamp: Date.now()
      });
    }
  }

  handleAD543ShadowDetected() {
    console.log('AD543 shadow DOM element detected');
    this.handleAD543Loaded();
  }

  handleAD543Message(data) {
    console.log('AD543 message received:', data);
    
    switch (data.type) {
      case 'PANEL_OPENED':
        this.handlePanelOpened();
        break;
      case 'INJECTION_COMPLETE':
        this.handleInjectionComplete(data.details);
        break;
      case 'CONFIG_UPDATED':
        this.handleConfigUpdated(data.config);
        break;
    }
  }

  checkForPanelOpen() {
    // Check if AD543 panel is open
    const shadowHost = document.querySelector('onead-ui');
    if (shadowHost) {
      // We can't access closed shadow DOM, but can check for modal indicators
      const dialogs = document.querySelectorAll('dialog[id*="onead"]');
      const isOpen = Array.from(dialogs).some(dialog => dialog.open);
      
      if (isOpen && !this.isAD543PanelOpen) {
        this.handlePanelOpened();
      } else if (!isOpen && this.isAD543PanelOpen) {
        this.handlePanelClosed();
      }
    }
  }

  handlePanelOpened() {
    this.isAD543PanelOpen = true;
    console.log('AD543 panel opened');
    
    chrome.runtime.sendMessage({
      source: 'content',
      type: 'AD543_PANEL_OPENED',
      url: window.location.href,
      timestamp: Date.now()
    });
  }

  handlePanelClosed() {
    this.isAD543PanelOpen = false;
    console.log('AD543 panel closed');
  }

  checkForNewInjections() {
    // Look for newly injected ad content
    const oneadElements = document.querySelectorAll('[id*="onead"], [class*="onead"]');
    const currentCount = oneadElements.length;
    
    if (currentCount > this.injectionCount) {
      this.injectionCount = currentCount;
      this.handleAdInjectionDetected();
    }
  }

  handleAdInjectionDetected(element = null) {
    console.log('Ad injection detected:', element);
    
    const injectionData = {
      elementCount: document.querySelectorAll('[id*="onead"], [class*="onead"]').length,
      hasVideo: !!document.querySelector('video'),
      hasIframe: !!document.querySelector('iframe[src*="doubleclick"]'),
      element: element ? {
        tagName: element.tagName,
        id: element.id,
        className: element.className
      } : null
    };

    chrome.runtime.sendMessage({
      source: 'content',
      type: 'AD543_INJECTION_COMPLETE',
      data: injectionData,
      url: window.location.href,
      timestamp: Date.now()
    });
  }

  handleVideoPlayerDetected(element) {
    console.log('Video player detected:', element);
    
    const playerData = {
      type: element.className.includes('gliaplayer') ? 'glia' : 'truvid',
      hasVideo: !!element.querySelector('video'),
      hasControls: !!element.querySelector('[id*="control"]')
    };

    chrome.runtime.sendMessage({
      source: 'content',
      type: 'VIDEO_PLAYER_DETECTED',
      data: playerData,
      url: window.location.href,
      timestamp: Date.now()
    });
  }

  checkAD543State() {
    // Periodic state check
    if (window.AD543Loaded && !this.isAD543Loaded) {
      this.handleAD543Loaded();
    }
  }

  // Public API for automation system
  getAD543Status() {
    return {
      loaded: this.isAD543Loaded,
      panelOpen: this.isAD543PanelOpen,
      injectionCount: this.injectionCount,
      hasAd: document.querySelectorAll('[id*="onead"], [class*="onead"]').length > 0,
      hasVideo: !!document.querySelector('video'),
      shadowHost: !!document.querySelector('onead-ui')
    };
  }

  // Trigger screenshot capture
  async triggerScreenshotCapture(options = {}) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'captureWithMobileUI',
        options: {
          deviceType: options.deviceType || 'ios',
          time: options.time,
          url: options.url || window.location.host,
          ...options
        }
      }, (response) => {
        if (response && response.success) {
          resolve(response.data);
        } else {
          reject(new Error(response?.error || 'Screenshot capture failed'));
        }
      });
    });
  }
}

// Initialize AD543 monitor
const ad543Monitor = new AD543Monitor();

// Expose to global scope for automation access
window.AD543Monitor = ad543Monitor;

// Inject automation API for external access
window.automationAPI = {
  getAD543Status: () => ad543Monitor.getAD543Status(),
  triggerScreenshot: (options) => ad543Monitor.triggerScreenshotCapture(options),
  isAD543Ready: () => ad543Monitor.isAD543Loaded
};

console.log('Enhanced Screenshot Extension - Content Script Loaded');