/**
 * Content script for Ad Screenshot Automation Helper Chrome Extension
 */

// Configuration
const BRIDGE_URL = 'ws://localhost:9222/extension-bridge';
const RECONNECT_INTERVAL = 5000;

// State
let websocket = null;
let reconnectTimer = null;
let isConnected = false;

// Initialize when content script loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

function initialize() {
  console.log('Ad Automation Helper: Initializing...');
  connectToAutomationBridge();
  setupMessageListeners();
  injectOverlayStyles();
}

/**
 * Connect to the automation bridge WebSocket server
 */
function connectToAutomationBridge() {
  try {
    websocket = new WebSocket(BRIDGE_URL);
    
    websocket.onopen = function() {
      isConnected = true;
      console.log('Ad Automation Helper: Connected to automation bridge');
      
      // Clear reconnect timer
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      
      // Send initial status
      sendMessage('status_update', {
        status: 'connected',
        url: window.location.href,
        title: document.title,
        timestamp: new Date().toISOString()
      });
    };
    
    websocket.onmessage = function(event) {
      try {
        const message = JSON.parse(event.data);
        handleAutomationCommand(message);
      } catch (error) {
        console.error('Ad Automation Helper: Failed to parse message:', error);
      }
    };
    
    websocket.onclose = function() {
      isConnected = false;
      console.log('Ad Automation Helper: Disconnected from automation bridge');
      
      // Attempt to reconnect
      reconnectTimer = setTimeout(connectToAutomationBridge, RECONNECT_INTERVAL);
    };
    
    websocket.onerror = function(error) {
      console.error('Ad Automation Helper: WebSocket error:', error);
    };
    
  } catch (error) {
    console.error('Ad Automation Helper: Failed to connect:', error);
    reconnectTimer = setTimeout(connectToAutomationBridge, RECONNECT_INTERVAL);
  }
}

/**
 * Handle commands from the automation system
 */
function handleAutomationCommand(message) {
  if (message.type !== 'command') return;
  
  const command = message.data;
  console.log('Ad Automation Helper: Received command:', command.type);
  
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
    default:
      console.warn('Ad Automation Helper: Unknown command type:', command.type);
  }
}

/**
 * Handle screenshot command
 */
function handleScreenshotCommand(command) {
  try {
    // For Chrome extensions, we can't directly take screenshots from content scripts
    // This would typically involve messaging the background script
    chrome.runtime.sendMessage({
      type: 'TAKE_SCREENSHOT',
      selector: command.target,
      options: command.options
    }, (response) => {
      sendMessage('screenshot_complete', {
        success: response?.success || false,
        selector: command.target,
        timestamp: new Date().toISOString(),
        error: response?.error
      });
    });
    
  } catch (error) {
    sendMessage('error_report', {
      type: 'screenshot_error',
      message: error.message,
      command: command
    });
  }
}

/**
 * Handle element highlighting command
 */
function handleHighlightCommand(command) {
  try {
    const elements = document.querySelectorAll(command.target);
    let highlightedCount = 0;
    
    elements.forEach((element, index) => {
      highlightElement(element, command.options);
      highlightedCount++;
    });
    
    sendMessage('element_highlighted', {
      selector: command.target,
      count: highlightedCount,
      options: command.options
    });
    
  } catch (error) {
    sendMessage('error_report', {
      type: 'highlight_error',
      message: error.message,
      command: command
    });
  }
}

/**
 * Handle overlay display command
 */
function handleOverlayCommand(command) {
  try {
    const overlay = createOverlay(command.data.content, command.options);
    
    // Auto-remove after duration
    if (command.options.duration) {
      setTimeout(() => {
        overlay.remove();
      }, command.options.duration);
    }
    
    sendMessage('overlay_displayed', {
      content: command.data.content,
      position: command.options.position
    });
    
  } catch (error) {
    sendMessage('error_report', {
      type: 'overlay_error',
      message: error.message,
      command: command
    });
  }
}

/**
 * Handle data extraction command
 */
function handleDataExtractionCommand(command) {
  try {
    const results = [];
    
    command.data.selectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      
      elements.forEach((element, index) => {
        const elementData = {
          selector: selector,
          index: index,
          text: element.textContent?.trim() || '',
          html: element.innerHTML,
          tagName: element.tagName.toLowerCase(),
          attributes: {},
          boundingRect: element.getBoundingClientRect(),
          isVisible: isElementVisible(element)
        };
        
        // Extract attributes
        Array.from(element.attributes).forEach(attr => {
          elementData.attributes[attr.name] = attr.value;
        });
        
        // Include metadata if requested
        if (command.options?.includeMetadata) {
          elementData.computedStyle = getComputedStyleData(element);
          elementData.children = element.children.length;
          elementData.parent = element.parentElement?.tagName.toLowerCase();
        }
        
        results.push(elementData);
      });
    });
    
    sendMessage('data_extracted', {
      elements: results,
      timestamp: new Date().toISOString(),
      url: window.location.href
    });
    
  } catch (error) {
    sendMessage('error_report', {
      type: 'extraction_error',
      message: error.message,
      command: command
    });
  }
}

/**
 * Highlight an element with visual indicators
 */
function highlightElement(element, options = {}) {
  const color = options.color || '#ff0000';
  const duration = options.duration || 3000;
  
  // Store original styles
  const originalOutline = element.style.outline;
  const originalOutlineOffset = element.style.outlineOffset;
  const originalBackgroundColor = element.style.backgroundColor;
  
  // Apply highlight styles
  element.style.outline = `3px solid ${color}`;
  element.style.outlineOffset = '2px';
  element.style.backgroundColor = color + '20'; // 20% opacity
  
  // Add highlight class for potential CSS styling
  element.classList.add('automation-highlighted');
  
  // Remove highlight after duration
  setTimeout(() => {
    element.style.outline = originalOutline;
    element.style.outlineOffset = originalOutlineOffset;
    element.style.backgroundColor = originalBackgroundColor;
    element.classList.remove('automation-highlighted');
  }, duration);
}

/**
 * Create overlay element
 */
function createOverlay(content, options = {}) {
  const overlay = document.createElement('div');
  overlay.className = 'automation-overlay';
  overlay.innerHTML = content;
  
  // Position overlay
  const position = options.position || 'top-right';
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
    padding: '12px 16px',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    color: 'white',
    borderRadius: '6px',
    fontSize: '14px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    maxWidth: '350px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    ...positions[position]
  });
  
  document.body.appendChild(overlay);
  
  // Add close button
  const closeButton = document.createElement('button');
  closeButton.innerHTML = '×';
  closeButton.style.cssText = `
    position: absolute;
    top: 4px;
    right: 8px;
    background: none;
    border: none;
    color: white;
    font-size: 18px;
    cursor: pointer;
    padding: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  
  closeButton.onclick = () => overlay.remove();
  overlay.appendChild(closeButton);
  
  return overlay;
}

/**
 * Check if element is visible
 */
function isElementVisible(element) {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  
  return rect.width > 0 && 
         rect.height > 0 && 
         style.visibility !== 'hidden' && 
         style.display !== 'none' &&
         parseFloat(style.opacity) > 0;
}

/**
 * Get relevant computed style data
 */
function getComputedStyleData(element) {
  const style = window.getComputedStyle(element);
  
  return {
    display: style.display,
    visibility: style.visibility,
    opacity: style.opacity,
    position: style.position,
    zIndex: style.zIndex,
    width: style.width,
    height: style.height
  };
}

/**
 * Send message to automation bridge
 */
function sendMessage(type, data) {
  if (websocket && websocket.readyState === WebSocket.OPEN) {
    const message = {
      type: type,
      payload: data,
      timestamp: new Date().toISOString()
    };
    
    websocket.send(JSON.stringify(message));
  } else {
    console.warn('Ad Automation Helper: Cannot send message - not connected');
  }
}

/**
 * Setup message listeners for extension communication
 */
function setupMessageListeners() {
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'PING':
        sendResponse({ status: 'connected', url: window.location.href });
        break;
        
      case 'GET_AD_ELEMENTS':
        const adElements = document.querySelectorAll(
          '.ad, .advertisement, [class*="ad-"], [id*="ad-"], .banner, .promo'
        );
        sendResponse({ 
          count: adElements.length,
          elements: Array.from(adElements).map(el => ({
            tagName: el.tagName,
            className: el.className,
            id: el.id,
            text: el.textContent?.slice(0, 100)
          }))
        });
        break;
        
      default:
        sendResponse({ error: 'Unknown message type' });
    }
  });
}

/**
 * Inject overlay styles
 */
function injectOverlayStyles() {
  if (document.getElementById('automation-helper-styles')) return;
  
  const styles = document.createElement('style');
  styles.id = 'automation-helper-styles';
  styles.textContent = `
    .automation-highlighted {
      animation: automation-pulse 2s infinite;
    }
    
    @keyframes automation-pulse {
      0% { box-shadow: 0 0 0 0 rgba(255, 0, 0, 0.7); }
      70% { box-shadow: 0 0 0 10px rgba(255, 0, 0, 0); }
      100% { box-shadow: 0 0 0 0 rgba(255, 0, 0, 0); }
    }
    
    .automation-overlay {
      font-family: system-ui, -apple-system, sans-serif !important;
      line-height: 1.4 !important;
    }
    
    .automation-overlay * {
      box-sizing: border-box !important;
    }
  `;
  
  document.head.appendChild(styles);
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (websocket) {
    websocket.close();
  }
});

console.log('Ad Automation Helper: Content script loaded');