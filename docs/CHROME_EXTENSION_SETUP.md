# Chrome Extension Development Setup Guide

## Overview

This guide covers setting up the Chrome extension for enhanced ad screenshot automation. The extension provides additional capabilities like DOM manipulation, advanced element selection, and real-time communication with the automation system.

## Chrome Extension Architecture

### Components
1. **Manifest (v3)**: Extension configuration and permissions
2. **Background Script**: Service worker for persistent functionality
3. **Content Script**: Injected into web pages for DOM interaction
4. **Popup**: User interface for manual controls
5. **WebSocket Bridge**: Communication with automation system

### Features
- Enhanced element detection and selection
- Real-time page analysis
- Cookie and session management
- Advanced screenshot triggers
- Custom script injection

## Setup Instructions

### 1. Extension Structure
The extension files are located in:
```
/Users/ericchiu/playground/ad-screenshot/examples/chrome-extension-sample/
├── manifest.json          # Extension manifest
├── background.js          # Background service worker
├── content.js            # Content script
├── popup.html            # Extension popup UI
├── popup.js              # Popup functionality
├── icons/                # Extension icons
└── scripts/              # Additional scripts
```

### 2. Enable Developer Mode
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top-right corner
3. You should see options for "Load unpacked", "Pack extension", etc.

### 3. Load Extension for Development
```bash
# Navigate to the extension directory
cd /Users/ericchiu/playground/ad-screenshot/examples/chrome-extension-sample

# Load the extension in Chrome
# 1. Go to chrome://extensions/
# 2. Click "Load unpacked"
# 3. Select the chrome-extension-sample directory
```

### 4. Verify Extension Loading
1. Check that the extension appears in `chrome://extensions/`
2. Note the Extension ID (needed for configuration)
3. Verify the extension icon appears in Chrome toolbar
4. Test the popup by clicking the extension icon

### 5. Configure WebSocket Communication
Update your `.env` file with the extension ID:
```env
# Chrome Extension Configuration
EXTENSION_ID=your-extension-id-here
EXTENSION_PORT=9222
```

### 6. Set Up Extension Permissions
The extension requires these permissions (already configured in manifest.json):
```json
{
  "permissions": [
    "activeTab",
    "tabs",
    "storage",
    "webNavigation",
    "cookies",
    "scripting"
  ],
  "host_permissions": [
    "http://*/*",
    "https://*/*"
  ]
}
```

## Extension Development Workflow

### 1. Development Environment
```bash
# Create extension development workspace
mkdir -p /Users/ericchiu/playground/ad-screenshot/extension-dev
cd /Users/ericchiu/playground/ad-screenshot/extension-dev

# Copy sample extension for development
cp -r ../examples/chrome-extension-sample/* ./
```

### 2. Hot Reload Setup
For faster development, set up hot reload:

Create `reload-extension.js`:
```javascript
// Auto-reload extension during development
const reloadExtension = () => {
  chrome.runtime.reload();
};

// Watch for file changes (development only)
if (chrome.runtime.getManifest().name.includes('DEV')) {
  setInterval(() => {
    fetch(chrome.runtime.getURL('manifest.json'))
      .then(() => {
        // Check if files have changed
        // Reload extension if needed
      });
  }, 1000);
}
```

### 3. Extension Testing
Create test scripts for extension functionality:

#### Test WebSocket Communication
```javascript
// test-websocket.js
const testWebSocketConnection = async () => {
  try {
    const ws = new WebSocket('ws://localhost:9222');
    
    ws.onopen = () => {
      console.log('✅ WebSocket connected');
      ws.send(JSON.stringify({
        type: 'test',
        message: 'Extension connection test'
      }));
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('📩 Received:', data);
    };
    
    ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
    };
    
    return ws;
  } catch (error) {
    console.error('Connection failed:', error);
  }
};

testWebSocketConnection();
```

#### Test Content Script Injection
```javascript
// test-content-injection.js
const testContentScriptInjection = async () => {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });
  
  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // Test DOM manipulation
        const testElement = document.createElement('div');
        testElement.id = 'ad-screenshot-test';
        testElement.style.cssText = `
          position: fixed;
          top: 10px;
          right: 10px;
          background: green;
          color: white;
          padding: 10px;
          z-index: 9999;
        `;
        testElement.textContent = 'Extension Active';
        document.body.appendChild(testElement);
        
        // Remove after 3 seconds
        setTimeout(() => {
          testElement.remove();
        }, 3000);
        
        return 'Content script injected successfully';
      }
    });
    
    console.log('✅ Content injection result:', result);
  } catch (error) {
    console.error('❌ Content injection failed:', error);
  }
};
```

## Integration with Automation System

### 1. WebSocket Bridge Setup
Create a WebSocket server in your automation system:

```javascript
// websocket-bridge.js
const WebSocket = require('ws');

class ChromeExtensionBridge {
  constructor(port = 9222) {
    this.port = port;
    this.wss = null;
    this.connections = new Map();
  }

  start() {
    this.wss = new WebSocket.Server({ port: this.port });
    
    this.wss.on('connection', (ws, req) => {
      const connectionId = Date.now().toString();
      this.connections.set(connectionId, ws);
      
      console.log(`Extension connected: ${connectionId}`);
      
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          this.handleMessage(connectionId, data);
        } catch (error) {
          console.error('Invalid message:', error);
        }
      });
      
      ws.on('close', () => {
        this.connections.delete(connectionId);
        console.log(`Extension disconnected: ${connectionId}`);
      });
    });
    
    console.log(`WebSocket bridge started on port ${this.port}`);
  }

  handleMessage(connectionId, data) {
    console.log(`Message from ${connectionId}:`, data);
    
    switch (data.type) {
      case 'screenshot-request':
        this.handleScreenshotRequest(connectionId, data);
        break;
      case 'dom-analysis':
        this.handleDomAnalysis(connectionId, data);
        break;
      case 'element-selection':
        this.handleElementSelection(connectionId, data);
        break;
    }
  }

  sendMessage(connectionId, message) {
    const ws = this.connections.get(connectionId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  broadcast(message) {
    this.connections.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    });
  }
}

module.exports = ChromeExtensionBridge;
```

### 2. Enhanced Screenshot Capabilities
Integrate extension capabilities with Puppeteer:

```javascript
// enhanced-screenshot.js
class EnhancedScreenshotManager {
  constructor(extensionBridge) {
    this.extensionBridge = extensionBridge;
  }

  async captureWithExtension(url, options = {}) {
    // Launch Puppeteer with extension
    const browser = await puppeteer.launch({
      headless: false, // Must be false for extensions
      args: [
        `--disable-extensions-except=${options.extensionPath}`,
        `--load-extension=${options.extensionPath}`,
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    });

    const page = await browser.newPage();
    
    // Wait for extension to initialize
    await page.goto(url);
    await this.waitForExtensionReady(page);
    
    // Use extension for enhanced element detection
    const elements = await this.getAdsWithExtension(page);
    
    // Capture screenshots with extension assistance
    const screenshots = [];
    for (const element of elements) {
      const screenshot = await this.captureElementWithHighlight(page, element);
      screenshots.push(screenshot);
    }
    
    await browser.close();
    return screenshots;
  }

  async waitForExtensionReady(page) {
    await page.waitForFunction(() => {
      return window.adScreenshotExtensionReady === true;
    }, { timeout: 10000 });
  }

  async getAdsWithExtension(page) {
    return await page.evaluate(() => {
      // Use extension's enhanced ad detection
      if (window.adScreenshotExtension) {
        return window.adScreenshotExtension.detectAds();
      }
      return [];
    });
  }
}
```

## Extension Features Implementation

### 1. Advanced Ad Detection
Enhance the content script for better ad detection:

```javascript
// enhanced-content.js
class AdDetector {
  constructor() {
    this.adSelectors = [
      '[id*="ad"]',
      '[class*="ad"]',
      '[data-ad]',
      'iframe[src*="googlesyndication"]',
      '.advertisement',
      '.sponsored',
      '[data-testid*="ad"]'
    ];
  }

  detectAds() {
    const ads = [];
    
    // Use multiple detection methods
    ads.push(...this.detectBySelectors());
    ads.push(...this.detectBySize());
    ads.push(...this.detectByPosition());
    ads.push(...this.detectByContent());
    
    // Remove duplicates
    return this.deduplicateAds(ads);
  }

  detectBySelectors() {
    const elements = [];
    this.adSelectors.forEach(selector => {
      const found = document.querySelectorAll(selector);
      elements.push(...Array.from(found));
    });
    return elements;
  }

  detectBySize() {
    // Common ad sizes: 300x250, 728x90, 320x50, etc.
    const commonAdSizes = [
      { width: 300, height: 250 },
      { width: 728, height: 90 },
      { width: 320, height: 50 },
      { width: 160, height: 600 }
    ];

    const elements = [];
    document.querySelectorAll('div, iframe').forEach(el => {
      const rect = el.getBoundingClientRect();
      const matches = commonAdSizes.some(size => 
        Math.abs(rect.width - size.width) < 10 &&
        Math.abs(rect.height - size.height) < 10
      );
      if (matches) {
        elements.push(el);
      }
    });

    return elements;
  }

  detectByPosition() {
    // Ads are often positioned in specific areas
    const elements = [];
    document.querySelectorAll('div').forEach(el => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      
      // Check for common ad positions
      if (style.position === 'fixed' || style.position === 'absolute') {
        if (rect.top < 100 || rect.right < 100 || rect.bottom < 100) {
          elements.push(el);
        }
      }
    });
    
    return elements;
  }

  detectByContent() {
    // Look for ad-related text content
    const adKeywords = ['advertisement', 'sponsored', 'ad', 'promo'];
    const elements = [];
    
    document.querySelectorAll('*').forEach(el => {
      const text = el.textContent.toLowerCase();
      if (adKeywords.some(keyword => text.includes(keyword))) {
        elements.push(el);
      }
    });
    
    return elements;
  }

  deduplicateAds(ads) {
    const unique = [];
    const processed = new Set();
    
    ads.forEach(ad => {
      const key = `${ad.tagName}-${ad.getBoundingClientRect().x}-${ad.getBoundingClientRect().y}`;
      if (!processed.has(key)) {
        processed.add(key);
        unique.push({
          element: ad,
          rect: ad.getBoundingClientRect(),
          selector: this.generateSelector(ad)
        });
      }
    });
    
    return unique;
  }

  generateSelector(element) {
    // Generate unique CSS selector for element
    const path = [];
    let current = element;
    
    while (current.parentNode) {
      let selector = current.tagName.toLowerCase();
      
      if (current.id) {
        selector += `#${current.id}`;
        path.unshift(selector);
        break;
      }
      
      if (current.className) {
        selector += `.${current.className.split(' ').join('.')}`;
      }
      
      path.unshift(selector);
      current = current.parentNode;
    }
    
    return path.join(' > ');
  }
}

// Make available globally
window.adScreenshotExtension = new AdDetector();
window.adScreenshotExtensionReady = true;
```

### 2. Real-time Communication
Implement bidirectional communication:

```javascript
// popup.js - Extension popup
class ExtensionPopup {
  constructor() {
    this.ws = null;
    this.setupWebSocket();
    this.setupEventListeners();
  }

  setupWebSocket() {
    try {
      this.ws = new WebSocket('ws://localhost:9222');
      
      this.ws.onopen = () => {
        this.updateStatus('Connected', 'green');
        this.enableControls();
      };
      
      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      };
      
      this.ws.onclose = () => {
        this.updateStatus('Disconnected', 'red');
        this.disableControls();
      };
      
      this.ws.onerror = () => {
        this.updateStatus('Error', 'orange');
      };
    } catch (error) {
      this.updateStatus('Failed to connect', 'red');
    }
  }

  setupEventListeners() {
    document.getElementById('scan-ads').addEventListener('click', () => {
      this.scanCurrentPage();
    });
    
    document.getElementById('take-screenshot').addEventListener('click', () => {
      this.takeScreenshot();
    });
    
    document.getElementById('analyze-page').addEventListener('click', () => {
      this.analyzePage();
    });
  }

  async scanCurrentPage() {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        if (window.adScreenshotExtension) {
          return window.adScreenshotExtension.detectAds();
        }
        return [];
      }
    });

    const ads = results[0].result;
    this.displayResults(ads);
    
    // Send to automation system
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'ads-detected',
        url: tab.url,
        ads: ads.length,
        timestamp: new Date().toISOString()
      }));
    }
  }

  displayResults(ads) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = `
      <h3>Detected Ads: ${ads.length}</h3>
      <ul>
        ${ads.map((ad, i) => `
          <li>Ad ${i + 1}: ${ad.selector}</li>
        `).join('')}
      </ul>
    `;
  }

  updateStatus(text, color) {
    const status = document.getElementById('status');
    status.textContent = text;
    status.style.color = color;
  }

  enableControls() {
    document.querySelectorAll('button').forEach(btn => {
      btn.disabled = false;
    });
  }

  disableControls() {
    document.querySelectorAll('button').forEach(btn => {
      btn.disabled = true;
    });
  }
}

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  new ExtensionPopup();
});
```

## Testing and Debugging

### 1. Extension Console Debugging
```javascript
// Debug utilities for extension development
const ExtensionDebugger = {
  log: (message, data = null) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Extension:`, message, data);
  },

  testAdDetection: async () => {
    if (window.adScreenshotExtension) {
      const ads = window.adScreenshotExtension.detectAds();
      ExtensionDebugger.log('Ads detected', ads);
      return ads;
    }
    ExtensionDebugger.log('Ad detector not available');
    return [];
  },

  testWebSocketConnection: () => {
    const ws = new WebSocket('ws://localhost:9222');
    ws.onopen = () => ExtensionDebugger.log('WebSocket connected');
    ws.onclose = () => ExtensionDebugger.log('WebSocket closed');
    ws.onerror = (error) => ExtensionDebugger.log('WebSocket error', error);
    return ws;
  },

  highlightAds: (ads) => {
    ads.forEach((ad, index) => {
      if (ad.element) {
        ad.element.style.border = '3px solid red';
        ad.element.style.position = 'relative';
        
        const label = document.createElement('div');
        label.textContent = `Ad ${index + 1}`;
        label.style.cssText = `
          position: absolute;
          top: -25px;
          left: 0;
          background: red;
          color: white;
          padding: 2px 5px;
          font-size: 12px;
          z-index: 9999;
        `;
        ad.element.appendChild(label);
      }
    });
  }
};

// Make available globally for debugging
window.ExtensionDebugger = ExtensionDebugger;
```

### 2. Automated Testing
Create tests for extension functionality:

```javascript
// test-extension.js
const testExtension = async () => {
  console.log('🧪 Testing Chrome Extension...');
  
  // Test 1: Extension loading
  try {
    const response = await fetch(chrome.runtime.getURL('manifest.json'));
    const manifest = await response.json();
    console.log('✅ Extension loaded:', manifest.name);
  } catch (error) {
    console.error('❌ Extension loading failed:', error);
  }
  
  // Test 2: Content script injection
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });
    
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => !!window.adScreenshotExtension
    });
    
    if (result[0].result) {
      console.log('✅ Content script active');
    } else {
      console.error('❌ Content script not active');
    }
  } catch (error) {
    console.error('❌ Content script test failed:', error);
  }
  
  // Test 3: WebSocket connection
  try {
    const ws = new WebSocket('ws://localhost:9222');
    ws.onopen = () => {
      console.log('✅ WebSocket connection successful');
      ws.close();
    };
    ws.onerror = () => {
      console.error('❌ WebSocket connection failed');
    };
  } catch (error) {
    console.error('❌ WebSocket test failed:', error);
  }
};
```

## Production Deployment

### 1. Build Process
```bash
# Build extension for production
cd /Users/ericchiu/playground/ad-screenshot/extension-dev

# Minify scripts (optional)
npx terser background.js -o background.min.js
npx terser content.js -o content.min.js
npx terser popup.js -o popup.min.js

# Update manifest for production
# Remove development-specific permissions
# Update version numbers
```

### 2. Extension Packaging
```bash
# Create production build
mkdir -p ../extension-production
cp -r * ../extension-production/

# Remove development files
cd ../extension-production
rm -f *.md test-*.js debug-*.js

# Create packaged extension
cd ..
zip -r ad-screenshot-extension.zip extension-production/
```

This completes the Chrome extension setup. The extension provides enhanced capabilities for ad detection and screenshot automation integration.