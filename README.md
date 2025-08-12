# Ad Screenshot Automation System

A comprehensive, production-ready Node.js/TypeScript application for automated ad screenshot capture across multiple platforms and devices. Built with modern web automation technologies including Puppeteer, Bull Queue, Redis, and Google Drive integration.

## 🚀 Features

### Core Functionality
- **Multi-platform Support**: Chrome mobile emulation for Android, iOS, and Desktop
- **Batch Processing**: Handle 50+ records per batch with configurable concurrency
- **Smart Queue Management**: Redis-backed job queue with retry logic and error handling
- **Image Processing**: Sharp-based screenshot optimization and formatting
- **Cloud Storage**: Automatic Google Drive upload with organized folder structure
- **Bookmarklet Integration**: Execute custom JavaScript for enhanced ad detection
- **Chrome Extension Bridge**: Real-time communication with browser extensions

### Data Sources
- **CSV Files**: Parse local CSV files with ad targeting data
- **Google Sheets**: Direct integration with Google Sheets API
- **Flexible Schema**: Support for WebsiteURL, PID, UID, AdType, Selector, DeviceUI columns

### File Management
- **Organized Storage**: Date-based and platform-based folder organization
- **Smart Naming**: `{Date}_{PlatformName}_{PID}_{UID}_{AdType}_{DeviceUI}.png`
- **Multiple Formats**: PNG, JPEG, WebP support with quality optimization
- **Automatic Cleanup**: Configurable retention policies and archiving

### Error Handling & Monitoring
- **Comprehensive Logging**: Winston-based structured logging
- **Retry Strategies**: Different retry patterns for various error types
- **Circuit Breakers**: Prevent cascade failures in high-load scenarios
- **Health Monitoring**: Real-time system status and performance metrics

## 📋 Prerequisites

- **Node.js**: Version 18.0.0 or higher
- **Redis**: For queue management and caching
- **Chrome/Chromium**: Automatically installed via Puppeteer
- **Google Drive API** (Optional): For cloud storage functionality

## 🛠️ Installation

### Quick Setup

```bash
# Clone the repository
git clone <repository-url>
cd ad-screenshot

# Run setup script
npm run setup

# Install dependencies
npm install

# Build the project
npm run build

# Start Redis (if not running)
redis-server

# Run the system
npm start --csv data/sample-ads.csv
```

### Manual Setup

```bash
# Install dependencies
npm install

# Create required directories
mkdir -p screenshots logs data temp backups credentials

# Copy environment configuration
cp .env.example .env

# Build TypeScript
npm run build
```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file with the following configuration:

```env
# Application Environment
NODE_ENV=development
PORT=3000

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
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
ENABLE_DRIVE_UPLOAD=false

# Logging Configuration
LOG_LEVEL=info
LOG_FILE_PATH=./logs

# Chrome Extension Configuration (Optional)
EXTENSION_PORT=9222
```

### Google Drive Setup (Optional)

1. Create a Google Cloud Project
2. Enable the Google Drive API
3. Create a Service Account
4. Download the JSON key file
5. Place it in `credentials/google-drive-key.json`
6. Set `ENABLE_DRIVE_UPLOAD=true` in `.env`

## 🚀 Usage

### Command Line Interface

```bash
# Process CSV file
npm start --csv data/ads.csv

# Process Google Sheets
npm start --google-sheets SPREADSHEET_ID

# With options
npm start --csv data/ads.csv --concurrency 5 --enable-upload

# System health check
npm start --health

# System status
npm start --status
```

### Programmatic Usage

```javascript
const AdScreenshotAutomationSystem = require('./dist/index.js').default;

const system = new AdScreenshotAutomationSystem();

async function processAds() {
  try {
    await system.initialize();
    
    await system.run({
      dataSource: {
        type: 'csv',
        path: './data/ads.csv'
      },
      concurrency: 3,
      enableUpload: true,
      enableBookmarklet: true
    });
    
  } finally {
    await system.shutdown();
  }
}

processAds();
```

### Data Format

Your CSV file or Google Sheet should have the following columns:

```csv
WebsiteURL,PID,UID,AdType,Selector,DeviceUI
https://example.com,PROD001,USER001,Banner,.ad-banner,Android
https://example.com,PROD001,USER001,Banner,.ad-banner,iOS
https://test-site.com,PROD002,USER002,Video,.video-ad,Desktop
```

## 🔖 Bookmarklet Integration

The system supports custom JavaScript execution through bookmarklets:

### Built-in Templates

- **Element Highlighter**: Highlight elements matching CSS selectors
- **Ad Information Extractor**: Extract comprehensive ad data
- **Page Scanner**: Scan for various ad-related elements

### Usage in Data Files

```csv
WebsiteURL,PID,UID,AdType,Selector,DeviceUI
https://example.com,PROD001,USER001,Banner,bookmarklet:Element Highlighter:selector=.ad,Android
```

### Custom Bookmarklets

```javascript
const { BookmarkletExecutor } = require('./dist/index.js');

const executor = BookmarkletExecutor.getInstance();

const config = executor.createConfigFromTemplate('Element Highlighter', {
  selector: '.advertisement',
  color: '#ff0000',
  duration: 5000
});
```

## 🔌 Chrome Extension Integration

The system includes a sample Chrome extension for enhanced browser automation:

### Installation

1. Navigate to `examples/chrome-extension-sample/`
2. Load the extension in Chrome Developer Mode
3. The extension will automatically connect to the automation bridge

### Features

- Real-time element highlighting
- Data extraction and analysis
- Screenshot coordination
- WebSocket communication with main system

## 📊 Monitoring & Logging

### Log Files

- `logs/application.log` - General application logs
- `logs/error_{date}.log` - Daily error logs
- `logs/info.log` - Info level and above
- `logs/exceptions.log` - Uncaught exceptions

### Health Monitoring

```bash
# Check system health
curl http://localhost:3000/health

# Get queue statistics
npm start --status
```

### Performance Metrics

The system automatically logs:
- Job processing times
- Success/failure rates
- Memory and CPU usage
- Queue statistics
- Browser session metrics

## 🔧 Advanced Configuration

### Device Profiles

Customize device emulation in `src/config/index.ts`:

```typescript
export const DEVICE_PROFILES: Record<string, DeviceProfile> = {
  'Custom Device': {
    name: 'Custom Device',
    userAgent: 'Custom User Agent',
    viewport: {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      isLandscape: false,
    },
  },
};
```

### Retry Strategies

Configure retry behavior for different error types:

```typescript
retryStrategies: {
  network: {
    maxAttempts: 5,
    delayMs: 1000,
    backoffMultiplier: 2,
    maxDelayMs: 10000,
  }
}
```

### Custom Processing Pipeline

```javascript
const { ProcessingPipeline } = require('./dist/index.js');

const pipeline = ProcessingPipeline.getInstance();

// Process single record
const result = await pipeline.processSingle({
  WebsiteURL: 'https://example.com',
  PID: 'TEST001',
  UID: 'USER001',
  AdType: 'Banner',
  Selector: '.ad-banner',
  DeviceUI: 'Android'
});
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format
```

## 📚 API Reference

### Core Services

- **`DataIngestionService`**: Parse CSV and Google Sheets data
- **`QueueManager`**: Manage job queues with Redis
- **`BrowserAutomationEngine`**: Puppeteer-based browser automation
- **`BookmarkletExecutor`**: Execute custom JavaScript in browser
- **`ChromeExtensionBridge`**: WebSocket bridge for browser extensions
- **`ScreenshotManager`**: Image processing and optimization
- **`FileStorageService`**: Local file management
- **`UploadService`**: Google Drive integration
- **`LoggingService`**: Structured logging with Winston

### Error Handling

```javascript
const { errorHandler, AppError, ErrorType } = require('./dist/utils/ErrorHandler');

// Retry with custom strategy
await errorHandler.withRetry(async () => {
  // Your async operation
}, {
  maxAttempts: 3,
  delayMs: 1000,
  backoffMultiplier: 2
});

// Create custom errors
throw new AppError(
  'Custom error message',
  ErrorType.NETWORK_ERROR,
  { context: 'additional info' }
);
```

## 🐛 Troubleshooting

### Common Issues

**Redis Connection Failed**
```bash
# Start Redis
redis-server

# Check Redis status
redis-cli ping
```

**Browser Launch Failed**
```bash
# Install Chrome dependencies (Linux)
sudo apt-get install -y gconf-service libasound2-dev

# For macOS, ensure Xcode command line tools are installed
xcode-select --install
```

**Google Drive Upload Failed**
- Verify service account credentials
- Check Google Drive API is enabled
- Ensure sufficient storage quota

**High Memory Usage**
- Reduce concurrent jobs in configuration
- Enable browser session cleanup
- Monitor queue size

### Debug Mode

```bash
# Enable debug logging
LOG_LEVEL=debug npm start --csv data/ads.csv

# Run with browser in non-headless mode
BROWSER_HEADLESS=false npm start --csv data/ads.csv
```

## 🔒 Security Considerations

- **Credentials**: Store API keys securely, never commit to version control
- **Network**: Use HTTPS for all external API calls
- **Input Validation**: All user inputs are validated and sanitized
- **Rate Limiting**: Implement rate limiting for external API calls
- **Logging**: Avoid logging sensitive information

## 📈 Performance Optimization

### Recommended Settings

For high-volume processing:

```env
CONCURRENT_JOBS=5
BATCH_SIZE=25
BROWSER_HEADLESS=true
CREATE_DATE_FOLDERS=true
```

For resource-constrained environments:

```env
CONCURRENT_JOBS=1
BATCH_SIZE=10
BROWSER_HEADLESS=true
```

### Scaling Considerations

- Use Redis Cluster for distributed queue management
- Implement horizontal scaling with multiple worker instances
- Consider using Docker for containerized deployments
- Monitor memory usage and implement garbage collection tuning

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Add comprehensive tests for new features
- Update documentation for API changes
- Use conventional commit messages
- Ensure all tests pass before submitting

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:

- Create an issue in the GitHub repository
- Check the [troubleshooting section](#-troubleshooting)
- Review the [examples](examples/) directory
- Consult the [API documentation](#-api-reference)

## 📝 Changelog

### v1.0.0
- Initial release with core automation features
- Multi-platform device emulation
- Google Drive integration
- Bookmarklet support
- Chrome extension bridge
- Comprehensive error handling and logging

---

Built with ❤️ using Node.js, TypeScript, Puppeteer, and modern web technologies.