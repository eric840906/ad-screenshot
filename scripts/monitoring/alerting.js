#!/usr/bin/env node

/**
 * Alerting System
 * Monitors health status and sends alerts based on configurable rules
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const nodemailer = require('nodemailer');
require('dotenv').config();

class AlertingSystem {
  constructor() {
    this.alertRules = this.loadAlertRules();
    this.alertHistory = new Map();
    this.cooldownPeriods = new Map();
    this.healthCheckUrl = `http://localhost:${process.env.HEALTH_CHECK_PORT || 3001}`;
    this.logFile = path.join(process.cwd(), 'logs', 'alerts.log');
    
    this.setupNotificationServices();
  }

  loadAlertRules() {
    const defaultRules = [
      {
        id: 'disk_space_critical',
        name: 'Critical Disk Space',
        condition: 'disk_usage > 95',
        severity: 'critical',
        cooldown: 3600000, // 1 hour
        message: 'Disk space critically low: {{disk_usage}}%'
      },
      {
        id: 'memory_high',
        name: 'High Memory Usage',
        condition: 'memory_usage > 90',
        severity: 'warning',
        cooldown: 1800000, // 30 minutes
        message: 'Memory usage high: {{memory_usage}}%'
      },
      {
        id: 'redis_down',
        name: 'Redis Service Down',
        condition: 'redis.healthy == false && redis.critical == true',
        severity: 'critical',
        cooldown: 300000, // 5 minutes
        message: 'Redis service is down: {{redis.message}}'
      },
      {
        id: 'chrome_unavailable',
        name: 'Chrome Unavailable',
        condition: 'chrome.healthy == false',
        severity: 'critical',
        cooldown: 3600000, // 1 hour
        message: 'Chrome browser unavailable: {{chrome.message}}'
      },
      {
        id: 'health_check_failed',
        name: 'Health Check Failed',
        condition: 'overall_status == "critical"',
        severity: 'critical',
        cooldown: 900000, // 15 minutes
        message: 'Multiple health checks failed: {{failed_checks}}'
      },
      {
        id: 'log_files_large',
        name: 'Log Files Too Large',
        condition: 'logs.total_size > 500',
        severity: 'warning',
        cooldown: 21600000, // 6 hours
        message: 'Log files growing large: {{logs.total_size}}'
      },
      {
        id: 'google_apis_error',
        name: 'Google APIs Error',
        condition: 'google_apis.healthy == false && google_apis.critical == false',
        severity: 'warning',
        cooldown: 3600000, // 1 hour
        message: 'Google APIs issue: {{google_apis.message}}'
      }
    ];

    // Try to load custom rules from file
    const customRulesPath = path.join(process.cwd(), 'config', 'alert-rules.json');
    if (fs.existsSync(customRulesPath)) {
      try {
        const customRules = JSON.parse(fs.readFileSync(customRulesPath, 'utf8'));
        return [...defaultRules, ...customRules];
      } catch (error) {
        this.log(`Failed to load custom alert rules: ${error.message}`, 'error');
      }
    }

    return defaultRules;
  }

  setupNotificationServices() {
    // Email configuration
    this.emailTransporter = null;
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      this.emailTransporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_PORT == 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
    }

    // Slack webhook
    this.slackWebhook = process.env.SLACK_WEBHOOK_URL;

    // Discord webhook (optional)
    this.discordWebhook = process.env.DISCORD_WEBHOOK_URL;
  }

  async checkHealth() {
    try {
      const response = await axios.get(`${this.healthCheckUrl}/health/detailed`, {
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      this.log(`Health check request failed: ${error.message}`, 'error');
      return {
        overall_status: 'critical',
        timestamp: new Date().toISOString(),
        error: error.message,
        checks: {}
      };
    }
  }

  evaluateCondition(condition, healthData) {
    try {
      // Simple condition evaluator
      // Replace variables with actual values
      let evalCondition = condition;
      
      // Handle nested object access
      const replaceNestedValues = (obj, prefix = '') => {
        for (const [key, value] of Object.entries(obj)) {
          const fullKey = prefix ? `${prefix}.${key}` : key;
          
          if (typeof value === 'object' && value !== null) {
            replaceNestedValues(value, fullKey);
          } else {
            const regex = new RegExp(`\\b${fullKey}\\b`, 'g');
            if (typeof value === 'string') {
              evalCondition = evalCondition.replace(regex, `"${value}"`);
            } else {
              evalCondition = evalCondition.replace(regex, value);
            }
          }
        }
      };

      // Add computed values
      const computedData = { ...healthData };
      if (healthData.checks?.filesystem?.disk_usage) {
        computedData.disk_usage = parseInt(healthData.checks.filesystem.disk_usage.replace('%', ''));
      }
      if (healthData.checks?.system_resources?.memory?.usage_percent) {
        computedData.memory_usage = healthData.checks.system_resources.memory.usage_percent;
      }
      if (healthData.checks?.logs?.total_size) {
        computedData['logs.total_size'] = parseInt(healthData.checks.logs.total_size.replace('MB', ''));
      }

      replaceNestedValues(computedData);

      // Convert array to string for failed_checks
      if (healthData.failed_checks && Array.isArray(healthData.failed_checks)) {
        evalCondition = evalCondition.replace(/\bfailed_checks\b/g, `"${healthData.failed_checks.join(', ')}"`);
      }

      // Safe evaluation (basic operators only)
      const safeEval = (expr) => {
        // Only allow safe operations
        const allowedPattern = /^[\s\d\w\.\"\'\>\<\=\!\&\|\(\)\s]+$/;
        if (!allowedPattern.test(expr)) {
          throw new Error('Unsafe expression');
        }
        
        // Replace == with ===, != with !==
        expr = expr.replace(/==/g, '===').replace(/!=/g, '!==');
        
        return Function(`"use strict"; return (${expr})`)();
      };

      return safeEval(evalCondition);
    } catch (error) {
      this.log(`Condition evaluation failed for "${condition}": ${error.message}`, 'error');
      return false;
    }
  }

  interpolateMessage(message, healthData) {
    let interpolated = message;
    
    // Simple template interpolation
    interpolated = interpolated.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const keys = key.trim().split('.');
      let value = healthData;
      
      for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
          value = value[k];
        } else {
          return match; // Keep original if not found
        }
      }
      
      return value;
    });

    return interpolated;
  }

  isInCooldown(alertId) {
    const lastAlert = this.cooldownPeriods.get(alertId);
    if (!lastAlert) return false;
    
    const now = Date.now();
    const cooldownEnd = lastAlert.timestamp + lastAlert.duration;
    return now < cooldownEnd;
  }

  setCooldown(alertId, duration) {
    this.cooldownPeriods.set(alertId, {
      timestamp: Date.now(),
      duration: duration
    });
  }

  async sendAlert(rule, healthData) {
    if (this.isInCooldown(rule.id)) {
      this.log(`Alert ${rule.id} is in cooldown, skipping`, 'info');
      return;
    }

    const message = this.interpolateMessage(rule.message, healthData);
    const alert = {
      id: rule.id,
      name: rule.name,
      severity: rule.severity,
      message: message,
      timestamp: new Date().toISOString(),
      health_data: healthData
    };

    this.log(`Sending alert: ${rule.name} - ${message}`, 'alert');

    // Send to all configured channels
    const promises = [];

    if (this.emailTransporter && process.env.NOTIFICATION_EMAIL) {
      promises.push(this.sendEmailAlert(alert));
    }

    if (this.slackWebhook) {
      promises.push(this.sendSlackAlert(alert));
    }

    if (this.discordWebhook) {
      promises.push(this.sendDiscordAlert(alert));
    }

    try {
      await Promise.allSettled(promises);
      this.setCooldown(rule.id, rule.cooldown);
      this.recordAlert(alert);
    } catch (error) {
      this.log(`Failed to send alert: ${error.message}`, 'error');
    }
  }

  async sendEmailAlert(alert) {
    if (!this.emailTransporter) return;

    const severity = alert.severity.toUpperCase();
    const subject = `[${severity}] Ad Screenshot System - ${alert.name}`;
    
    const htmlContent = `
      <h2>🚨 System Alert - ${alert.name}</h2>
      <p><strong>Severity:</strong> <span style="color: ${this.getSeverityColor(alert.severity)}">${severity}</span></p>
      <p><strong>Message:</strong> ${alert.message}</p>
      <p><strong>Timestamp:</strong> ${alert.timestamp}</p>
      
      <h3>System Status</h3>
      <pre>${JSON.stringify(alert.health_data, null, 2)}</pre>
      
      <hr>
      <p><small>This alert was generated by the Ad Screenshot Automation System</small></p>
    `;

    const mailOptions = {
      from: process.env.SMTP_USER,
      to: process.env.NOTIFICATION_EMAIL,
      subject: subject,
      html: htmlContent
    };

    await this.emailTransporter.sendMail(mailOptions);
    this.log('Email alert sent successfully', 'info');
  }

  async sendSlackAlert(alert) {
    if (!this.slackWebhook) return;

    const emoji = this.getSeverityEmoji(alert.severity);
    const color = this.getSeverityColor(alert.severity);
    
    const payload = {
      text: `${emoji} System Alert: ${alert.name}`,
      attachments: [{
        color: color,
        fields: [
          {
            title: 'Severity',
            value: alert.severity.toUpperCase(),
            short: true
          },
          {
            title: 'Message',
            value: alert.message,
            short: false
          },
          {
            title: 'Timestamp',
            value: alert.timestamp,
            short: true
          }
        ],
        footer: 'Ad Screenshot Automation System'
      }]
    };

    await axios.post(this.slackWebhook, payload);
    this.log('Slack alert sent successfully', 'info');
  }

  async sendDiscordAlert(alert) {
    if (!this.discordWebhook) return;

    const embed = {
      title: `🚨 ${alert.name}`,
      description: alert.message,
      color: parseInt(this.getSeverityColor(alert.severity).replace('#', ''), 16),
      timestamp: alert.timestamp,
      fields: [
        {
          name: 'Severity',
          value: alert.severity.toUpperCase(),
          inline: true
        }
      ],
      footer: {
        text: 'Ad Screenshot Automation System'
      }
    };

    const payload = { embeds: [embed] };

    await axios.post(this.discordWebhook, payload);
    this.log('Discord alert sent successfully', 'info');
  }

  getSeverityEmoji(severity) {
    const emojis = {
      'critical': '🚨',
      'warning': '⚠️',
      'info': 'ℹ️'
    };
    return emojis[severity] || '📢';
  }

  getSeverityColor(severity) {
    const colors = {
      'critical': '#ff0000',
      'warning': '#ff9900',
      'info': '#0099ff'
    };
    return colors[severity] || '#666666';
  }

  recordAlert(alert) {
    // Store in memory
    if (!this.alertHistory.has(alert.id)) {
      this.alertHistory.set(alert.id, []);
    }
    this.alertHistory.get(alert.id).push(alert);

    // Keep only last 100 alerts per rule
    const history = this.alertHistory.get(alert.id);
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }

    // Save to file
    this.saveAlertToFile(alert);
  }

  saveAlertToFile(alert) {
    try {
      const logDir = path.dirname(this.logFile);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      const logEntry = {
        timestamp: alert.timestamp,
        level: 'ALERT',
        alert_id: alert.id,
        severity: alert.severity,
        message: alert.message
      };

      fs.appendFileSync(this.logFile, JSON.stringify(logEntry) + '\n');
    } catch (error) {
      console.error('Failed to save alert to file:', error);
    }
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    console.log(logMessage);
    
    try {
      const logDir = path.dirname(this.logFile);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      fs.appendFileSync(this.logFile, logMessage + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  async runChecks() {
    this.log('Starting alerting checks...', 'info');
    
    try {
      const healthData = await this.checkHealth();
      let alertsTriggered = 0;

      for (const rule of this.alertRules) {
        try {
          if (this.evaluateCondition(rule.condition, healthData)) {
            await this.sendAlert(rule, healthData);
            alertsTriggered++;
          }
        } catch (error) {
          this.log(`Error processing rule ${rule.id}: ${error.message}`, 'error');
        }
      }

      this.log(`Alerting check completed: ${alertsTriggered} alerts triggered`, 'info');
      return { alertsTriggered, healthData };
    } catch (error) {
      this.log(`Alerting check failed: ${error.message}`, 'error');
      throw error;
    }
  }

  getAlertHistory(alertId = null) {
    if (alertId) {
      return this.alertHistory.get(alertId) || [];
    }
    
    const allAlerts = [];
    for (const [id, alerts] of this.alertHistory.entries()) {
      allAlerts.push(...alerts.map(alert => ({ ...alert, rule_id: id })));
    }
    
    return allAlerts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  getCooldownStatus() {
    const cooldowns = {};
    for (const [alertId, cooldown] of this.cooldownPeriods.entries()) {
      const remaining = (cooldown.timestamp + cooldown.duration) - Date.now();
      cooldowns[alertId] = {
        in_cooldown: remaining > 0,
        remaining_ms: Math.max(0, remaining),
        remaining_minutes: Math.max(0, Math.ceil(remaining / 60000))
      };
    }
    return cooldowns;
  }

  async testAlert(alertId) {
    const rule = this.alertRules.find(r => r.id === alertId);
    if (!rule) {
      throw new Error(`Alert rule not found: ${alertId}`);
    }

    // Remove cooldown for testing
    this.cooldownPeriods.delete(alertId);

    const testHealthData = {
      overall_status: 'critical',
      timestamp: new Date().toISOString(),
      test_mode: true
    };

    await this.sendAlert(rule, testHealthData);
    this.log(`Test alert sent for rule: ${alertId}`, 'info');
  }
}

// CLI interface
if (require.main === module) {
  const alerting = new AlertingSystem();
  
  const command = process.argv[2];
  const argument = process.argv[3];

  switch (command) {
    case 'check':
      alerting.runChecks()
        .then(result => {
          console.log('Alerting check completed:', result);
          process.exit(0);
        })
        .catch(error => {
          console.error('Alerting check failed:', error);
          process.exit(1);
        });
      break;

    case 'test':
      if (!argument) {
        console.error('Usage: node alerting.js test <alert-id>');
        process.exit(1);
      }
      alerting.testAlert(argument)
        .then(() => {
          console.log('Test alert sent successfully');
          process.exit(0);
        })
        .catch(error => {
          console.error('Test alert failed:', error);
          process.exit(1);
        });
      break;

    case 'history':
      const history = alerting.getAlertHistory(argument);
      console.log('Alert history:');
      console.log(JSON.stringify(history, null, 2));
      break;

    case 'cooldowns':
      const cooldowns = alerting.getCooldownStatus();
      console.log('Cooldown status:');
      console.log(JSON.stringify(cooldowns, null, 2));
      break;

    default:
      console.log('Usage:');
      console.log('  node alerting.js check                 - Run alerting checks');
      console.log('  node alerting.js test <alert-id>       - Send test alert');
      console.log('  node alerting.js history [alert-id]    - Show alert history');
      console.log('  node alerting.js cooldowns             - Show cooldown status');
      break;
  }
}

module.exports = AlertingSystem;