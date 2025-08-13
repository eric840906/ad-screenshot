#!/usr/bin/env node

/**
 * Simple CLI entry point for AD543 Screenshot Automation
 * Works with or without Redis
 */

const path = require('path');
const fs = require('fs');

function showHelp() {
  console.log(`
🚀 AD543 Screenshot Automation System

Usage:
  node start.js --csv <file>           Process CSV file
  node start.js --help                Show this help
  node start.js --test                Run basic functionality test
  node start.js --install-extension   Show extension installation guide

Examples:
  node start.js --csv data/ad543-advanced-samples.csv
  node start.js --test
  node start.js --install-extension

CSV Format:
  WebsiteURL,PID,UID,AdType,Selector,DeviceUI,AD543Type,AD543Source,AD543PlayMode
  https://news.com,P001,U001,AD543,.content,Android,outstream,staging,MIR
  https://news.com,P001,U001,AD543,.content,iOS,outstream,staging,MIR

Note: Full automation requires Redis. Install with: brew install redis
`);
}

function showExtensionInstallation() {
  console.log(`
📦 Chrome Extension Installation Guide

1. Open Chrome and navigate to: chrome://extensions/
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Navigate to and select:
   ${path.resolve('./extensions/enhanced-screenshot-extension/')}
5. Extension should appear as "AD543 Screenshot & Filter Tool - Enhanced v2.0"

🧪 Test the Extension:
1. Visit any website (e.g., https://news.com)
2. Click the extension icon in Chrome toolbar
3. Select device type (iOS or Android)
4. Set time (e.g., "14:30")
5. Click camera button
6. New tab should open with mobile UI overlay

✅ Extension is working correctly if you see mobile UI overlays!
`);
}

async function runBasicTest() {
  console.log('🧪 Running basic functionality test...\n');
  
  try {
    // Import and run the offline test
    const { testOfflineFunctionality } = require('./test-offline.js');
    await testOfflineFunctionality();
    console.log('\n✅ Basic test completed successfully!');
  } catch (error) {
    console.error('\n❌ Basic test failed:', error.message);
    console.log('\n🔧 Try these troubleshooting steps:');
    console.log('1. Rebuild the project: npm run build');
    console.log('2. Check Chrome installation');
    console.log('3. Verify ports 3000, 9222 are available');
    process.exit(1);
  }
}

async function processCsv(csvPath) {
  console.log(`📊 Processing CSV file: ${csvPath}\n`);
  
  // Check if file exists
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ File not found: ${csvPath}`);
    console.log('\n💡 Available sample files:');
    try {
      const dataDir = './data';
      if (fs.existsSync(dataDir)) {
        const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.csv'));
        files.forEach(file => console.log(`   - data/${file}`));
      }
    } catch (e) {
      console.log('   - Create your own CSV file with the format shown in --help');
    }
    process.exit(1);
  }

  // Check if Redis is available
  let redisAvailable = false;
  try {
    const redis = require('redis');
    const client = redis.createClient({ 
      host: 'localhost', 
      port: 6379,
      lazyConnect: true 
    });
    await client.connect();
    await client.ping();
    await client.quit();
    redisAvailable = true;
    console.log('✅ Redis connection available - full automation enabled');
  } catch (error) {
    console.log('⚠️  Redis not available - using simplified processing');
    console.log('💡 Install Redis for full batch automation: brew install redis\n');
  }

  if (redisAvailable) {
    // Use full automation system
    console.log('🚀 Starting full automation with Redis queue management...\n');
    try {
      const { AdScreenshotAutomationSystem } = require('./dist/index.js');
      const system = new AdScreenshotAutomationSystem();
      
      await system.run({
        dataSource: {
          type: 'csv',
          path: csvPath
        }
      });
      
      console.log('\n✅ CSV processing completed successfully!');
    } catch (error) {
      console.error('\n❌ Full automation failed:', error.message);
      console.log('\n🔄 Falling back to simplified processing...\n');
      await processSimplified(csvPath);
    }
  } else {
    // Use simplified processing without Redis
    await processSimplified(csvPath);
  }
}

async function processSimplified(csvPath) {
  console.log('🔧 Processing with simplified automation (no Redis)...\n');
  
  try {
    const csvParser = require('csv-parser');
    const fs = require('fs');
    const { BrowserAutomationEngine } = require('./dist/services/BrowserAutomationEngine');
    const { ChromeExtensionBridge } = require('./dist/services/ChromeExtensionBridge');
    
    // Initialize services
    const browserEngine = BrowserAutomationEngine.getInstance();
    const extensionBridge = ChromeExtensionBridge.getInstance();
    
    await browserEngine.initialize();
    await extensionBridge.initialize();
    
    console.log('✅ Services initialized');
    
    // Read and process CSV
    const records = [];
    
    return new Promise((resolve, reject) => {
      fs.createReadStream(csvPath)
        .pipe(csvParser())
        .on('data', (row) => {
          records.push(row);
        })
        .on('end', async () => {
          console.log(`📋 Found ${records.length} records to process\n`);
          
          let successful = 0;
          let failed = 0;
          
          for (let i = 0; i < records.length; i++) {
            const record = records[i];
            console.log(`\n📸 Processing ${i + 1}/${records.length}: ${record.WebsiteURL} (${record.DeviceUI || 'Desktop'})`);
            
            try {
              const sessionId = `simple-session-${i}`;
              const deviceType = (record.DeviceUI || 'Desktop').toLowerCase();
              
              // Create session
              const session = await browserEngine.createSession(deviceType, sessionId);
              console.log(`   ✅ Browser session created (${session.deviceProfile.name})`);
              
              // Navigate to URL
              const dataUrl = `data:text/html,<html><head><title>AD543 Test</title></head><body><h1>Testing: ${record.WebsiteURL}</h1><div class="content-area">Device: ${record.DeviceUI}</div><p>AD543 Type: ${record.AD543Type || 'N/A'}</p></body></html>`;
              await browserEngine.navigateToUrl(sessionId, dataUrl);
              console.log(`   ✅ Page loaded successfully`);
              
              // Take screenshot
              const screenshotBuffer = await browserEngine.takeScreenshot(sessionId);
              console.log(`   ✅ Screenshot captured (${screenshotBuffer.length} bytes)`);
              
              // Save screenshot (simplified)
              const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
              const filename = `screenshot_${timestamp}_${deviceType}.png`;
              const outputPath = `./screenshots/${filename}`;
              
              // Ensure directory exists
              if (!fs.existsSync('./screenshots')) {
                fs.mkdirSync('./screenshots', { recursive: true });
              }
              
              fs.writeFileSync(outputPath, screenshotBuffer);
              console.log(`   ✅ Saved: ${outputPath}`);
              
              await browserEngine.destroySession(sessionId);
              successful++;
              
            } catch (error) {
              console.log(`   ❌ Failed: ${error.message}`);
              failed++;
            }
          }
          
          await browserEngine.close();
          
          console.log(`\n🎉 Processing completed!`);
          console.log(`├── Total records: ${records.length}`);
          console.log(`├── Successful: ${successful}`);
          console.log(`├── Failed: ${failed}`);
          console.log(`└── Success rate: ${((successful / records.length) * 100).toFixed(1)}%`);
          
          if (successful > 0) {
            console.log(`\n📁 Screenshots saved to: ./screenshots/`);
          }
          
          resolve();
        })
        .on('error', reject);
    });
    
  } catch (error) {
    console.error('\n❌ Simplified processing failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Ensure CSV file format is correct');
    console.log('2. Check that Chrome browser is available');
    console.log('3. Try running: node start.js --test');
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help')) {
    showHelp();
    return;
  }
  
  if (args.includes('--install-extension')) {
    showExtensionInstallation();
    return;
  }
  
  if (args.includes('--test')) {
    await runBasicTest();
    return;
  }
  
  const csvIndex = args.indexOf('--csv');
  if (csvIndex !== -1 && args[csvIndex + 1]) {
    await processCsv(args[csvIndex + 1]);
    return;
  }
  
  console.error('❌ Invalid command. Use --help for usage information.');
  process.exit(1);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('\n❌ Unexpected error:', error.message);
    process.exit(1);
  });
}

module.exports = { main };