/**
 * Popup script for Ad Screenshot Automation Helper Chrome Extension
 */

// DOM elements
const connectionStatus = document.getElementById('connection-status');
const highlightButton = document.getElementById('highlight-ads');
const countButton = document.getElementById('count-ads');
const extractButton = document.getElementById('extract-data');
const screenshotButton = document.getElementById('take-screenshot');
const checkBridgeButton = document.getElementById('check-bridge');
const testCommandButton = document.getElementById('send-test-command');
const resultArea = document.getElementById('result-area');
const adCountStat = document.getElementById('ad-count');
const totalElementsStat = document.getElementById('total-elements');

// State
let currentTab = null;
let automationConnected = false;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tab;
    
    // Check automation bridge status
    await checkAutomationBridge();
    
    // Get page statistics
    await updatePageStats();
    
    // Setup event listeners
    setupEventListeners();
    
  } catch (error) {
    showResult('Error initializing popup: ' + error.message, 'error');
  }
});

/**
 * Setup event listeners for buttons
 */
function setupEventListeners() {
  highlightButton.addEventListener('click', highlightAdElements);
  countButton.addEventListener('click', countAdElements);
  extractButton.addEventListener('click', extractAdData);
  screenshotButton.addEventListener('click', takeScreenshot);
  checkBridgeButton.addEventListener('click', checkAutomationBridge);
  testCommandButton.addEventListener('click', sendTestCommand);
}

/**
 * Check automation bridge connection status
 */
async function checkAutomationBridge() {
  try {
    setLoading(true);
    
    const response = await chrome.runtime.sendMessage({
      type: 'GET_AUTOMATION_STATUS'
    });
    
    automationConnected = response.connected;
    
    updateConnectionStatus();
    updateButtonStates();
    
    showResult(
      automationConnected 
        ? 'Automation bridge connected successfully' 
        : 'Automation bridge not available',
      automationConnected ? 'success' : 'warning'
    );
    
  } catch (error) {
    automationConnected = false;
    updateConnectionStatus();
    showResult('Failed to check automation bridge: ' + error.message, 'error');
  } finally {
    setLoading(false);
  }
}

/**
 * Update connection status display
 */
function updateConnectionStatus() {
  if (automationConnected) {
    connectionStatus.textContent = 'Connected to Automation Bridge';
    connectionStatus.className = 'status connected';
  } else {
    connectionStatus.textContent = 'Automation Bridge Disconnected';
    connectionStatus.className = 'status disconnected';
  }
}

/**
 * Update button states based on connection
 */
function updateButtonStates() {
  testCommandButton.disabled = !automationConnected;
  
  if (!automationConnected) {
    testCommandButton.textContent = 'Bridge Disconnected';
  } else {
    testCommandButton.textContent = 'Send Test Command';
  }
}

/**
 * Highlight ad elements on the page
 */
async function highlightAdElements() {
  try {
    setLoading(true);
    
    const result = await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      function: () => {
        const selectors = [
          '.ad', '.advertisement', '[class*="ad-"]', '[id*="ad-"]',
          '.banner', '.promo', '.sponsored'
        ];
        
        let totalHighlighted = 0;
        
        selectors.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          elements.forEach((element, index) => {
            element.style.outline = '3px solid #ff0000';
            element.style.outlineOffset = '2px';
            element.style.backgroundColor = '#ff000020';
            
            // Add number label
            const label = document.createElement('div');
            label.textContent = totalHighlighted + 1;
            label.style.cssText = `
              position: absolute;
              top: -25px;
              left: 0;
              background: #ff0000;
              color: white;
              padding: 2px 6px;
              font-size: 12px;
              font-weight: bold;
              border-radius: 3px;
              z-index: 999999;
            `;
            element.style.position = 'relative';
            element.appendChild(label);
            
            totalHighlighted++;
          });
        });
        
        return { highlighted: totalHighlighted };
      }
    });
    
    const highlighted = result[0].result.highlighted;
    showResult(`Highlighted ${highlighted} ad elements`, 'success');
    
    // Update stats
    adCountStat.textContent = highlighted;
    
  } catch (error) {
    showResult('Failed to highlight elements: ' + error.message, 'error');
  } finally {
    setLoading(false);
  }
}

/**
 * Count ad elements on the page
 */
async function countAdElements() {
  try {
    setLoading(true);
    
    const result = await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      function: () => {
        const selectors = [
          '.ad', '.advertisement', '[class*="ad-"]', '[id*="ad-"]',
          '.banner', '.promo', '.sponsored'
        ];
        
        const counts = {};
        let totalCount = 0;
        
        selectors.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            counts[selector] = elements.length;
            totalCount += elements.length;
          }
        });
        
        return { counts, totalCount };
      }
    });
    
    const { counts, totalCount } = result[0].result;
    
    let resultText = `Total ad elements: ${totalCount}<br>`;
    Object.entries(counts).forEach(([selector, count]) => {
      resultText += `${selector}: ${count}<br>`;
    });
    
    showResult(resultText, 'info');
    adCountStat.textContent = totalCount;
    
  } catch (error) {
    showResult('Failed to count elements: ' + error.message, 'error');
  } finally {
    setLoading(false);
  }
}

/**
 * Extract ad data from the page
 */
async function extractAdData() {
  try {
    setLoading(true);
    
    const result = await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      function: () => {
        const ads = document.querySelectorAll('.ad, .advertisement, [class*="ad-"], [id*="ad-"]');
        const data = Array.from(ads).map((ad, index) => {
          const rect = ad.getBoundingClientRect();
          return {
            index: index + 1,
            tagName: ad.tagName,
            id: ad.id,
            className: ad.className,
            text: ad.textContent?.slice(0, 100),
            href: ad.querySelector('a')?.href || null,
            visible: rect.width > 0 && rect.height > 0,
            position: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height)
            }
          };
        });
        
        console.log('Extracted ad data:', data);
        return { data, count: data.length };
      }
    });
    
    const { data, count } = result[0].result;
    
    showResult(
      `Extracted data from ${count} ads.<br>` +
      `Data logged to console.<br>` +
      `Visible ads: ${data.filter(ad => ad.visible).length}`,
      'success'
    );
    
    // If automation bridge is connected, send the data
    if (automationConnected) {
      try {
        await chrome.runtime.sendMessage({
          type: 'SEND_TO_AUTOMATION',
          data: {
            type: 'extract_data',
            results: data,
            url: currentTab.url,
            timestamp: new Date().toISOString()
          }
        });
        
        showResult('Data extracted and sent to automation bridge', 'success');
      } catch (error) {
        showResult('Data extracted but failed to send to bridge: ' + error.message, 'warning');
      }
    }
    
  } catch (error) {
    showResult('Failed to extract data: ' + error.message, 'error');
  } finally {
    setLoading(false);
  }
}

/**
 * Take screenshot of the page
 */
async function takeScreenshot() {
  try {
    setLoading(true);
    
    const response = await chrome.runtime.sendMessage({
      type: 'TAKE_SCREENSHOT',
      options: { format: 'png', quality: 90 }
    });
    
    if (response.success) {
      showResult('Screenshot captured successfully', 'success');
      
      // If automation bridge is connected, send notification
      if (automationConnected) {
        await chrome.runtime.sendMessage({
          type: 'SEND_TO_AUTOMATION',
          data: {
            type: 'screenshot_complete',
            url: currentTab.url,
            timestamp: response.timestamp
          }
        });
      }
      
    } else {
      showResult('Failed to capture screenshot: ' + response.error, 'error');
    }
    
  } catch (error) {
    showResult('Screenshot error: ' + error.message, 'error');
  } finally {
    setLoading(false);
  }
}

/**
 * Send test command to automation bridge
 */
async function sendTestCommand() {
  if (!automationConnected) {
    showResult('Automation bridge not connected', 'warning');
    return;
  }
  
  try {
    setLoading(true);
    
    const testCommand = {
      type: 'overlay',
      data: {
        content: 'Test message from Chrome Extension'
      },
      options: {
        position: 'top-right',
        duration: 3000
      }
    };
    
    const response = await chrome.runtime.sendMessage({
      type: 'SEND_TO_AUTOMATION',
      data: testCommand
    });
    
    if (response.success) {
      showResult('Test command sent successfully', 'success');
    } else {
      showResult('Failed to send test command: ' + response.error, 'error');
    }
    
  } catch (error) {
    showResult('Test command error: ' + error.message, 'error');
  } finally {
    setLoading(false);
  }
}

/**
 * Update page statistics
 */
async function updatePageStats() {
  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      function: () => {
        const adElements = document.querySelectorAll('.ad, .advertisement, [class*="ad-"], [id*="ad-"]');
        const totalElements = document.querySelectorAll('*').length;
        
        return {
          adCount: adElements.length,
          totalElements: totalElements
        };
      }
    });
    
    const { adCount, totalElements } = result[0].result;
    
    adCountStat.textContent = adCount;
    totalElementsStat.textContent = totalElements;
    
  } catch (error) {
    adCountStat.textContent = '?';
    totalElementsStat.textContent = '?';
  }
}

/**
 * Show result message
 */
function showResult(message, type = 'info') {
  resultArea.innerHTML = message;
  resultArea.className = 'result-area show';
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    resultArea.className = 'result-area';
  }, 5000);
}

/**
 * Set loading state
 */
function setLoading(loading) {
  document.body.className = loading ? 'loading' : '';
}