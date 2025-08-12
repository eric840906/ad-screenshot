# Multi-platform Ad Query & Screenshot Automation System - Setup Guide

## macOS Local Development Environment Setup

### Prerequisites

#### 1. Node.js Installation
```bash
# Check if Node.js is installed
node --version
npm --version

# If not installed, install via Homebrew
brew install node

# Verify version (requires Node.js 18+)
node --version  # Should be 18.0.0 or higher
```

#### 2. Redis Installation and Configuration
```bash
# Install Redis via Homebrew
brew install redis

# Start Redis service
brew services start redis

# Verify Redis is running
redis-cli ping  # Should return "PONG"

# Check Redis status
brew services list | grep redis
```

#### 3. Chrome/Chromium for Puppeteer
```bash
# Install Google Chrome (if not already installed)
brew install --cask google-chrome

# Verify Chrome installation
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --version
```

### Project Setup

#### 1. Install Dependencies
```bash
cd /Users/ericchiu/playground/ad-screenshot

# Install project dependencies
npm install

# Build TypeScript
npm run build
```

#### 2. Create Environment Configuration
Create a `.env` file in the project root:

```bash
# Copy example environment file
cp .env.example .env
```

Edit `.env` with your configuration:
```env
# Environment
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

# Google Drive Configuration (optional)
GOOGLE_DRIVE_KEY_FILE=./credentials/google-drive-key.json
GOOGLE_DRIVE_PARENT_FOLDER=
ENABLE_DRIVE_UPLOAD=false

# Logging Configuration
LOG_LEVEL=info
LOG_FILE_PATH=./logs

# Chrome Extension Configuration
EXTENSION_ID=
EXTENSION_PORT=9222
```

#### 3. Create Required Directories
```bash
# Create necessary directories
mkdir -p screenshots logs credentials data/processed data/failed
```

#### 4. Set Directory Permissions
```bash
# Ensure proper permissions
chmod 755 screenshots logs credentials
chmod 644 .env
```

### Service Configuration

#### 1. Redis Configuration
Create Redis configuration file:
```bash
# Create Redis config directory
sudo mkdir -p /usr/local/etc/redis

# Create Redis config file
sudo tee /usr/local/etc/redis/redis.conf << EOF
# Redis Configuration for Ad Screenshot Automation
port 6379
bind 127.0.0.1
protected-mode yes
timeout 300
keepalive 60
loglevel notice
logfile /usr/local/var/log/redis/redis-server.log
databases 16
save 900 1
save 300 10
save 60 10000
maxmemory 256mb
maxmemory-policy allkeys-lru
EOF

# Restart Redis with new configuration
brew services restart redis
```

#### 2. Chrome Setup for Puppeteer
```bash
# Set Chrome executable path (add to .env if needed)
echo 'CHROME_EXECUTABLE_PATH=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' >> .env

# Test Chrome automation
node -e "
const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://example.com');
  console.log('Chrome automation test successful');
  await browser.close();
})().catch(console.error);
"
```

### Environment Validation

#### 1. Basic System Check
```bash
# Run system validation
npm run validate-env
```

#### 2. Manual Verification Steps
```bash
# Check Node.js version
node --version

# Check npm version
npm --version

# Check Redis connectivity
redis-cli ping

# Check Chrome installation
google-chrome --version 2>/dev/null || echo "Chrome not found in PATH"

# Test TypeScript compilation
npm run build

# Run basic tests
npm test
```

### Development Workflow

#### 1. Start Development Server
```bash
# Start in development mode
npm run dev

# Or build and start production mode
npm run build
npm start
```

#### 2. Monitor Logs
```bash
# Watch application logs
tail -f logs/app.log

# Watch Redis logs
tail -f /usr/local/var/log/redis/redis-server.log
```

#### 3. Test Basic Functionality
```bash
# Test screenshot functionality
node -e "
const { ScreenshotManager } = require('./dist/services/ScreenshotManager');
const manager = new ScreenshotManager();
manager.captureScreenshot('https://example.com', { deviceType: 'Desktop' })
  .then(() => console.log('Screenshot test successful'))
  .catch(console.error);
"
```

### Troubleshooting Common Issues

#### Redis Connection Issues
```bash
# Check if Redis is running
brew services list | grep redis

# Restart Redis
brew services restart redis

# Check Redis logs
tail -f /usr/local/var/log/redis/redis-server.log
```

#### Chrome/Puppeteer Issues
```bash
# Install additional dependencies
npm install puppeteer --unsafe-perm=true --allow-root

# Check Chrome executable
which google-chrome

# Test with different Chrome flags
export CHROME_DEVEL_SANDBOX=/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome
```

#### Permission Issues
```bash
# Fix directory permissions
sudo chown -R $(whoami) /Users/ericchiu/playground/ad-screenshot
chmod -R 755 screenshots logs
```

#### Memory Issues
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Monitor memory usage
top -pid $(pgrep node)
```

### Next Steps

1. **Google API Setup**: Follow the Google API Credentials Configuration section
2. **Chrome Extension**: Set up the Chrome extension for enhanced functionality
3. **Cron Jobs**: Configure automated scheduling
4. **Monitoring**: Set up health checks and alerting

For detailed configuration of each component, refer to the specific sections in this guide.