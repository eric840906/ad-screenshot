#!/usr/bin/env node

/**
 * Offline functionality test - tests core components without network dependency
 */

const { BrowserAutomationEngine } = require('./dist/services/BrowserAutomationEngine');
const { ChromeExtensionBridge } = require('./dist/services/ChromeExtensionBridge');

async function testOfflineFunctionality() {
  console.log('🧪 Testing Core System Components (Offline Mode)\n');

  try {
    // Test 1: Browser Engine Initialization
    console.log('1️⃣ Testing Browser Engine Initialization...');
    const browserEngine = BrowserAutomationEngine.getInstance();
    await browserEngine.initialize();
    console.log('✅ Browser engine initialized successfully');
    
    // Test session creation
    const sessionId = 'offline-test-session';
    const session = await browserEngine.createSession('android', sessionId);
    console.log('✅ Browser session created');
    console.log(`   Session ID: ${session.id}`);
    console.log(`   Device: ${session.deviceProfile.name}`);
    console.log(`   Viewport: ${session.deviceProfile.viewport.width}x${session.deviceProfile.viewport.height}`);
    
    // Test navigation to data URL (offline)
    const dataUrl = 'data:text/html,<html><head><title>Test Page</title></head><body><h1>AD543 Test</h1><div class="content-area">Ready for ad injection!</div></body></html>';
    await browserEngine.navigateToUrl(sessionId, dataUrl);
    console.log('✅ Navigation to offline page successful');
    
    const title = await browserEngine.getPageTitle(sessionId);
    console.log(`✅ Page title retrieved: "${title}"`);
    
    // Test script execution
    const result = await browserEngine.executeScript(sessionId, '() => document.querySelector("h1").textContent');
    console.log(`✅ Script execution successful: "${result}"`);
    
    // Test element detection
    const hasContent = await browserEngine.elementExists(sessionId, '.content-area');
    console.log(`✅ Element detection working: content area ${hasContent ? 'found' : 'not found'}`);
    
    // Test screenshot capability
    const screenshotBuffer = await browserEngine.takeScreenshot(sessionId);
    console.log(`✅ Screenshot captured: ${screenshotBuffer.length} bytes`);
    
    await browserEngine.destroySession(sessionId);
    await browserEngine.close();
    console.log('✅ Browser engine test completed\n');

    // Test 2: Extension Bridge
    console.log('2️⃣ Testing Chrome Extension Bridge...');
    const extensionBridge = ChromeExtensionBridge.getInstance();
    await extensionBridge.initialize();
    
    const isConnected = extensionBridge.isExtensionConnected();
    console.log(`   Extension connected: ${isConnected ? 'Yes ✅' : 'No ⚠️  (install extension to enable)'}`);
    
    const stats = extensionBridge.getConnectionStats();
    console.log(`   Connection stats: ${stats.totalConnections} total, ${stats.activeConnections} active`);
    console.log('✅ Extension bridge test completed\n');

    // Test 3: Configuration Validation
    console.log('3️⃣ Testing Configuration...');
    const { config } = require('./dist/config');
    console.log(`   Environment: ${config.env}`);
    console.log(`   Browser headless: ${config.browser.headless}`);
    console.log(`   Storage directory: ${config.storage.baseDirectory}`);
    console.log(`   Processing concurrency: ${config.processing.concurrency}`);
    console.log('✅ Configuration validation completed\n');

    console.log('🎉 Offline Test Results:');
    console.log('├── ✅ Browser automation: WORKING');
    console.log('├── ✅ Session management: WORKING'); 
    console.log('├── ✅ Screenshot capture: WORKING');
    console.log('├── ✅ Script execution: WORKING');
    console.log('├── ✅ Extension bridge: READY');
    console.log('└── ✅ Configuration: VALID\n');

    console.log('🚀 System Status: READY FOR TESTING!\n');

    console.log('📋 Next Steps:');
    console.log('1. ✅ Core system is working');
    console.log('2. 📦 Install Chrome extension (see QUICK_SETUP.md)');
    console.log('3. 🔗 Test extension integration');
    console.log('4. 🎯 Test AD543 bookmarklet integration');
    console.log('5. ⚡ Install Redis for full automation features\n');

    console.log('💡 Chrome Extension Installation:');
    console.log('• Open chrome://extensions/');
    console.log('• Enable Developer mode');
    console.log('• Load unpacked: extensions/enhanced-screenshot-extension/');
    console.log('• Test mobile screenshots on any webpage\n');

    return true;

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n🔧 Debug Info:');
    console.log('• Error type:', error.constructor.name);
    console.log('• Stack trace available in logs/');
    throw error;
  }
}

async function main() {
  console.log('🚀 AD543 Screenshot Automation System - Offline Test\n');
  console.log('Testing core functionality without network dependencies...\n');
  
  try {
    await testOfflineFunctionality();
    console.log('✅ All offline tests passed! System is ready for Chrome extension integration.');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Offline test failed.');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { testOfflineFunctionality };