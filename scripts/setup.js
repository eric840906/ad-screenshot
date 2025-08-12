#!/usr/bin/env node

/**
 * Setup script for Ad Screenshot Automation System
 */

const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

const REQUIRED_DIRECTORIES = [
  'screenshots',
  'logs',
  'data',
  'temp',
  'backups',
  'archives',
  'credentials'
];

const SAMPLE_DATA_CSV = `WebsiteURL,PID,UID,AdType,Selector,DeviceUI
https://example.com,PROD001,USER001,Banner,.ad-banner,Android
https://example.com,PROD001,USER001,Banner,.ad-banner,iOS
https://test-site.com,PROD002,USER002,Video,.video-ad,Desktop
https://demo.com,PROD003,USER003,Sidebar,.sidebar-ad,Android`;

const SAMPLE_ENV = `# Environment Configuration for Ad Screenshot Automation System

NODE_ENV=development
PORT=3000

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Browser Configuration
BROWSER_HEADLESS=true
BROWSER_TIMEOUT=30000
SCREENSHOT_TIMEOUT=10000

# Processing Configuration
CONCURRENT_JOBS=3
BATCH_SIZE=50
MAX_RETRIES=3

# Storage Configuration
STORAGE_BASE_DIR=./screenshots
CREATE_DATE_FOLDERS=true

# Google Drive Configuration (Optional)
GOOGLE_DRIVE_KEY_FILE=./credentials/google-drive-key.json
GOOGLE_DRIVE_PARENT_FOLDER=
ENABLE_DRIVE_UPLOAD=false

# Logging Configuration
LOG_LEVEL=info
LOG_FILE_PATH=./logs

# Chrome Extension Configuration (Optional)
EXTENSION_ID=
EXTENSION_PORT=9222`;

const SAMPLE_BOOKMARKLET = `/**
 * Sample bookmarklet for ad highlighting
 */
javascript:(function() {
  const ads = document.querySelectorAll('.ad, .advertisement, [class*="ad-"], [id*="ad-"]');
  ads.forEach((ad, index) => {
    ad.style.outline = '3px solid #ff0000';
    ad.style.outlineOffset = '2px';
    ad.style.backgroundColor = '#ff000020';
    
    const label = document.createElement('div');
    label.textContent = 'AD ' + (index + 1);
    label.style.cssText = 'position: absolute; top: -25px; left: 0; background: #ff0000; color: white; padding: 2px 6px; font-size: 12px; font-weight: bold; z-index: 9999;';
    ad.style.position = 'relative';
    ad.appendChild(label);
  });
  
  if (ads.length > 0) {
    alert('Highlighted ' + ads.length + ' ad elements');
  } else {
    alert('No ad elements found');
  }
})();`;

async function main() {
  console.log('🚀 Setting up Ad Screenshot Automation System...\n');

  try {
    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    
    if (majorVersion < 18) {
      console.error('❌ Node.js 18 or higher is required. Current version:', nodeVersion);
      process.exit(1);
    }
    console.log('✅ Node.js version check passed:', nodeVersion);

    // Create required directories
    console.log('\n📁 Creating required directories...');
    for (const dir of REQUIRED_DIRECTORIES) {
      const dirPath = path.join(process.cwd(), dir);
      await fs.ensureDir(dirPath);
      console.log(`  ✅ Created: ${dir}/`);
    }

    // Create .env file if it doesn't exist
    const envPath = path.join(process.cwd(), '.env');
    if (!await fs.pathExists(envPath)) {
      await fs.writeFile(envPath, SAMPLE_ENV);
      console.log('  ✅ Created: .env (sample configuration)');
    } else {
      console.log('  ℹ️  .env file already exists');
    }

    // Create sample data file
    const dataDir = path.join(process.cwd(), 'data');
    const sampleDataPath = path.join(dataDir, 'sample-ads.csv');
    await fs.writeFile(sampleDataPath, SAMPLE_DATA_CSV);
    console.log('  ✅ Created: data/sample-ads.csv');

    // Create sample bookmarklet
    const examplesDir = path.join(process.cwd(), 'examples');
    const bookmarkletPath = path.join(examplesDir, 'sample-bookmarklet.js');
    await fs.writeFile(bookmarkletPath, SAMPLE_BOOKMARKLET);
    console.log('  ✅ Created: examples/sample-bookmarklet.js');

    // Check for Redis
    console.log('\n🔍 Checking dependencies...');
    try {
      execSync('redis-cli ping', { stdio: 'ignore' });
      console.log('  ✅ Redis is running');
    } catch (error) {
      console.log('  ⚠️  Redis is not running. Please install and start Redis:');
      console.log('     - macOS: brew install redis && brew services start redis');
      console.log('     - Ubuntu: sudo apt install redis-server');
      console.log('     - Windows: Download from https://redis.io/download');
    }

    // Check for Chrome/Chromium
    try {
      const puppeteer = require('puppeteer');
      console.log('  ✅ Puppeteer will handle browser installation');
    } catch (error) {
      console.log('  ⚠️  Puppeteer not installed yet (will be installed with npm install)');
    }

    // Create Google Drive credentials template
    const credentialsDir = path.join(process.cwd(), 'credentials');
    const credentialsTemplate = path.join(credentialsDir, 'google-drive-key.json.template');
    const credentialsTemplateContent = {
      "type": "service_account",
      "project_id": "your-project-id",
      "private_key_id": "your-private-key-id",
      "private_key": "-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n",
      "client_email": "your-service-account@your-project.iam.gserviceaccount.com",
      "client_id": "your-client-id",
      "auth_uri": "https://accounts.google.com/o/oauth2/auth",
      "token_uri": "https://oauth2.googleapis.com/token",
      "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs"
    };
    
    await fs.writeJson(credentialsTemplate, credentialsTemplateContent, { spaces: 2 });
    console.log('  ✅ Created: credentials/google-drive-key.json.template');

    console.log('\n🎉 Setup completed successfully!\n');

    console.log('📋 Next steps:');
    console.log('1. Install dependencies: npm install');
    console.log('2. Build the project: npm run build');
    console.log('3. Start Redis if not running: redis-server');
    console.log('4. (Optional) Configure Google Drive credentials in credentials/');
    console.log('5. (Optional) Update .env file with your configuration');
    console.log('6. Run the system: npm start --csv data/sample-ads.csv\n');

    console.log('📖 For more information, see the documentation in docs/');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };