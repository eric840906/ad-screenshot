/**
 * Enhanced Screenshot Extension - Main Popup Script
 * Enhanced with automation API support
 */

const currentTime = `${(new Date().getUTCHours() + 8) % 24}:${new Date().getUTCMinutes()}`
const captureBtn = document.getElementById('capture-btn')
const systemSelection = document.getElementById('system-selection')
const androidUi = document.getElementById('android-ui')
const iOSUi = document.getElementById('ios-ui')
const UiTime = document.querySelectorAll('.system-time')
const UiWebsite = document.querySelectorAll('.url-text')
const statusBars = document.querySelectorAll('.status-bar')
const timeInput = document.getElementById('ui-time')
timeInput.value = currentTime.length < 5 ? '0' + currentTime : currentTime
const iosStatusBar = document.querySelector('#ui-container #ios-ui .status-bar')
const iosNavBar = document.querySelector('#ui-container #ios-ui .nav-bar')
const androidStatusBar = document.querySelector('#ui-container #android-ui .status-bar')
const androidNavBar = document.querySelector('#ui-container #android-ui .nav-bar')
const btnContainer = document.querySelector('.btn-container')
const switchBtn = document.getElementById('switch-btn')
const smartphoneSetting = document.getElementById('smartphone-setting')
let selectedSystem
let statusBarHeight
let bottomBarHeight
let targetDevicePixelRatio
let targetWidth
let isRetina

// Automation state
let automationMode = false
let automationConfig = null

async function getNativeDevicePixelRatio() {
  try {
    // 創建新分頁
    const tab = await chrome.tabs.create({
      url: 'https://www.google.com/',
      active: false // 在背景開啟
    });

    // 等待分頁載入完成
    await new Promise(resolve => setTimeout(resolve, 200));

    // 獲取 devicePixelRatio
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.devicePixelRatio
    });

    // 關閉分頁
    await chrome.tabs.remove(tab.id);

    return results[0].result;
  } catch (error) {
    console.error('Error:', error);
    return 1;
  }
}

async function getTargetDevicePixelRatio() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.devicePixelRatio
    });
    return results[0].result || 1;
  } catch (error) {
    console.error('Error getting devicePixelRatio:', error);
    return 1;
  }
}

async function getTargetScreenWidth() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () =>  document.documentElement.clientWidth
    });
    return results[0].result;
  } catch (error) {
    console.error('Error getting screen width:', error);
    return 750; // 預設寬度
  }
}

const init = async() => {
  targetDevicePixelRatio = await getTargetDevicePixelRatio();
  targetWidth = await getTargetScreenWidth();
  isRetina = await getNativeDevicePixelRatio() > 1;
  console.log({ targetDevicePixelRatio, isRetina });
  
  // Check for automation configuration
  await checkAutomationConfig();
}

// Enhanced automation support
async function checkAutomationConfig() {
  try {
    const storage = await chrome.storage.local.get(['automationConfig', 'pendingConfig']);
    
    if (storage.automationConfig || storage.pendingConfig) {
      const config = storage.automationConfig || storage.pendingConfig;
      
      // Check if config is recent (within 30 seconds)
      if (Date.now() - config.timestamp < 30000) {
        automationMode = true;
        automationConfig = config;
        
        // Apply automation configuration
        await applyAutomationConfig(config);
        
        // Clear the config
        await chrome.storage.local.remove(['automationConfig', 'pendingConfig']);
      }
    }
  } catch (error) {
    console.error('Error checking automation config:', error);
  }
}

async function applyAutomationConfig(config) {
  console.log('Applying automation config:', config);
  
  // Set device type
  if (config.deviceType) {
    setSysyem(config.deviceType);
    systemSelection.value = config.deviceType;
  }
  
  // Set time
  if (config.time) {
    setTime(config.time);
    timeInput.value = config.time;
  }
  
  // Set URL
  if (config.url) {
    setURL(config.url);
  }
  
  // Add automation indicator
  addAutomationIndicator();
}

function addAutomationIndicator() {
  const indicator = document.createElement('div');
  indicator.id = 'automation-indicator';
  indicator.style.cssText = `
    position: absolute;
    top: 5px;
    right: 5px;
    background: #4CAF50;
    color: white;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: bold;
  `;
  indicator.textContent = 'AUTO';
  document.body.appendChild(indicator);
}

// Listen for automation messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateMobileUIConfig') {
    applyAutomationConfig(message.config);
    sendResponse({ success: true });
  }
  
  if (message.action === 'captureAutomated') {
    performAutomatedCapture(message.options).then(sendResponse);
    return true; // Indicates async response
  }
});

async function performAutomatedCapture(options = {}) {
  try {
    const deviceType = options.deviceType || selectedSystem || 'ios';
    
    // Configure if needed
    if (options.time) setTime(options.time);
    if (options.url) setURL(options.url);
    if (deviceType !== selectedSystem) setSysyem(deviceType);
    
    // Capture screenshot
    const result = await captureScreenshotAutomated(deviceType);
    
    return { success: true, data: result };
  } catch (error) {
    console.error('Automated capture failed:', error);
    return { success: false, error: error.message };
  }
}

chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
  statusBars.forEach((statusBar) => {
    statusBar.style.width = `${tabs[0].width}px`
  })
  console.log(statusBars)
  btnContainer.style.width = `${tabs[0].width}px`
  let url = tabs[0].url
  const host = new URL(url).host
  setURL(host)
})

const setURL = (url) => {
  UiWebsite.forEach((item) => (item.textContent = url))
}

const setTime = (timeStr) => {
  UiTime.forEach((item) => (item.textContent = timeStr))
}

const setSysyem = (systemStr) => {
  if (systemStr === 'ios') {
    androidUi.classList.add('d-none')
    iOSUi.classList.remove('d-none')
    selectedSystem = 'ios'
  } else {
    iOSUi.classList.add('d-none')
    androidUi.classList.remove('d-none')
    selectedSystem = 'android'
  }
}

const getElementImageURL = async (
  element,
  options = {
    scale: targetDevicePixelRatio,
    backgroundColor: '#ffffff'
  }
) => {
  const canvas = document.createElement('canvas');
  const width = parseInt(element.offsetWidth, 10);
  const height = parseInt(element.offsetHeight, 10);

  // 設置實際畫布大小，考慮 DPI 和縮放
  canvas.width = width * options.scale;
  canvas.height = height * options.scale;

  // 設置顯示大小
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext('2d');

  return new Promise((resolve) => {
    html2canvas(element, {
      canvas,
      scale: options.scale,
      backgroundColor: options.backgroundColor,
      useCORS: true,
      logging: false,
      width: width,
      height: height
    }).then((canvas) => {
      resolve(canvas.toDataURL());
    });
  });
};

document.addEventListener('DOMContentLoaded', () => {
  const defaultTime = timeInput.value
  setTime(defaultTime)
  setSysyem('ios')
})

systemSelection.addEventListener('change', ({ target: { value } }) => {
  setSysyem(value)
})

timeInput.addEventListener('input', ({ target: { value } }) => {
  setTime(value)
})

// Enhanced takeScreenshot with automation support
const takeScreenshot = async (returnAsDataURL = false) => {
  const TARGET_WIDTH =  isRetina ? targetWidth * 2 : targetWidth // retina 要*2
  let statusBarURL, navBarURL;
  const navbarOptions = {
    scale: targetDevicePixelRatio,
    backgroundColor: null,
  }
  
  if (selectedSystem === 'ios') {
    statusBarURL = await getElementImageURL(iosStatusBar)
    navBarURL = await getElementImageURL(iosNavBar, navbarOptions)
  } else {
    statusBarURL = await getElementImageURL(androidStatusBar)
    navBarURL = await getElementImageURL(androidNavBar, navbarOptions)
  }
  
  return new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, function (dataUrl) {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      
      const screenshotImg = new Image()
      screenshotImg.src = dataUrl
      const statusBarImg = new Image()
      statusBarImg.crossOrigin = 'anonymous'
      statusBarImg.src = statusBarURL
      const navbarImg = new Image()
      navbarImg.src = navBarURL
      
      navbarImg.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = targetDevicePixelRatio;
        const statusBarHeight = isRetina ? statusBarImg.height * 2 / scale : statusBarImg.height / scale
        
        // 設置 canvas 尺寸
        canvas.style.width =  `${TARGET_WIDTH}px`
        canvas.style.height = `${Math.round((screenshotImg.height + statusBarImg.height ))}px`
        canvas.width = TARGET_WIDTH * targetDevicePixelRatio;
        canvas.height = Math.round((screenshotImg.height+ statusBarHeight ) * targetDevicePixelRatio);
        
        const ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // 繪製狀態列
        ctx.drawImage(
          statusBarImg,
          0,
          0,
          screenshotImg.width,
          statusBarHeight,
        );

        // 繪製截圖
        ctx.drawImage(
          screenshotImg,
          0,
          statusBarHeight,
        );

        // 繪製導航列
        ctx.drawImage(
          navbarImg,
          0,
          statusBarHeight + screenshotImg.height - navbarImg.height*2,
          screenshotImg.width,
          navbarImg.height / scale
        );

        const finalDataURL = canvas.toDataURL('image/png');
        
        if (returnAsDataURL || automationMode) {
          // Return data URL for automation or if requested
          resolve(finalDataURL);
        } else {
          // Open in new tab for manual use
          const newTab = window.open();
          newTab.document.body.appendChild(canvas);
          resolve(finalDataURL);
        }
      }
      
      navbarImg.onerror = () => {
        reject(new Error('Failed to load navigation bar image'));
      }
    });
  });
}

// Automation-friendly screenshot capture
async function captureScreenshotAutomated(deviceType) {
  if (deviceType && deviceType !== selectedSystem) {
    setSysyem(deviceType);
  }
  
  return await takeScreenshot(true);
}

/**
 * 電腦版截圖
 */
const takeComputerScreenshot = () => {
  chrome.tabs.captureVisibleTab(null, { format: 'png' }, function (dataUrl) {
    const screenshotImg = new Image()
    screenshotImg.src = dataUrl
    screenshotImg.onload = () => {
      const canvas = document.createElement('canvas')
      const scaledWidth = screenshotImg.width / window.devicePixelRatio
      const scaledHeight = screenshotImg.height / window.devicePixelRatio
      canvas.width = screenshotImg.width
      canvas.height = screenshotImg.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(screenshotImg, 0, 0, scaledWidth, scaledHeight)
      
      if (automationMode) {
        // Return canvas data for automation
        return canvas.toDataURL('image/png');
      } else {
        // Open in new tab for manual use
        const newTab = window.open()
        newTab.document.body.appendChild(canvas)
      }
    }
  })
}

/**
 * 電腦版與手機版轉換
 */
const toggleSwitch = () => {
  if (!!switchBtn.checked) {
    smartphoneSetting.style.setProperty('display', 'none')
  } else {
    smartphoneSetting.style.setProperty('display', 'block')
  }
}

switchBtn.addEventListener('click', () => toggleSwitch())

captureBtn.addEventListener('click', () => {
  if (!!switchBtn.checked) {
    takeComputerScreenshot()
  } else {
    takeScreenshot()
  }
})

// Expose automation API
window.automationAPI = {
  captureScreenshot: captureScreenshotAutomated,
  setDevice: setSysyem,
  setTime: setTime,
  setURL: setURL,
  getConfig: () => ({
    device: selectedSystem,
    time: timeInput.value,
    automationMode
  })
};

init()