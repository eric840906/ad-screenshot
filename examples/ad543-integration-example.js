#!/usr/bin/env node

/**
 * AD543 Company Bookmarklet Integration Example
 * 
 * This example demonstrates how to use the integrated AD543 bookmarklet
 * for automated ad detection and screenshot capture.
 */

const { ProcessingPipeline } = require('../src/services/ProcessingPipeline');
const { BookmarkletExecutor } = require('../src/services/BookmarkletExecutor');
const { logger } = require('../src/services/LoggingService');

async function demonstrateAD543Integration() {
  console.log('🚀 AD543 Integration Demo Starting...\n');

  try {
    // Initialize services
    const pipeline = new ProcessingPipeline();
    const bookmarkletExecutor = BookmarkletExecutor.getInstance();
    
    await pipeline.initialize();

    console.log('✅ Services initialized\n');

    // Example 1: Process CSV with AD543 bookmarklet entries
    console.log('📊 Example 1: Processing CSV with AD543 entries');
    
    const csvResults = await pipeline.processBatch('./data/sample-ads.csv', {
      batchSize: 5,
      concurrent: 2,
      enableUpload: false
    });
    
    console.log('CSV Processing Results:');
    console.log(`- Total Records: ${csvResults.total}`);
    console.log(`- Successful: ${csvResults.successful}`);
    console.log(`- Failed: ${csvResults.failed}`);
    console.log(`- Duration: ${csvResults.duration}ms\n`);

    // Example 2: Direct AD543 bookmarklet execution
    console.log('🔧 Example 2: Direct AD543 bookmarklet execution');
    
    // This would typically be called within the automation pipeline
    const directResult = await bookmarkletExecutor.executeAD543Bookmarklet('demo-session', {
      openPanel: true, // Open panel for demonstration
      waitForReady: true,
      timeout: 30000
    });
    
    if (directResult.success) {
      console.log('✅ AD543 bookmarklet executed successfully');
      console.log(`- Execution Time: ${directResult.executionTime}ms`);
      console.log(`- Result: ${JSON.stringify(directResult.result, null, 2)}\n`);
    } else {
      console.log('❌ AD543 bookmarklet execution failed');
      console.log(`- Error: ${directResult.error}\n`);
    }

    // Example 3: Check AD543 panel visibility
    console.log('👁️ Example 3: Checking AD543 panel visibility');
    
    const isPanelVisible = await bookmarkletExecutor.isAD543PanelVisible('demo-session');
    console.log(`- Panel Visible: ${isPanelVisible ? 'Yes' : 'No'}\n`);

    console.log('🎉 AD543 Integration Demo Complete!');

  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    logger.error('AD543 integration demo failed', error);
  }
}

// Configuration examples
function showConfigurationExamples() {
  console.log('📋 AD543 Configuration Examples:\n');

  console.log('1. CSV Format with AD543 bookmarklet:');
  console.log(`WebsiteURL,PID,UID,AdType,Selector,DeviceUI,BookmarkletType
https://news.example.com,PROD001,USER001,AD543,.content-area,Android,AD543
https://media.example.com,PROD002,USER002,AD543,.main-content,iOS,AD543
https://blog.example.com,PROD003,USER003,AD543,.article-body,Desktop,AD543
`);

  console.log('2. Programmatic Configuration:');
  console.log(`const adRecord = {
  WebsiteURL: 'https://example.com',
  PID: 'PROD001',
  UID: 'USER001', 
  AdType: 'AD543',
  Selector: '.content-area',
  DeviceUI: 'Android',
  BookmarkletType: 'AD543'
};
`);

  console.log('3. Direct AD543 Execution Options:');
  console.log(`const options = {
  openPanel: false,        // Don't auto-open panel for automation
  waitForReady: true,      // Wait for full AD543 initialization
  timeout: 30000           // 30-second timeout
};
`);
}

// Advanced usage examples
function showAdvancedUsageExamples() {
  console.log('🔬 Advanced AD543 Usage Examples:\n');

  console.log('1. Custom Error Handling:');
  console.log(`try {
  const result = await bookmarkletExecutor.executeAD543Bookmarklet(sessionId, {
    openPanel: false,
    waitForReady: true,
    timeout: 30000
  });
  
  if (!result.success) {
    // Handle AD543-specific errors
    if (result.error.includes('Failed to load searchPanelStyle.css')) {
      // CSS loading failed - network issue
      await retryWithDelay();
    } else if (result.error.includes('AD543 not ready within timeout')) {
      // Initialization timeout - increase timeout or check network
      await executeWithLongerTimeout();
    }
  }
} catch (error) {
  logger.error('AD543 execution failed', error);
}
`);

  console.log('2. Integration with Existing Chrome Extension:');
  console.log(`// After AD543 loads, you can integrate with your Chrome extension
const result = await bookmarkletExecutor.executeAD543Bookmarklet(sessionId);

if (result.success) {
  // Trigger Chrome extension screenshot
  const screenshot = await chromeExtensionBridge.triggerScreenshot(sessionId);
  
  // Save with AD543-enhanced data
  await screenshotManager.saveWithMetadata(screenshot, {
    ad543Data: result.result,
    timestamp: new Date().toISOString()
  });
}
`);

  console.log('3. Monitoring AD543 Performance:');
  console.log(`// Track AD543 execution metrics
const metrics = {
  loadTime: result.executionTime,
  success: result.success,
  panelOpened: await bookmarkletExecutor.isAD543PanelVisible(sessionId),
  cssLoaded: result.result?.ad543Loaded
};

await metricsCollector.recordAD543Metrics(metrics);
`);
}

// Run examples if this script is executed directly
if (require.main === module) {
  console.log('🎯 AD543 Company Bookmarklet Integration Examples\n');
  
  showConfigurationExamples();
  console.log('\n' + '='.repeat(80) + '\n');
  
  showAdvancedUsageExamples();
  console.log('\n' + '='.repeat(80) + '\n');
  
  // Run the demo
  demonstrateAD543Integration().catch(console.error);
}

module.exports = {
  demonstrateAD543Integration,
  showConfigurationExamples,
  showAdvancedUsageExamples
};