# Production Deployment Checklist

## Pre-Deployment Preparation

### 1. Environment Validation
- [ ] **System Requirements**
  - [ ] macOS 10.15+ or Linux distribution
  - [ ] Node.js 18.0.0+ installed
  - [ ] Redis 6.0+ installed and running
  - [ ] Chrome/Chromium browser available
  - [ ] Minimum 4GB RAM available
  - [ ] Minimum 10GB disk space available

- [ ] **Dependencies Check**
  - [ ] Run `npm run validate-env`
  - [ ] All required environment variables configured
  - [ ] Google API credentials properly set up (if enabled)
  - [ ] Redis connectivity verified
  - [ ] Chrome automation tested

### 2. Configuration Review
- [ ] **Environment File (.env)**
  - [ ] `NODE_ENV=production`
  - [ ] Proper Redis connection settings
  - [ ] Secure browser configuration
  - [ ] Appropriate concurrency settings
  - [ ] Log levels configured for production
  - [ ] Storage paths configured
  - [ ] Notification settings configured

- [ ] **Security Settings**
  - [ ] Credentials file permissions set to 600
  - [ ] .env file not in version control
  - [ ] API keys and secrets properly secured
  - [ ] Network access restricted if needed
  - [ ] File system permissions properly set

### 3. Performance Optimization
- [ ] **Resource Limits**
  - [ ] `CONCURRENT_JOBS` set based on system capacity
  - [ ] `BATCH_SIZE` optimized for memory usage
  - [ ] `MAX_RETRIES` configured appropriately
  - [ ] Browser timeout values set
  - [ ] Memory limits configured

- [ ] **Storage Configuration**
  - [ ] Screenshot storage path configured
  - [ ] Log rotation enabled
  - [ ] Backup strategy implemented
  - [ ] Cleanup policies defined

## Deployment Process

### 1. Code Preparation
```bash
# Clone or update repository
git clone <repository-url> /opt/ad-screenshot-automation
cd /opt/ad-screenshot-automation

# Install production dependencies
npm ci --only=production

# Build TypeScript
npm run build

# Validate build
npm run validate-env
```

### 2. Directory Structure Setup
```bash
# Create production directories
sudo mkdir -p /var/log/ad-screenshot
sudo mkdir -p /var/lib/ad-screenshot/screenshots
sudo mkdir -p /var/lib/ad-screenshot/data
sudo mkdir -p /var/lib/ad-screenshot/backups
sudo mkdir -p /etc/ad-screenshot

# Set ownership and permissions
sudo chown -R adscreenshot:adscreenshot /var/log/ad-screenshot
sudo chown -R adscreenshot:adscreenshot /var/lib/ad-screenshot
sudo chmod 755 /var/log/ad-screenshot
sudo chmod 755 /var/lib/ad-screenshot
sudo chmod 700 /var/lib/ad-screenshot/credentials
```

### 3. User Account Setup
```bash
# Create dedicated user account
sudo useradd -r -m -d /opt/ad-screenshot-automation -s /bin/bash adscreenshot
sudo usermod -a -G adscreenshot adscreenshot

# Set up user environment
sudo -u adscreenshot cp .env.example .env
# Edit .env with production settings
```

### 4. Service Configuration
```bash
# Create systemd service file
sudo tee /etc/systemd/system/ad-screenshot.service << EOF
[Unit]
Description=Ad Screenshot Automation System
After=network.target redis.service
Wants=redis.service

[Service]
Type=simple
User=adscreenshot
Group=adscreenshot
WorkingDirectory=/opt/ad-screenshot-automation
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
StandardOutput=journal
StandardError=journal
SyslogIdentifier=ad-screenshot

# Resource limits
LimitNOFILE=65536
LimitNPROC=4096

# Security settings
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/log/ad-screenshot /var/lib/ad-screenshot

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable ad-screenshot
sudo systemctl start ad-screenshot
```

### 5. Health Check Service
```bash
# Create health check service
sudo tee /etc/systemd/system/ad-screenshot-health.service << EOF
[Unit]
Description=Ad Screenshot Health Check Service
After=network.target

[Service]
Type=simple
User=adscreenshot
Group=adscreenshot
WorkingDirectory=/opt/ad-screenshot-automation
ExecStart=/usr/bin/node scripts/health-check.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable ad-screenshot-health
sudo systemctl start ad-screenshot-health
```

## Post-Deployment Verification

### 1. Service Status Check
```bash
# Check main service
sudo systemctl status ad-screenshot

# Check health service
sudo systemctl status ad-screenshot-health

# View logs
sudo journalctl -u ad-screenshot -f
sudo journalctl -u ad-screenshot-health -f
```

### 2. Health Verification
```bash
# Test health endpoint
curl http://localhost:3001/health

# Test detailed health
curl http://localhost:3001/health/detailed

# Run full validation
sudo -u adscreenshot node scripts/validate-environment.js
```

### 3. Functionality Tests
```bash
# Test Google APIs (if enabled)
sudo -u adscreenshot node scripts/test-google-apis.js

# Test basic screenshot functionality
sudo -u adscreenshot node -e "
const { ScreenshotManager } = require('./dist/services/ScreenshotManager');
const manager = new ScreenshotManager();
manager.captureScreenshot('https://example.com', { deviceType: 'Desktop' })
  .then(() => console.log('✅ Screenshot test successful'))
  .catch(console.error);
"
```

### 4. Monitoring Setup
```bash
# Start metrics collection
sudo -u adscreenshot node scripts/monitoring/metrics-collector.js start &

# Test alerting system
sudo -u adscreenshot node scripts/monitoring/alerting.js check
```

## Cron Jobs Setup (Production)

### 1. Install Cron Jobs
```bash
# Switch to service user
sudo -u adscreenshot crontab -e

# Add production cron jobs
# Main automation - runs daily at 2 AM
0 2 * * * /opt/ad-screenshot-automation/scripts/cron/run-automation.sh >> /var/log/ad-screenshot/cron.log 2>&1

# Health check - runs every 5 minutes
*/5 * * * * /opt/ad-screenshot-automation/scripts/cron/health-check.sh >> /var/log/ad-screenshot/health.log 2>&1

# Log rotation - runs daily at 1 AM
0 1 * * * /opt/ad-screenshot-automation/scripts/cron/rotate-logs.sh >> /var/log/ad-screenshot/cron.log 2>&1

# Cleanup - runs weekly on Sunday at 3 AM
0 3 * * 0 /opt/ad-screenshot-automation/scripts/cron/cleanup.sh >> /var/log/ad-screenshot/cron.log 2>&1

# Backup - runs daily at 4 AM
0 4 * * * /opt/ad-screenshot-automation/scripts/cron/backup.sh >> /var/log/ad-screenshot/cron.log 2>&1

# Metrics collection - runs every 5 minutes
*/5 * * * * cd /opt/ad-screenshot-automation && node scripts/monitoring/metrics-collector.js collect >> /var/log/ad-screenshot/metrics.log 2>&1

# Alerting check - runs every minute
* * * * * cd /opt/ad-screenshot-automation && node scripts/monitoring/alerting.js check >> /var/log/ad-screenshot/alerts.log 2>&1
```

### 2. Verify Cron Installation
```bash
# List cron jobs
sudo -u adscreenshot crontab -l

# Test cron scripts manually
sudo -u adscreenshot /opt/ad-screenshot-automation/scripts/cron/health-check.sh
```

## Security Hardening

### 1. File Permissions
```bash
# Set secure permissions
sudo chmod 600 /opt/ad-screenshot-automation/.env
sudo chmod 600 /opt/ad-screenshot-automation/credentials/*
sudo chmod 755 /opt/ad-screenshot-automation/scripts/cron/*.sh
sudo chmod 644 /opt/ad-screenshot-automation/logs/*.log
```

### 2. Network Security
```bash
# Configure firewall (if needed)
sudo ufw allow from localhost to any port 3001  # Health check
sudo ufw allow from localhost to any port 6379  # Redis

# Block external access to internal services
sudo ufw deny 3001
sudo ufw deny 6379
```

### 3. Log Security
```bash
# Set up log rotation with secure permissions
sudo tee /etc/logrotate.d/ad-screenshot << EOF
/var/log/ad-screenshot/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 adscreenshot adscreenshot
    postrotate
        systemctl reload ad-screenshot
    endscript
}
EOF
```

## Monitoring and Alerting

### 1. System Monitoring
```bash
# Install monitoring tools
sudo npm install -g pm2

# Use PM2 for process monitoring
sudo -u adscreenshot pm2 start dist/index.js --name "ad-screenshot-main"
sudo -u adscreenshot pm2 start scripts/health-check.js --name "ad-screenshot-health"
sudo -u adscreenshot pm2 save
sudo -u adscreenshot pm2 startup
```

### 2. Log Monitoring
```bash
# Set up log monitoring with journalctl
sudo tee /etc/systemd/journald.conf.d/ad-screenshot.conf << EOF
[Journal]
SystemMaxUse=1G
SystemMaxFileSize=128M
SystemMaxFiles=100
EOF

sudo systemctl restart systemd-journald
```

### 3. Alerting Configuration
- [ ] **Email Notifications**
  - [ ] SMTP settings configured
  - [ ] Test email alerts
  - [ ] Emergency contact list updated

- [ ] **Slack Integration**
  - [ ] Webhook URL configured
  - [ ] Channel notifications set up
  - [ ] Alert routing configured

- [ ] **Health Check Monitoring**
  - [ ] External monitoring service configured
  - [ ] Uptime checks enabled
  - [ ] Response time monitoring active

## Backup and Recovery

### 1. Backup Strategy
- [ ] **Automated Backups**
  - [ ] Daily configuration backups
  - [ ] Weekly screenshot archives
  - [ ] Monthly full system backups
  - [ ] Backup retention policy defined

- [ ] **Backup Storage**
  - [ ] Local backup directory configured
  - [ ] Google Drive backup enabled (if applicable)
  - [ ] Off-site backup storage configured
  - [ ] Backup integrity verification

### 2. Recovery Procedures
```bash
# Create recovery script
sudo tee /opt/ad-screenshot-automation/scripts/recovery.sh << 'EOF'
#!/bin/bash
# Emergency recovery script

set -e

BACKUP_DIR="/var/lib/ad-screenshot/backups"
LATEST_BACKUP=$(ls -t $BACKUP_DIR/*.tar.gz | head -1)

echo "Restoring from backup: $LATEST_BACKUP"

# Stop services
systemctl stop ad-screenshot ad-screenshot-health

# Restore configuration
tar -xzf "$LATEST_BACKUP" -C /opt/ad-screenshot-automation/

# Restart services
systemctl start ad-screenshot ad-screenshot-health

echo "Recovery completed"
EOF

sudo chmod +x /opt/ad-screenshot-automation/scripts/recovery.sh
```

## Performance Tuning

### 1. System Optimization
```bash
# Increase file descriptor limits
echo "adscreenshot soft nofile 65536" | sudo tee -a /etc/security/limits.conf
echo "adscreenshot hard nofile 65536" | sudo tee -a /etc/security/limits.conf

# Optimize Redis configuration
sudo tee -a /etc/redis/redis.conf << EOF
# Ad Screenshot Automation optimizations
maxmemory 512mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
stop-writes-on-bgsave-error no
EOF

sudo systemctl restart redis
```

### 2. Application Optimization
```bash
# Update production .env with optimized settings
sudo -u adscreenshot tee -a /opt/ad-screenshot-automation/.env << EOF

# Production optimizations
NODE_OPTIONS=--max-old-space-size=2048
CONCURRENT_JOBS=2
BATCH_SIZE=25
BROWSER_HEADLESS=true
SCREENSHOT_TIMEOUT=15000
MAX_RETRIES=2
EOF
```

## Maintenance Procedures

### 1. Regular Maintenance Tasks
- [ ] **Daily**
  - [ ] Check service status
  - [ ] Review error logs
  - [ ] Verify disk space
  - [ ] Check backup completion

- [ ] **Weekly**
  - [ ] Review performance metrics
  - [ ] Clean up old files
  - [ ] Test disaster recovery
  - [ ] Update dependencies (if needed)

- [ ] **Monthly**
  - [ ] Security audit
  - [ ] Performance optimization review
  - [ ] Capacity planning
  - [ ] Documentation updates

### 2. Update Procedures
```bash
# Create update script
sudo tee /opt/ad-screenshot-automation/scripts/update.sh << 'EOF'
#!/bin/bash
# Production update script

set -e

echo "Starting production update..."

# Stop services
systemctl stop ad-screenshot ad-screenshot-health

# Backup current installation
tar -czf /var/lib/ad-screenshot/backups/pre-update-$(date +%Y%m%d).tar.gz \
    -C /opt/ad-screenshot-automation .

# Pull latest changes
git pull origin main

# Update dependencies
npm ci --only=production

# Build application
npm run build

# Run validation
npm run validate-env

# Start services
systemctl start ad-screenshot ad-screenshot-health

# Verify deployment
sleep 10
curl http://localhost:3001/health

echo "Update completed successfully"
EOF

sudo chmod +x /opt/ad-screenshot-automation/scripts/update.sh
```

## Troubleshooting

### 1. Common Issues
- [ ] **Service Won't Start**
  - Check systemd logs: `journalctl -u ad-screenshot -n 50`
  - Verify environment variables
  - Check file permissions
  - Validate configuration

- [ ] **High Memory Usage**
  - Reduce `CONCURRENT_JOBS`
  - Lower `BATCH_SIZE`
  - Restart services periodically
  - Monitor for memory leaks

- [ ] **Redis Connection Issues**
  - Check Redis status: `systemctl status redis`
  - Verify connection settings
  - Test connectivity: `redis-cli ping`
  - Check firewall rules

### 2. Emergency Procedures
```bash
# Emergency service restart
sudo systemctl restart ad-screenshot ad-screenshot-health

# Force kill and restart
sudo pkill -f "ad-screenshot"
sudo systemctl start ad-screenshot

# Emergency disk cleanup
sudo /opt/ad-screenshot-automation/scripts/cron/cleanup.sh

# Restore from backup
sudo /opt/ad-screenshot-automation/scripts/recovery.sh
```

## Final Verification Checklist

- [ ] Main service running and healthy
- [ ] Health check service responding
- [ ] All cron jobs installed and scheduled
- [ ] Monitoring and alerting active
- [ ] Backups configured and tested
- [ ] Security hardening applied
- [ ] Performance optimizations in place
- [ ] Documentation updated
- [ ] Team notified of deployment
- [ ] Rollback plan prepared

## Post-Deployment Monitoring

### First 24 Hours
- [ ] Monitor service logs continuously
- [ ] Check health endpoints every 15 minutes
- [ ] Verify first automated run completion
- [ ] Confirm alerting is working
- [ ] Monitor system resources

### First Week
- [ ] Review error patterns
- [ ] Analyze performance metrics
- [ ] Validate backup operations
- [ ] Fine-tune configuration if needed
- [ ] Document any issues and resolutions

This completes the production deployment checklist. Ensure all items are verified before considering the deployment successful.