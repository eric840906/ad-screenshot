/**
 * Background script for Ad Screenshot Automation Helper Chrome Extension
 */

// Configuration
const AUTOMATION_BRIDGE_URL = 'http://localhost:9222';

// State
let automationConnected = false;

// Initialize when extension loads
chrome.runtime.onStartup.addListener(initialize);
chrome.runtime.onInstalled.addListener(initialize);

function initialize() {
  console.log('Ad Automation Helper: Background script initialized');
  checkAutomationBridge();
  
  // Set up periodic connection check
  setInterval(checkAutomationBridge, 30000); // Check every 30 seconds
}

/**
 * Check if automation bridge is available
 */
async function checkAutomationBridge() {
  try {
    const response = await fetch(`${AUTOMATION_BRIDGE_URL}/health`);
    const data = await response.json();
    
    automationConnected = data.status === 'healthy';
    
    // Update extension badge
    chrome.action.setBadgeText({
      text: automationConnected ? '●' : '○'
    });
    
    chrome.action.setBadgeBackgroundColor({
      color: automationConnected ? '#00ff00' : '#ff0000'
    });
    
  } catch (error) {
    automationConnected = false;
    chrome.action.setBadgeText({ text: '○' });
    chrome.action.setBadgeBackgroundColor({ color: '#ff0000' });
  }
}

/**
 * Handle messages from content scripts
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'TAKE_SCREENSHOT':
      handleScreenshotRequest(message, sender, sendResponse);
      return true; // Keep message channel open for async response
      
    case 'GET_AUTOMATION_STATUS':
      sendResponse({ connected: automationConnected });
      break;
      
    case 'SEND_TO_AUTOMATION':
      sendToAutomationBridge(message.data)
        .then(result => sendResponse({ success: true, data: result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Keep message channel open for async response
      
    default:
      sendResponse({ error: 'Unknown message type' });
  }
});

/**
 * Handle screenshot request from content script
 */
async function handleScreenshotRequest(message, sender, sendResponse) {
  try {
    if (!sender.tab) {
      throw new Error('No tab information available');
    }
    
    // Capture visible tab
    const screenshotUrl = await chrome.tabs.captureVisibleTab(
      sender.tab.windowId,
      { format: 'png', quality: 90 }
    );
    
    // If a specific selector was requested, we'd need to crop the image
    // For now, just return the full screenshot
    
    sendResponse({
      success: true,
      screenshotUrl: screenshotUrl,
      selector: message.selector,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Screenshot capture failed:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Send data to automation bridge
 */
async function sendToAutomationBridge(data) {
  if (!automationConnected) {
    throw new Error('Automation bridge not connected');
  }
  
  try {
    const response = await fetch(`${AUTOMATION_BRIDGE_URL}/send-command`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to send to automation bridge:', error);
    throw error;
  }
}

/**
 * Handle extension icon click
 */
chrome.action.onClicked.addListener((tab) => {
  // Open popup or perform action
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: showQuickActions
  });
});

/**
 * Quick actions function injected into page
 */
function showQuickActions() {
  // Check if overlay already exists
  if (document.getElementById('automation-quick-actions')) {
    document.getElementById('automation-quick-actions').remove();
    return;
  }
  
  const overlay = document.createElement('div');
  overlay.id = 'automation-quick-actions';
  overlay.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 999999;
      background: white;
      border: 2px solid #007cba;
      border-radius: 8px;
      padding: 16px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      font-family: system-ui, sans-serif;
      font-size: 14px;
      min-width: 250px;
    ">
      <div style="
        font-weight: bold;
        margin-bottom: 12px;
        color: #007cba;
        display: flex;
        justify-content: space-between;
        align-items: center;
      ">
        Ad Automation Helper
        <button onclick="this.closest('#automation-quick-actions').remove()" style="
          background: none;
          border: none;
          font-size: 18px;
          cursor: pointer;
          color: #666;
        ">×</button>
      </div>
      
      <button onclick="highlightAds()" style="
        width: 100%;
        padding: 8px 12px;
        margin: 4px 0;
        background: #007cba;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      ">Highlight Ad Elements</button>
      
      <button onclick="countAds()" style="
        width: 100%;
        padding: 8px 12px;
        margin: 4px 0;
        background: #28a745;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      ">Count Ad Elements</button>
      
      <button onclick="extractAdData()" style="
        width: 100%;
        padding: 8px 12px;
        margin: 4px 0;
        background: #ffc107;
        color: black;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      ">Extract Ad Data</button>
      
      <div id="action-results" style="
        margin-top: 12px;
        padding: 8px;
        background: #f8f9fa;
        border-radius: 4px;
        font-size: 12px;
        display: none;
      "></div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // Add action functions to global scope
  window.highlightAds = function() {
    const ads = document.querySelectorAll('.ad, .advertisement, [class*="ad-"], [id*="ad-"], .banner, .promo');
    ads.forEach((ad, index) => {
      ad.style.outline = '3px solid #ff0000';
      ad.style.outlineOffset = '2px';
      
      // Add number label
      const label = document.createElement('div');
      label.textContent = index + 1;
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
      ad.style.position = 'relative';
      ad.appendChild(label);
    });
    
    showResult(`Highlighted ${ads.length} ad elements`);
  };
  
  window.countAds = function() {
    const selectors = [
      '.ad', '.advertisement', '[class*="ad-"]', '[id*="ad-"]',
      '.banner', '.promo', '.sponsored'
    ];
    
    let totalCount = 0;
    const results = [];
    
    selectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        totalCount += elements.length;
        results.push(`${selector}: ${elements.length}`);
      }
    });
    
    const resultText = `Total: ${totalCount} ad elements<br>` + results.join('<br>');
    showResult(resultText);
  };
  
  window.extractAdData = function() {
    const ads = document.querySelectorAll('.ad, .advertisement, [class*="ad-"], [id*="ad-"]');
    const data = Array.from(ads).map((ad, index) => ({
      index: index + 1,
      tagName: ad.tagName,
      id: ad.id,
      className: ad.className,
      text: ad.textContent?.slice(0, 50) + '...',
      href: ad.querySelector('a')?.href || null
    }));
    
    console.log('Extracted ad data:', data);
    showResult(`Extracted data from ${data.length} ads (see console)`);
  };
  
  window.showResult = function(message) {
    const resultsDiv = document.getElementById('action-results');
    resultsDiv.innerHTML = message;
    resultsDiv.style.display = 'block';
    
    setTimeout(() => {
      resultsDiv.style.display = 'none';
    }, 5000);
  };
}

/**
 * Handle tab updates to inject content script if needed
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Check if we should inject content script
    if (tab.url.startsWith('http')) {
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      }).catch(() => {
        // Content script might already be injected
      });
    }
  }
});

/**
 * Handle extension context menu
 */
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'highlight-ads',
    title: 'Highlight Ad Elements',
    contexts: ['page']
  });
  
  chrome.contextMenus.create({
    id: 'extract-ad-data',
    title: 'Extract Ad Data',
    contexts: ['page']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  switch (info.menuItemId) {
    case 'highlight-ads':
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: highlightAdsFromContext
      });
      break;
      
    case 'extract-ad-data':
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: extractAdDataFromContext
      });
      break;
  }
});

function highlightAdsFromContext() {
  const ads = document.querySelectorAll('.ad, .advertisement, [class*="ad-"], [id*="ad-"]');
  ads.forEach(ad => {
    ad.style.outline = '3px solid #ff0000';
    ad.style.outlineOffset = '2px';
  });
  
  if (ads.length > 0) {
    alert(`Highlighted ${ads.length} ad elements`);
  } else {
    alert('No ad elements found');
  }
}

function extractAdDataFromContext() {
  const ads = document.querySelectorAll('.ad, .advertisement, [class*="ad-"], [id*="ad-"]');
  const data = Array.from(ads).map(ad => ({
    text: ad.textContent?.slice(0, 100),
    className: ad.className,
    id: ad.id
  }));
  
  console.log('Ad data:', data);
  alert(`Extracted data from ${data.length} ads (check console)`);
}

console.log('Ad Automation Helper: Background script loaded');