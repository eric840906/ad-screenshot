# Cron Job Setup Guide

## Overview

This guide covers setting up automated cron jobs for the Ad Screenshot Automation System on macOS. It includes error handling, notifications, log rotation, and health checks.

## Prerequisites

- Completed environment setup
- Working Google API credentials (if uploads enabled)
- Redis service running
- Proper file permissions

## Cron Job Architecture

### Job Types
1. **Main Screenshot Job**: Daily screenshot capture and processing
2. **Health Check Job**: System health monitoring (every 5 minutes)
3. **Log Rotation Job**: Clean up old logs (daily)
4. **Cleanup Job**: Remove old screenshots and data (weekly)
5. **Backup Job**: Backup configuration and logs (daily)

## Setup Instructions

### 1. Create Cron Scripts Directory
```bash
mkdir -p /Users/ericchiu/playground/ad-screenshot/scripts/cron
chmod 755 /Users/ericchiu/playground/ad-screenshot/scripts/cron
```

### 2. Main Automation Script
This script runs the main screenshot automation with comprehensive error handling.

### 3. Health Check Script
Monitors system health and sends alerts if issues are detected.

### 4. Log Rotation Script
Manages log files to prevent disk space issues.

### 5. Cleanup Script
Removes old files and maintains system cleanliness.

### 6. Install Cron Jobs
```bash
# Open crontab for editing
crontab -e

# Add the following lines (adjust paths as needed):

# Main screenshot automation - runs daily at 2 AM
0 2 * * * /Users/ericchiu/playground/ad-screenshot/scripts/cron/run-automation.sh >> /Users/ericchiu/playground/ad-screenshot/logs/cron.log 2>&1

# Health check - runs every 5 minutes
*/5 * * * * /Users/ericchiu/playground/ad-screenshot/scripts/cron/health-check.sh >> /Users/ericchiu/playground/ad-screenshot/logs/health.log 2>&1

# Log rotation - runs daily at 1 AM
0 1 * * * /Users/ericchiu/playground/ad-screenshot/scripts/cron/rotate-logs.sh >> /Users/ericchiu/playground/ad-screenshot/logs/cron.log 2>&1

# Cleanup old files - runs weekly on Sunday at 3 AM
0 3 * * 0 /Users/ericchiu/playground/ad-screenshot/scripts/cron/cleanup.sh >> /Users/ericchiu/playground/ad-screenshot/logs/cron.log 2>&1

# System backup - runs daily at 4 AM
0 4 * * * /Users/ericchiu/playground/ad-screenshot/scripts/cron/backup.sh >> /Users/ericchiu/playground/ad-screenshot/logs/cron.log 2>&1
```

### 7. Verify Cron Installation
```bash
# List current cron jobs
crontab -l

# Check cron service status
sudo launchctl list | grep cron
```

## Error Handling and Notifications

### Email Notifications
Configure SMTP settings in `.env`:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
NOTIFICATION_EMAIL=alerts@your-company.com
```

### Slack Notifications
Add Slack webhook to `.env`:
```env
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
```

### Notification Triggers
- Job failures
- System health issues
- Disk space warnings
- Redis connectivity problems
- API quota exceeded

## Monitoring and Health Checks

### Health Check Metrics
- System resources (CPU, memory, disk)
- Redis connectivity
- Browser automation status
- Google API accessibility
- Log file sizes
- Screenshot directory status

### Alerting Thresholds
```env
# Disk space warning threshold (%)
DISK_SPACE_WARNING=85
DISK_SPACE_CRITICAL=95

# Memory usage warning threshold (%)
MEMORY_WARNING=80
MEMORY_CRITICAL=90

# Log file size warning (MB)
LOG_SIZE_WARNING=100
LOG_SIZE_CRITICAL=500

# Health check failure threshold
HEALTH_CHECK_FAILURES=3
```

## Log Management

### Log Rotation Configuration
- Application logs: Keep 30 days
- Cron logs: Keep 7 days
- Error logs: Keep 90 days
- Debug logs: Keep 3 days

### Log Compression
Logs older than 1 day are automatically compressed using gzip.

### Log Location Structure
```
logs/
├── app.log                 # Current application log
├── app.log.1.gz           # Previous day (compressed)
├── app.log.2.gz           # 2 days ago
├── cron.log               # Cron job logs
├── health.log             # Health check logs
├── error.log              # Error-only logs
└── debug.log              # Debug logs (if enabled)
```

## Backup Strategy

### What Gets Backed Up
- Configuration files (.env, package.json)
- Credentials (encrypted)
- Recent logs (last 7 days)
- Processing statistics
- Error reports

### Backup Locations
- Local: `/Users/ericchiu/playground/ad-screenshot/backups/`
- Google Drive: `Backups/Ad-Screenshot-System/`

### Backup Retention
- Daily backups: Keep 30 days
- Weekly backups: Keep 12 weeks
- Monthly backups: Keep 12 months

## Performance Optimization

### Resource Management
```bash
# Set process limits
ulimit -n 4096  # File descriptors
ulimit -u 2048  # User processes
```

### Memory Management
```env
# Node.js memory settings
NODE_OPTIONS=--max-old-space-size=2048

# Puppeteer settings
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
PUPPETEER_EXECUTABLE_PATH=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome
```

### Concurrency Settings
```env
# Adjust based on system capabilities
CONCURRENT_JOBS=2          # For systems with 4GB+ RAM
BATCH_SIZE=25              # Smaller batches for stability
MAX_RETRIES=2              # Reduce retry overhead
```

## Troubleshooting

### Common Cron Issues

#### Cron Jobs Not Running
```bash
# Check cron service
sudo launchctl list | grep cron

# Restart cron service (if needed)
sudo launchctl stop com.vix.cron
sudo launchctl start com.vix.cron

# Check system logs
tail -f /var/log/system.log | grep cron
```

#### Permission Denied Errors
```bash
# Fix script permissions
chmod +x /Users/ericchiu/playground/ad-screenshot/scripts/cron/*.sh

# Fix directory permissions
chmod 755 /Users/ericchiu/playground/ad-screenshot/logs
chmod 755 /Users/ericchiu/playground/ad-screenshot/screenshots
```

#### Environment Variables Not Available
Cron has a minimal environment. Scripts should:
1. Source environment variables explicitly
2. Use absolute paths
3. Set proper PATH variable

#### Node.js Not Found
```bash
# Add to cron scripts
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"
export NODE_PATH="/usr/local/lib/node_modules"
```

### Debugging Cron Jobs

#### Enable Verbose Logging
```bash
# Add to cron scripts
set -x  # Enable debug mode
exec > >(tee -a /path/to/debug.log)
exec 2>&1
```

#### Test Scripts Manually
```bash
# Test automation script
/Users/ericchiu/playground/ad-screenshot/scripts/cron/run-automation.sh

# Test health check
/Users/ericchiu/playground/ad-screenshot/scripts/cron/health-check.sh
```

#### Monitor Resource Usage
```bash
# Monitor during cron execution
top -pid $(pgrep -f "node.*ad-screenshot")

# Check disk space
df -h /Users/ericchiu/playground/ad-screenshot
```

## Security Considerations

### Credential Protection
- Credentials are never logged
- Environment variables are properly quoted
- File permissions are restrictive (600 for sensitive files)

### Network Security
- API calls use HTTPS
- Rate limiting is implemented
- Request timeouts are configured

### Process Isolation
- Each job runs with minimal privileges
- Temporary files are cleaned up
- Process limits are enforced

## Maintenance Tasks

### Weekly Tasks
- Review error logs
- Check disk space usage
- Verify backup integrity
- Update dependencies (if needed)

### Monthly Tasks
- Rotate API keys
- Review performance metrics
- Update documentation
- Test disaster recovery procedures

### Quarterly Tasks
- Security audit
- Performance optimization review
- Capacity planning
- Tool updates

This completes the cron job setup. The system will now run automatically with comprehensive error handling and monitoring.