#!/usr/bin/env node

/**
 * Health Check Service
 * Provides HTTP endpoint for health monitoring and detailed system status
 */

const express = require('express');
const redis = require('redis');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');
require('dotenv').config();

class HealthCheckService {
  constructor() {
    this.app = express();
    this.port = process.env.HEALTH_CHECK_PORT || 3001;
    this.redisClient = null;
    this.healthData = {};
    this.startTime = Date.now();
    
    this.setupMiddleware();
    this.setupRoutes();
    this.initializeRedis();
  }

  setupMiddleware() {
    this.app.use(express.json());
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      next();
    });
  }

  setupRoutes() {
    // Basic health check
    this.app.get('/health', (req, res) => {
      const health = this.getBasicHealth();
      res.status(health.status === 'healthy' ? 200 : 503).json(health);
    });

    // Detailed health check
    this.app.get('/health/detailed', async (req, res) => {
      const health = await this.getDetailedHealth();
      res.status(health.overall_status === 'healthy' ? 200 : 503).json(health);
    });

    // System metrics
    this.app.get('/metrics', async (req, res) => {
      const metrics = await this.getSystemMetrics();
      res.json(metrics);
    });

    // Readiness check
    this.app.get('/ready', async (req, res) => {
      const ready = await this.checkReadiness();
      res.status(ready ? 200 : 503).json({ ready });
    });

    // Liveness check
    this.app.get('/live', (req, res) => {
      res.json({ live: true, uptime: Date.now() - this.startTime });
    });

    // Service status
    this.app.get('/status', async (req, res) => {
      const status = await this.getServiceStatus();
      res.json(status);
    });
  }

  async initializeRedis() {
    try {
      this.redisClient = redis.createClient({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
      });

      await this.redisClient.connect();
      console.log('✅ Redis connection established for health checks');
    } catch (error) {
      console.error('❌ Redis connection failed:', error.message);
    }
  }

  getBasicHealth() {
    const uptime = Date.now() - this.startTime;
    const memory = process.memoryUsage();
    
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: uptime,
      memory: {
        rss: Math.round(memory.rss / 1024 / 1024) + 'MB',
        heapUsed: Math.round(memory.heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(memory.heapTotal / 1024 / 1024) + 'MB'
      },
      pid: process.pid,
      node_version: process.version
    };
  }

  async getDetailedHealth() {
    const checks = {
      redis: await this.checkRedis(),
      filesystem: this.checkFilesystem(),
      system_resources: this.checkSystemResources(),
      google_apis: await this.checkGoogleAPIs(),
      chrome: this.checkChrome(),
      logs: this.checkLogs()
    };

    const failedChecks = Object.entries(checks).filter(([_, check]) => !check.healthy);
    const overallStatus = failedChecks.length === 0 ? 'healthy' : 
                         failedChecks.some(([_, check]) => check.critical) ? 'critical' : 'warning';

    return {
      overall_status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      checks,
      failed_checks: failedChecks.map(([name, _]) => name)
    };
  }

  async checkRedis() {
    try {
      if (!this.redisClient) {
        return { healthy: false, critical: true, message: 'Redis client not initialized' };
      }

      await this.redisClient.ping();
      const info = await this.redisClient.info('memory');
      const memoryInfo = this.parseRedisInfo(info);
      
      return {
        healthy: true,
        critical: false,
        message: 'Redis connection successful',
        memory_used: memoryInfo.used_memory_human || 'unknown',
        connected_clients: memoryInfo.connected_clients || 'unknown'
      };
    } catch (error) {
      return {
        healthy: false,
        critical: true,
        message: `Redis check failed: ${error.message}`
      };
    }
  }

  checkFilesystem() {
    try {
      const projectDir = process.cwd();
      const stats = fs.statSync(projectDir);
      
      // Check disk space
      const diskUsage = execSync(`df -h "${projectDir}" | awk 'NR==2 {print $5}'`, { encoding: 'utf8' }).trim();
      const usagePercent = parseInt(diskUsage.replace('%', ''));
      
      const requiredDirs = ['screenshots', 'logs', 'data'];
      const missingDirs = [];
      
      for (const dir of requiredDirs) {
        const dirPath = path.join(projectDir, dir);
        if (!fs.existsSync(dirPath)) {
          missingDirs.push(dir);
        }
      }

      const critical = usagePercent > 95 || missingDirs.length > 0;
      const healthy = usagePercent < 90 && missingDirs.length === 0;

      return {
        healthy,
        critical,
        message: healthy ? 'Filesystem checks passed' : 'Filesystem issues detected',
        disk_usage: diskUsage,
        missing_directories: missingDirs,
        writable: fs.access(projectDir, fs.constants.W_OK) === undefined
      };
    } catch (error) {
      return {
        healthy: false,
        critical: true,
        message: `Filesystem check failed: ${error.message}`
      };
    }
  }

  checkSystemResources() {
    try {
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const memUsagePercent = Math.round((usedMem / totalMem) * 100);
      
      const loadAvg = os.loadavg();
      const cpuCount = os.cpus().length;
      
      const critical = memUsagePercent > 90 || loadAvg[0] > cpuCount * 2;
      const healthy = memUsagePercent < 80 && loadAvg[0] < cpuCount;

      return {
        healthy,
        critical,
        message: healthy ? 'System resources normal' : 'High resource usage detected',
        memory: {
          total: Math.round(totalMem / 1024 / 1024 / 1024) + 'GB',
          free: Math.round(freeMem / 1024 / 1024 / 1024) + 'GB',
          usage_percent: memUsagePercent
        },
        cpu: {
          cores: cpuCount,
          load_1min: loadAvg[0].toFixed(2),
          load_5min: loadAvg[1].toFixed(2),
          load_15min: loadAvg[2].toFixed(2)
        }
      };
    } catch (error) {
      return {
        healthy: false,
        critical: false,
        message: `System resource check failed: ${error.message}`
      };
    }
  }

  async checkGoogleAPIs() {
    if (process.env.ENABLE_DRIVE_UPLOAD !== 'true') {
      return {
        healthy: true,
        critical: false,
        message: 'Google APIs disabled, skipping check'
      };
    }

    try {
      const credentialsPath = process.env.GOOGLE_DRIVE_KEY_FILE;
      if (!credentialsPath || !fs.existsSync(credentialsPath)) {
        return {
          healthy: false,
          critical: false,
          message: 'Google credentials file not found'
        };
      }

      // Basic credential file validation
      const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
      if (!credentials.client_email || !credentials.private_key) {
        return {
          healthy: false,
          critical: false,
          message: 'Invalid Google credentials format'
        };
      }

      return {
        healthy: true,
        critical: false,
        message: 'Google APIs configuration valid',
        service_account: credentials.client_email
      };
    } catch (error) {
      return {
        healthy: false,
        critical: false,
        message: `Google APIs check failed: ${error.message}`
      };
    }
  }

  checkChrome() {
    try {
      const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
      
      if (!fs.existsSync(chromePath)) {
        return {
          healthy: false,
          critical: true,
          message: 'Chrome executable not found'
        };
      }

      // Try to get Chrome version
      const version = execSync(`"${chromePath}" --version 2>/dev/null || echo "unknown"`, { 
        encoding: 'utf8', 
        timeout: 5000 
      }).trim();

      return {
        healthy: true,
        critical: false,
        message: 'Chrome available',
        version: version
      };
    } catch (error) {
      return {
        healthy: false,
        critical: true,
        message: `Chrome check failed: ${error.message}`
      };
    }
  }

  checkLogs() {
    try {
      const logDir = path.join(process.cwd(), 'logs');
      if (!fs.existsSync(logDir)) {
        return {
          healthy: false,
          critical: false,
          message: 'Log directory not found'
        };
      }

      const logFiles = fs.readdirSync(logDir).filter(f => f.endsWith('.log'));
      const totalSize = logFiles.reduce((size, file) => {
        const filePath = path.join(logDir, file);
        const stats = fs.statSync(filePath);
        return size + stats.size;
      }, 0);

      const totalSizeMB = Math.round(totalSize / 1024 / 1024);
      const critical = totalSizeMB > 1000; // 1GB
      const healthy = totalSizeMB < 500; // 500MB

      return {
        healthy,
        critical,
        message: healthy ? 'Log files normal' : 'Large log files detected',
        log_count: logFiles.length,
        total_size: totalSizeMB + 'MB',
        files: logFiles.slice(0, 10) // Show first 10 files
      };
    } catch (error) {
      return {
        healthy: false,
        critical: false,
        message: `Log check failed: ${error.message}`
      };
    }
  }

  async getSystemMetrics() {
    const metrics = {
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      system: {
        platform: os.platform(),
        arch: os.arch(),
        node_version: process.version,
        hostname: os.hostname()
      },
      memory: {
        process: process.memoryUsage(),
        system: {
          total: os.totalmem(),
          free: os.freemem(),
          used: os.totalmem() - os.freemem()
        }
      },
      cpu: {
        cores: os.cpus().length,
        load_average: os.loadavg(),
        model: os.cpus()[0]?.model || 'unknown'
      }
    };

    // Add Redis metrics if available
    if (this.redisClient) {
      try {
        const redisInfo = await this.redisClient.info();
        metrics.redis = this.parseRedisInfo(redisInfo);
      } catch (error) {
        metrics.redis = { error: error.message };
      }
    }

    return metrics;
  }

  async checkReadiness() {
    try {
      // Check critical dependencies
      const redisReady = this.redisClient ? await this.redisClient.ping() === 'PONG' : false;
      const filesystemReady = fs.existsSync(path.join(process.cwd(), 'screenshots'));
      const chromeReady = fs.existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');

      return redisReady && filesystemReady && chromeReady;
    } catch (error) {
      return false;
    }
  }

  async getServiceStatus() {
    const status = {
      service: 'ad-screenshot-automation',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      environment: process.env.NODE_ENV || 'development',
      pid: process.pid,
      memory_usage: process.memoryUsage(),
      active_jobs: 0, // Would be populated by job queue
      total_screenshots: 0 // Would be populated by database/file count
    };

    // Try to get job queue status from Redis
    if (this.redisClient) {
      try {
        const queueKeys = await this.redisClient.keys('bull:*');
        status.queue_status = {
          total_queues: queueKeys.length,
          keys: queueKeys.slice(0, 5) // Show first 5 queue keys
        };
      } catch (error) {
        status.queue_status = { error: error.message };
      }
    }

    return status;
  }

  parseRedisInfo(infoString) {
    const info = {};
    infoString.split('\r\n').forEach(line => {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        info[key] = isNaN(value) ? value : Number(value);
      }
    });
    return info;
  }

  start() {
    this.app.listen(this.port, () => {
      console.log(`🩺 Health check service running on port ${this.port}`);
      console.log(`   Health check: http://localhost:${this.port}/health`);
      console.log(`   Detailed health: http://localhost:${this.port}/health/detailed`);
      console.log(`   Metrics: http://localhost:${this.port}/metrics`);
    });
  }

  async stop() {
    if (this.redisClient) {
      await this.redisClient.quit();
    }
  }
}

// Start service if called directly
if (require.main === module) {
  const healthService = new HealthCheckService();
  healthService.start();

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('Shutting down health check service...');
    await healthService.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('Shutting down health check service...');
    await healthService.stop();
    process.exit(0);
  });
}

module.exports = HealthCheckService;