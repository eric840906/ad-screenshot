#!/usr/bin/env node

/**
 * Metrics Collector
 * Collects and stores performance metrics for monitoring and analysis
 */

const fs = require('fs');
const path = require('path');
const redis = require('redis');
const { execSync } = require('child_process');
const os = require('os');
require('dotenv').config();

class MetricsCollector {
  constructor() {
    this.redisClient = null;
    this.metricsFile = path.join(process.cwd(), 'logs', 'metrics.jsonl');
    this.startTime = Date.now();
    this.collectInterval = parseInt(process.env.METRICS_INTERVAL) || 60000; // 1 minute
    this.retentionDays = parseInt(process.env.METRICS_RETENTION_DAYS) || 30;
    
    this.initializeRedis();
  }

  async initializeRedis() {
    try {
      this.redisClient = redis.createClient({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
      });

      await this.redisClient.connect();
      console.log('✅ Redis connection established for metrics collection');
    } catch (error) {
      console.error('❌ Redis connection failed:', error.message);
    }
  }

  async collectSystemMetrics() {
    const timestamp = new Date().toISOString();
    
    const metrics = {
      timestamp,
      type: 'system',
      cpu: this.getCPUMetrics(),
      memory: this.getMemoryMetrics(),
      disk: await this.getDiskMetrics(),
      network: await this.getNetworkMetrics(),
      process: this.getProcessMetrics()
    };

    return metrics;
  }

  getCPUMetrics() {
    const cpus = os.cpus();
    const loadAvg = os.loadavg();
    
    return {
      cores: cpus.length,
      model: cpus[0]?.model || 'unknown',
      load_1min: loadAvg[0],
      load_5min: loadAvg[1],
      load_15min: loadAvg[2],
      load_percent_1min: (loadAvg[0] / cpus.length) * 100,
      load_percent_5min: (loadAvg[1] / cpus.length) * 100,
      load_percent_15min: (loadAvg[2] / cpus.length) * 100
    };
  }

  getMemoryMetrics() {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    
    const processMemory = process.memoryUsage();
    
    return {
      system: {
        total: total,
        free: free,
        used: used,
        available: free,
        usage_percent: (used / total) * 100
      },
      process: {
        rss: processMemory.rss,
        heap_total: processMemory.heapTotal,
        heap_used: processMemory.heapUsed,
        external: processMemory.external,
        array_buffers: processMemory.arrayBuffers || 0
      }
    };
  }

  async getDiskMetrics() {
    try {
      const projectDir = process.cwd();
      
      // Get disk usage for project directory
      const dfOutput = execSync(`df -k "${projectDir}"`, { encoding: 'utf8' });
      const lines = dfOutput.trim().split('\n');
      const [_, total, used, available, usePercent] = lines[1].split(/\s+/);
      
      // Get directory sizes
      const screenshotsSize = this.getDirectorySize(path.join(projectDir, 'screenshots'));
      const logsSize = this.getDirectorySize(path.join(projectDir, 'logs'));
      const dataSize = this.getDirectorySize(path.join(projectDir, 'data'));
      
      return {
        filesystem: {
          total: parseInt(total) * 1024,
          used: parseInt(used) * 1024,
          available: parseInt(available) * 1024,
          usage_percent: parseInt(usePercent.replace('%', ''))
        },
        directories: {
          screenshots: screenshotsSize,
          logs: logsSize,
          data: dataSize,
          total_project: screenshotsSize + logsSize + dataSize
        }
      };
    } catch (error) {
      return {
        error: error.message,
        filesystem: null,
        directories: null
      };
    }
  }

  async getNetworkMetrics() {
    const networkInterfaces = os.networkInterfaces();
    const interfaces = {};
    
    for (const [name, addresses] of Object.entries(networkInterfaces)) {
      // Skip loopback interfaces
      if (name.startsWith('lo')) continue;
      
      const ipv4 = addresses.find(addr => addr.family === 'IPv4');
      if (ipv4) {
        interfaces[name] = {
          address: ipv4.address,
          internal: ipv4.internal,
          mac: ipv4.mac
        };
      }
    }
    
    // Try to get network statistics (macOS specific)
    try {
      const netstatOutput = execSync('netstat -ib', { encoding: 'utf8' });
      // Parse netstat output for bytes transferred
      // This is a simplified version - full implementation would parse all interfaces
      interfaces.stats_available = true;
    } catch (error) {
      interfaces.stats_available = false;
    }
    
    return interfaces;
  }

  getProcessMetrics() {
    return {
      pid: process.pid,
      uptime: process.uptime(),
      node_version: process.version,
      platform: process.platform,
      arch: process.arch,
      cwd: process.cwd(),
      argv: process.argv.length,
      env_vars: Object.keys(process.env).length
    };
  }

  async collectApplicationMetrics() {
    const timestamp = new Date().toISOString();
    
    const metrics = {
      timestamp,
      type: 'application',
      screenshots: await this.getScreenshotMetrics(),
      jobs: await this.getJobMetrics(),
      errors: await this.getErrorMetrics(),
      performance: await this.getPerformanceMetrics()
    };

    return metrics;
  }

  async getScreenshotMetrics() {
    const screenshotsDir = path.join(process.cwd(), 'screenshots');
    
    if (!fs.existsSync(screenshotsDir)) {
      return { total: 0, today: 0, this_week: 0, this_month: 0 };
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const screenshots = {
      total: 0,
      today: 0,
      this_week: 0,
      this_month: 0,
      by_device: {},
      average_size: 0,
      total_size: 0
    };

    const walkDir = (dir) => {
      const files = fs.readdirSync(dir);
      
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
          walkDir(filePath);
        } else if (file.endsWith('.png') || file.endsWith('.jpg')) {
          const fileDate = stat.mtime;
          screenshots.total++;
          screenshots.total_size += stat.size;
          
          if (fileDate >= today) screenshots.today++;
          if (fileDate >= thisWeek) screenshots.this_week++;
          if (fileDate >= thisMonth) screenshots.this_month++;
          
          // Extract device type from filename if possible
          const deviceMatch = file.match(/(iPhone|iPad|Android|Desktop|Mobile)/i);
          if (deviceMatch) {
            const device = deviceMatch[1].toLowerCase();
            screenshots.by_device[device] = (screenshots.by_device[device] || 0) + 1;
          }
        }
      }
    };

    walkDir(screenshotsDir);
    
    if (screenshots.total > 0) {
      screenshots.average_size = Math.round(screenshots.total_size / screenshots.total);
    }

    return screenshots;
  }

  async getJobMetrics() {
    if (!this.redisClient) {
      return { queue_available: false };
    }

    try {
      // Get job queue metrics from Redis
      const queueKeys = await this.redisClient.keys('bull:*');
      const jobCounts = {
        total_queues: queueKeys.length,
        queues: {}
      };

      // Get counts for each queue
      for (const key of queueKeys.slice(0, 10)) { // Limit to first 10 queues
        try {
          const queueName = key.split(':')[1];
          const waiting = await this.redisClient.llen(`${key}:waiting`) || 0;
          const active = await this.redisClient.llen(`${key}:active`) || 0;
          const completed = await this.redisClient.zcard(`${key}:completed`) || 0;
          const failed = await this.redisClient.zcard(`${key}:failed`) || 0;

          jobCounts.queues[queueName] = {
            waiting,
            active,
            completed,
            failed,
            total: waiting + active + completed + failed
          };
        } catch (error) {
          // Skip this queue if there's an error
        }
      }

      return jobCounts;
    } catch (error) {
      return {
        queue_available: false,
        error: error.message
      };
    }
  }

  async getErrorMetrics() {
    const errorLogPath = path.join(process.cwd(), 'logs', 'error.log');
    const appLogPath = path.join(process.cwd(), 'logs', 'app.log');
    
    const errors = {
      total_today: 0,
      total_this_hour: 0,
      by_type: {},
      recent_errors: []
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());

    // Check error log
    if (fs.existsSync(errorLogPath)) {
      try {
        const errorContent = fs.readFileSync(errorLogPath, 'utf8');
        const errorLines = errorContent.split('\n').filter(line => line.trim());
        
        for (const line of errorLines.slice(-1000)) { // Last 1000 lines
          const timestampMatch = line.match(/\[([\d-T:.Z]+)\]/);
          if (timestampMatch) {
            const lineDate = new Date(timestampMatch[1]);
            if (lineDate >= today) errors.total_today++;
            if (lineDate >= thisHour) errors.total_this_hour++;
          }

          // Categorize errors
          if (line.includes('Redis')) {
            errors.by_type.redis = (errors.by_type.redis || 0) + 1;
          } else if (line.includes('Puppeteer') || line.includes('Chrome')) {
            errors.by_type.browser = (errors.by_type.browser || 0) + 1;
          } else if (line.includes('Google') || line.includes('Drive')) {
            errors.by_type.google_api = (errors.by_type.google_api || 0) + 1;
          } else if (line.includes('ENOENT') || line.includes('filesystem')) {
            errors.by_type.filesystem = (errors.by_type.filesystem || 0) + 1;
          } else {
            errors.by_type.other = (errors.by_type.other || 0) + 1;
          }
        }

        // Get recent errors
        errors.recent_errors = errorLines.slice(-5).map(line => {
          const timestampMatch = line.match(/\[([\d-T:.Z]+)\]/);
          return {
            timestamp: timestampMatch ? timestampMatch[1] : null,
            message: line.substring(line.indexOf(']') + 1).trim()
          };
        });
      } catch (error) {
        errors.log_read_error = error.message;
      }
    }

    return errors;
  }

  async getPerformanceMetrics() {
    const performance = {
      uptime: process.uptime(),
      event_loop_lag: await this.measureEventLoopLag(),
      gc_stats: this.getGCStats(),
      response_times: await this.getResponseTimes()
    };

    return performance;
  }

  measureEventLoopLag() {
    return new Promise(resolve => {
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const lag = process.hrtime.bigint() - start;
        resolve(Number(lag) / 1000000); // Convert to milliseconds
      });
    });
  }

  getGCStats() {
    // Basic GC stats if available
    if (global.gc && global.gc.getHeapStatistics) {
      return global.gc.getHeapStatistics();
    }
    
    const memUsage = process.memoryUsage();
    return {
      heap_used: memUsage.heapUsed,
      heap_total: memUsage.heapTotal,
      heap_usage_percent: (memUsage.heapUsed / memUsage.heapTotal) * 100
    };
  }

  async getResponseTimes() {
    const healthCheckUrl = `http://localhost:${process.env.HEALTH_CHECK_PORT || 3001}/health`;
    
    try {
      const start = Date.now();
      const response = await fetch(healthCheckUrl);
      const end = Date.now();
      
      return {
        health_check: {
          response_time: end - start,
          status_code: response.status,
          available: true
        }
      };
    } catch (error) {
      return {
        health_check: {
          available: false,
          error: error.message
        }
      };
    }
  }

  getDirectorySize(dirPath) {
    if (!fs.existsSync(dirPath)) return 0;
    
    let size = 0;
    const walkDir = (dir) => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          walkDir(filePath);
        } else {
          size += stat.size;
        }
      }
    };
    
    walkDir(dirPath);
    return size;
  }

  async storeMetrics(metrics) {
    // Store to file (JSONL format)
    await this.storeToFile(metrics);
    
    // Store to Redis if available
    if (this.redisClient) {
      await this.storeToRedis(metrics);
    }
  }

  async storeToFile(metrics) {
    try {
      const logDir = path.dirname(this.metricsFile);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      const line = JSON.stringify(metrics) + '\n';
      fs.appendFileSync(this.metricsFile, line);
    } catch (error) {
      console.error('Failed to store metrics to file:', error);
    }
  }

  async storeToRedis(metrics) {
    try {
      const key = `metrics:${metrics.type}:${Date.now()}`;
      await this.redisClient.set(key, JSON.stringify(metrics));
      await this.redisClient.expire(key, this.retentionDays * 24 * 60 * 60);
      
      // Also store in a time series for easier querying
      const timeSeriesKey = `metrics:timeseries:${metrics.type}`;
      await this.redisClient.zadd(timeSeriesKey, Date.now(), JSON.stringify(metrics));
      
      // Keep only recent data in time series
      const cutoff = Date.now() - (this.retentionDays * 24 * 60 * 60 * 1000);
      await this.redisClient.zremrangebyscore(timeSeriesKey, 0, cutoff);
    } catch (error) {
      console.error('Failed to store metrics to Redis:', error);
    }
  }

  async getMetricsHistory(type = null, hours = 24) {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    const metrics = [];

    // Try Redis first
    if (this.redisClient) {
      try {
        const key = type ? `metrics:timeseries:${type}` : `metrics:timeseries:*`;
        const data = await this.redisClient.zrangebyscore(key, cutoff, Date.now());
        
        for (const item of data) {
          try {
            metrics.push(JSON.parse(item));
          } catch (error) {
            // Skip invalid JSON
          }
        }
        
        if (metrics.length > 0) {
          return metrics;
        }
      } catch (error) {
        console.error('Failed to get metrics from Redis:', error);
      }
    }

    // Fallback to file
    try {
      if (fs.existsSync(this.metricsFile)) {
        const content = fs.readFileSync(this.metricsFile, 'utf8');
        const lines = content.trim().split('\n');
        
        for (const line of lines) {
          try {
            const metric = JSON.parse(line);
            const metricTime = new Date(metric.timestamp).getTime();
            
            if (metricTime >= cutoff && (!type || metric.type === type)) {
              metrics.push(metric);
            }
          } catch (error) {
            // Skip invalid JSON
          }
        }
      }
    } catch (error) {
      console.error('Failed to read metrics from file:', error);
    }

    return metrics.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  async collectAllMetrics() {
    console.log('🔄 Collecting metrics...');
    
    try {
      const systemMetrics = await this.collectSystemMetrics();
      const appMetrics = await this.collectApplicationMetrics();
      
      await this.storeMetrics(systemMetrics);
      await this.storeMetrics(appMetrics);
      
      console.log('✅ Metrics collection completed');
      return { systemMetrics, appMetrics };
    } catch (error) {
      console.error('❌ Metrics collection failed:', error);
      throw error;
    }
  }

  async cleanup() {
    console.log('🧹 Cleaning up old metrics...');
    
    // Clean up old file entries
    try {
      if (fs.existsSync(this.metricsFile)) {
        const content = fs.readFileSync(this.metricsFile, 'utf8');
        const lines = content.trim().split('\n');
        const cutoff = Date.now() - (this.retentionDays * 24 * 60 * 60 * 1000);
        
        const validLines = lines.filter(line => {
          try {
            const metric = JSON.parse(line);
            return new Date(metric.timestamp).getTime() >= cutoff;
          } catch (error) {
            return false;
          }
        });
        
        if (validLines.length !== lines.length) {
          fs.writeFileSync(this.metricsFile, validLines.join('\n') + '\n');
          console.log(`✅ Cleaned up ${lines.length - validLines.length} old metrics entries`);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup metrics file:', error);
    }
  }

  async startContinuousCollection(interval = null) {
    const collectInterval = interval || this.collectInterval;
    console.log(`📊 Starting continuous metrics collection (interval: ${collectInterval}ms)`);
    
    // Initial collection
    await this.collectAllMetrics();
    
    // Set up interval
    setInterval(async () => {
      try {
        await this.collectAllMetrics();
      } catch (error) {
        console.error('Metrics collection error:', error);
      }
    }, collectInterval);
    
    // Cleanup old metrics every hour
    setInterval(async () => {
      try {
        await this.cleanup();
      } catch (error) {
        console.error('Metrics cleanup error:', error);
      }
    }, 60 * 60 * 1000);
  }
}

// CLI interface
if (require.main === module) {
  const collector = new MetricsCollector();
  
  const command = process.argv[2];
  const argument = process.argv[3];

  switch (command) {
    case 'collect':
      collector.collectAllMetrics()
        .then(result => {
          console.log('Metrics collected:', {
            system_metrics: !!result.systemMetrics,
            app_metrics: !!result.appMetrics
          });
          process.exit(0);
        })
        .catch(error => {
          console.error('Collection failed:', error);
          process.exit(1);
        });
      break;

    case 'history':
      const hours = argument ? parseInt(argument) : 24;
      collector.getMetricsHistory(null, hours)
        .then(metrics => {
          console.log(`Metrics history (last ${hours} hours):`, metrics.length, 'entries');
          if (metrics.length > 0) {
            console.log('Sample:', metrics[0]);
          }
        });
      break;

    case 'start':
      const interval = argument ? parseInt(argument) : null;
      collector.startContinuousCollection(interval);
      // Keep process running
      process.on('SIGINT', () => {
        console.log('Stopping metrics collection...');
        process.exit(0);
      });
      break;

    case 'cleanup':
      collector.cleanup()
        .then(() => {
          console.log('Cleanup completed');
          process.exit(0);
        })
        .catch(error => {
          console.error('Cleanup failed:', error);
          process.exit(1);
        });
      break;

    default:
      console.log('Usage:');
      console.log('  node metrics-collector.js collect           - Collect metrics once');
      console.log('  node metrics-collector.js history [hours]   - Show metrics history');
      console.log('  node metrics-collector.js start [interval]  - Start continuous collection');
      console.log('  node metrics-collector.js cleanup           - Clean up old metrics');
      break;
  }
}

module.exports = MetricsCollector;