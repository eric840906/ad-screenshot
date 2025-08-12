/**
 * Basic usage example for Ad Screenshot Automation System
 */

const AdScreenshotAutomationSystem = require('../dist/index.js').default;

async function basicExample() {
  const system = new AdScreenshotAutomationSystem();

  try {
    // Initialize the system
    await system.initialize();

    // Process CSV file
    await system.run({
      dataSource: {
        type: 'csv',
        path: './data/sample-ads.csv'
      },
      concurrency: 2,
      enableUpload: false, // Set to true if Google Drive is configured
      enableBookmarklet: true,
      enableExtension: false
    });

    console.log('✅ Processing completed successfully');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await system.shutdown();
  }
}

async function googleSheetsExample() {
  const system = new AdScreenshotAutomationSystem();

  try {
    await system.initialize();

    // Process Google Sheets (requires Google API credentials)
    await system.run({
      dataSource: {
        type: 'google_sheets',
        spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
        range: 'Sheet1!A1:F100'
      },
      concurrency: 3,
      enableUpload: true
    });

    console.log('✅ Google Sheets processing completed');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await system.shutdown();
  }
}

async function singleRecordExample() {
  const { ProcessingPipeline } = require('../dist/index.js');
  
  const pipeline = ProcessingPipeline.getInstance();

  try {
    await pipeline.initialize();

    // Process single record
    const result = await pipeline.processSingle({
      WebsiteURL: 'https://example.com',
      PID: 'TEST001',
      UID: 'USER001',
      AdType: 'Banner',
      Selector: '.ad-banner',
      DeviceUI: 'Android'
    });

    console.log('Single record result:', result);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pipeline.shutdown();
  }
}

async function statusCheckExample() {
  const system = new AdScreenshotAutomationSystem();

  try {
    const status = await system.getStatus();
    console.log('System Status:', JSON.stringify(status, null, 2));

    if (status.initialized) {
      await system.shutdown();
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run examples based on command line argument
const example = process.argv[2];

switch (example) {
  case 'basic':
    basicExample();
    break;
  case 'sheets':
    googleSheetsExample();
    break;
  case 'single':
    singleRecordExample();
    break;
  case 'status':
    statusCheckExample();
    break;
  default:
    console.log(`
Available examples:
  node examples/basic-usage.js basic    - Basic CSV processing
  node examples/basic-usage.js sheets   - Google Sheets processing
  node examples/basic-usage.js single   - Single record processing
  node examples/basic-usage.js status   - System status check
    `);
}

module.exports = {
  basicExample,
  googleSheetsExample,
  singleRecordExample,
  statusCheckExample
};