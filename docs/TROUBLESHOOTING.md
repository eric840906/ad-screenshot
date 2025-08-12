# Troubleshooting Guide

## Quick Diagnostic Commands

### System Health Check
```bash
# Run comprehensive environment validation
npm run validate-env

# Check health status
curl http://localhost:3001/health/detailed

# Check service status
sudo systemctl status ad-screenshot ad-screenshot-health

# View recent logs
tail -f logs/app.log
tail -f logs/error.log
```

### Resource Monitoring
```bash
# Check disk space
df -h /Users/ericchiu/playground/ad-screenshot

# Check memory usage
ps aux | grep node
top -pid $(pgrep -f "ad-screenshot")

# Check Redis status
redis-cli ping
redis-cli info memory

# Check Chrome processes
ps aux | grep chrome
```

## Common Issues and Solutions

### 1. Application Won't Start

#### Symptoms
- Service fails to start
- "Cannot find module" errors
- Port already in use errors

#### Diagnostic Commands
```bash
# Check if port is in use
lsof -i :3000
lsof -i :3001

# Check Node.js installation
node --version
npm --version

# Verify project structure
ls -la dist/
ls -la node_modules/
```

#### Solutions
```bash
# Kill processes using ports
sudo lsof -ti:3000 | xargs kill -9
sudo lsof -ti:3001 | xargs kill -9

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Rebuild TypeScript
npm run clean
npm run build

# Check environment file
cp .env.example .env
# Edit .env with correct settings
```

### 2. Redis Connection Issues

#### Symptoms
- "Redis connection failed" errors
- Jobs not processing
- Health check failures

#### Diagnostic Commands
```bash
# Check Redis service
brew services list | grep redis
redis-cli ping

# Check Redis logs
tail -f /usr/local/var/log/redis/redis-server.log

# Check connection settings
echo $REDIS_HOST $REDIS_PORT
```

#### Solutions
```bash
# Start Redis service
brew services start redis

# Restart Redis
brew services restart redis

# Check Redis configuration
redis-cli config get "*"

# Test connection with specific settings
redis-cli -h localhost -p 6379 ping

# Clear Redis data if corrupted
redis-cli flushall
```

### 3. Chrome/Puppeteer Issues

#### Symptoms
- "Chrome executable not found"
- Browser launch failures
- Screenshot timeouts
- Zombie Chrome processes

#### Diagnostic Commands
```bash
# Check Chrome installation
ls -la "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --version

# Check Chrome processes
ps aux | grep -i chrome
pgrep -f chrome

# Check system resources
vm_stat | grep "Pages free"
```

#### Solutions
```bash
# Install Chrome if missing
brew install --cask google-chrome

# Kill zombie Chrome processes
sudo pkill -f chrome
sudo pkill -f "Chrome Helper"

# Clear Chrome temporary files
rm -rf /tmp/.com.google.Chrome*
rm -rf ~/Library/Caches/Google/Chrome/

# Set Chrome executable path
export CHROME_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# Test Puppeteer launch
node -e "
const puppeteer = require('puppeteer');
puppeteer.launch({headless: true}).then(browser => {
  console.log('✅ Chrome launched successfully');
  return browser.close();
}).catch(console.error);
"
```

### 4. Memory Issues

#### Symptoms
- Out of memory errors
- System freezing
- Slow performance
- Process crashes

#### Diagnostic Commands
```bash
# Check memory usage
free -h  # Linux
vm_stat  # macOS

# Monitor Node.js memory
node -e "console.log(process.memoryUsage())"

# Check for memory leaks
top -pid $(pgrep -f "ad-screenshot")
```

#### Solutions
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Reduce concurrent jobs
# Edit .env file:
CONCURRENT_JOBS=1
BATCH_SIZE=10

# Enable garbage collection
node --expose-gc dist/index.js

# Monitor memory with detailed logging
LOG_LEVEL=debug npm start
```

### 5. Disk Space Issues

#### Symptoms
- "No space left on device" errors
- Failed file operations
- Backup failures

#### Diagnostic Commands
```bash
# Check disk usage
df -h
du -sh screenshots/
du -sh logs/

# Find large files
find . -size +100M -type f -exec ls -lh {} \;

# Check inode usage
df -i
```

#### Solutions
```bash
# Run cleanup immediately
./scripts/cron/cleanup.sh

# Compress old screenshots
find screenshots/ -name "*.png" -mtime +7 -exec gzip {} \;

# Rotate logs immediately
./scripts/cron/rotate-logs.sh

# Clear temporary files
rm -rf /tmp/ad-screenshot-*
rm -rf screenshots/temp/
```

### 6. Google API Issues

#### Symptoms
- "Authentication failed" errors
- Upload failures
- Quota exceeded errors

#### Diagnostic Commands
```bash
# Test Google API connectivity
node scripts/test-google-apis.js

# Check credentials file
cat credentials/google-drive-key.json | python -m json.tool

# Check API quota
# (Check Google Cloud Console for quota usage)
```

#### Solutions
```bash
# Regenerate credentials
# 1. Go to Google Cloud Console
# 2. Create new service account key
# 3. Download and replace credentials file

# Fix file permissions
chmod 600 credentials/google-drive-key.json

# Test with minimal permissions
node -e "
const { google } = require('googleapis');
const fs = require('fs');
const credentials = JSON.parse(fs.readFileSync('credentials/google-drive-key.json'));
const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/drive.file'] });
auth.getClient().then(() => console.log('✅ Auth successful')).catch(console.error);
"

# Check folder permissions
# Ensure service account has access to the target folder
```

### 7. Network and Connectivity Issues

#### Symptoms
- Request timeouts
- DNS resolution failures
- SSL/TLS errors

#### Diagnostic Commands
```bash
# Test internet connectivity
ping google.com
curl -I https://example.com

# Check DNS resolution
nslookup example.com
dig example.com

# Test specific URLs
curl -v https://www.google.com
```

#### Solutions
```bash
# Configure proxy if needed
export HTTP_PROXY=http://proxy.company.com:8080
export HTTPS_PROXY=http://proxy.company.com:8080

# Use alternative DNS
echo "nameserver 8.8.8.8" | sudo tee /etc/resolv.conf

# Disable SSL verification (temporary)
export NODE_TLS_REJECT_UNAUTHORIZED=0

# Test with increased timeouts
# Edit .env:
BROWSER_TIMEOUT=60000
SCREENSHOT_TIMEOUT=30000
```

### 8. Permission Issues

#### Symptoms
- "Permission denied" errors
- File creation failures
- Service start failures

#### Diagnostic Commands
```bash
# Check file permissions
ls -la .env
ls -la credentials/
ls -la screenshots/

# Check user permissions
whoami
groups
```

#### Solutions
```bash
# Fix directory permissions
chmod 755 screenshots logs data
chmod 600 .env
chmod 600 credentials/*.json

# Fix ownership
sudo chown -R $(whoami) .

# Fix script permissions
chmod +x scripts/cron/*.sh
chmod +x scripts/*.js
```

### 9. Cron Job Issues

#### Symptoms
- Scheduled jobs not running
- Cron execution failures
- Missing environment variables

#### Diagnostic Commands
```bash
# Check cron service
sudo launchctl list | grep cron

# List cron jobs
crontab -l

# Check cron logs
grep CRON /var/log/system.log
tail -f logs/cron.log
```

#### Solutions
```bash
# Restart cron service
sudo launchctl stop com.vix.cron
sudo launchctl start com.vix.cron

# Fix cron environment
# Add to crontab:
PATH=/usr/local/bin:/usr/bin:/bin
NODE_ENV=production

# Test cron script manually
/path/to/script/run-automation.sh

# Check script permissions
chmod +x scripts/cron/*.sh

# Verify script paths are absolute
# Edit cron scripts to use full paths
```

### 10. Performance Issues

#### Symptoms
- Slow screenshot capture
- High CPU usage
- Long processing times
- Timeouts

#### Diagnostic Commands
```bash
# Monitor performance
top -pid $(pgrep -f "ad-screenshot")
iostat 1 5

# Check process metrics
ps -o pid,ppid,cmd,%mem,%cpu -p $(pgrep -f "ad-screenshot")

# Profile application
node --prof dist/index.js
```

#### Solutions
```bash
# Optimize configuration
# Edit .env:
CONCURRENT_JOBS=2  # Reduce from default
BATCH_SIZE=10      # Reduce from default
SCREENSHOT_TIMEOUT=15000

# Enable performance monitoring
LOG_LEVEL=debug
VERBOSE_LOGGING=true

# Use headless Chrome
BROWSER_HEADLESS=true

# Optimize Chrome flags
# Add to browser args:
--disable-gpu
--disable-dev-shm-usage
--disable-background-timer-throttling
```

## Advanced Debugging

### 1. Enable Debug Mode
```bash
# Set debug environment
export DEBUG=puppeteer:*,ad-screenshot:*
export LOG_LEVEL=debug
export VERBOSE_LOGGING=true

# Run with debug output
npm run dev
```

### 2. Memory Profiling
```bash
# Generate heap snapshot
node --inspect dist/index.js
# Connect Chrome DevTools to inspect memory

# Use heapdump module
npm install heapdump
node -r heapdump dist/index.js
```

### 3. Performance Profiling
```bash
# CPU profiling
node --prof dist/index.js
node --prof-process isolate-*.log > processed.txt

# Continuous monitoring
node scripts/monitoring/metrics-collector.js start
```

### 4. Network Debugging
```bash
# Capture network traffic
tcpdump -i any -w capture.pcap port 443

# Monitor DNS lookups
sudo dscacheutil -flushcache
dscacheutil -q host -a name example.com
```

## Error Code Reference

### Exit Codes
- **0**: Success
- **1**: General error
- **2**: Critical system error
- **3**: Configuration error
- **4**: Network error
- **5**: Resource exhaustion
- **6**: Service unavailable

### HTTP Status Codes
- **200**: Healthy
- **503**: Service unavailable
- **500**: Internal error
- **408**: Request timeout
- **429**: Rate limited

## Log Analysis

### Log Locations
```bash
logs/app.log          # Application logs
logs/error.log        # Error logs
logs/health.log       # Health check logs
logs/cron.log         # Cron job logs
logs/alerts.log       # Alert logs
logs/metrics.jsonl    # Metrics data
```

### Log Analysis Commands
```bash
# Count errors by type
grep "ERROR" logs/app.log | cut -d' ' -f4- | sort | uniq -c

# Find memory-related errors
grep -i "memory\|heap\|allocation" logs/error.log

# Analyze response times
grep "response_time" logs/metrics.jsonl | jq '.performance.response_times'

# Find failed screenshots
grep "screenshot.*failed" logs/app.log

# Monitor real-time
tail -f logs/app.log | grep ERROR
```

## Recovery Procedures

### 1. Service Recovery
```bash
# Stop all services
sudo systemctl stop ad-screenshot ad-screenshot-health

# Clean up processes
sudo pkill -f "ad-screenshot"
sudo pkill -f chrome

# Clean temporary files
rm -rf /tmp/ad-screenshot-*

# Restart services
sudo systemctl start ad-screenshot ad-screenshot-health

# Verify recovery
curl http://localhost:3001/health
```

### 2. Data Recovery
```bash
# Restore from backup
tar -xzf backups/latest-backup.tar.gz

# Restore specific files
cp backups/config/* .
cp backups/credentials/* credentials/

# Rebuild if needed
npm install
npm run build
```

### 3. Emergency Reset
```bash
# Complete reset (use with caution)
sudo systemctl stop ad-screenshot ad-screenshot-health
rm -rf node_modules dist logs/*.log
npm install
npm run build
npm run validate-env
sudo systemctl start ad-screenshot ad-screenshot-health
```

## Getting Help

### 1. Collect Diagnostic Information
```bash
# Generate diagnostic report
cat > diagnostic-report.txt << EOF
=== SYSTEM INFO ===
$(uname -a)
$(node --version)
$(npm --version)
$(redis-cli --version 2>/dev/null || echo "Redis not available")

=== SERVICE STATUS ===
$(sudo systemctl status ad-screenshot 2>&1 || echo "systemctl not available")

=== RECENT LOGS ===
$(tail -20 logs/error.log 2>/dev/null || echo "No error log")

=== HEALTH CHECK ===
$(curl -s http://localhost:3001/health/detailed 2>/dev/null || echo "Health check unavailable")

=== DISK SPACE ===
$(df -h .)

=== MEMORY USAGE ===
$(free -h 2>/dev/null || vm_stat | head -10)

=== PROCESS INFO ===
$(ps aux | grep -E "node|chrome|redis" | head -10)
EOF

echo "Diagnostic report saved to diagnostic-report.txt"
```

### 2. Enable Support Mode
```bash
# Create support configuration
cp .env .env.backup
cat >> .env << EOF

# Support mode settings
DEBUG_MODE=true
VERBOSE_LOGGING=true
SAVE_DEBUG_SCREENSHOTS=true
LOG_LEVEL=debug
EOF

# Restart with support mode
npm restart
```

### 3. Remote Debugging
```bash
# Enable remote debugging
node --inspect=0.0.0.0:9229 dist/index.js

# Enable SSH access (if needed)
sudo systemctl enable ssh
sudo systemctl start ssh
```

## Prevention Strategies

### 1. Monitoring Setup
```bash
# Set up continuous monitoring
node scripts/monitoring/metrics-collector.js start &
node scripts/monitoring/alerting.js check

# Schedule regular health checks
echo "*/5 * * * * curl -s http://localhost:3001/health > /dev/null || echo 'Health check failed' | logger" | crontab -
```

### 2. Proactive Maintenance
```bash
# Daily maintenance script
cat > daily-maintenance.sh << 'EOF'
#!/bin/bash
# Check disk space
df -h | awk '$5 > 80 {print "High disk usage: " $0}' | logger

# Check memory usage
free | awk 'NR==2{printf "Memory usage: %.2f%%\n", $3*100/$2}' | logger

# Clean temporary files
find /tmp -name "*ad-screenshot*" -mtime +1 -delete

# Rotate logs if needed
if [ $(stat -f%z logs/app.log) -gt 104857600 ]; then  # 100MB
    ./scripts/cron/rotate-logs.sh
fi
EOF

chmod +x daily-maintenance.sh
```

### 3. Backup Verification
```bash
# Verify backups regularly
./scripts/test-backup-integrity.sh

# Test recovery procedure monthly
./scripts/test-recovery.sh
```

This troubleshooting guide covers the most common issues and provides systematic approaches to diagnosing and resolving problems with the Ad Screenshot Automation System.