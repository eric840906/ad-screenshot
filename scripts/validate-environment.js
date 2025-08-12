#!/usr/bin/env node

/**
 * Environment Validation Script
 * Validates all required dependencies and configurations for the Ad Screenshot Automation System
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class EnvironmentValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.checks = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : '✅';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  addError(message) {
    this.errors.push(message);
    this.log(message, 'error');
  }

  addWarning(message) {
    this.warnings.push(message);
    this.log(message, 'warning');
  }

  addSuccess(message) {
    this.checks.push(message);
    this.log(message, 'success');
  }

  async validateNodeJS() {
    try {
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
      
      if (majorVersion >= 18) {
        this.addSuccess(`Node.js version: ${nodeVersion} (✓ >= 18.0.0)`);
      } else {
        this.addError(`Node.js version ${nodeVersion} is too old. Requires >= 18.0.0`);
      }

      const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
      this.addSuccess(`npm version: ${npmVersion}`);
    } catch (error) {
      this.addError(`Failed to check Node.js/npm: ${error.message}`);
    }
  }

  async validateRedis() {
    try {
      const redisVersion = execSync('redis-server --version', { encoding: 'utf8', timeout: 5000 }).trim();
      this.addSuccess(`Redis installed: ${redisVersion.split(' ')[2]}`);

      // Test Redis connectivity
      try {
        const pingResult = execSync('redis-cli ping', { encoding: 'utf8', timeout: 5000 }).trim();
        if (pingResult === 'PONG') {
          this.addSuccess('Redis server is running and accessible');
        } else {
          this.addError('Redis server is not responding correctly');
        }
      } catch (pingError) {
        this.addError('Redis server is not running or not accessible');
        this.addWarning('Start Redis with: brew services start redis');
      }
    } catch (error) {
      this.addError('Redis is not installed');
      this.addWarning('Install Redis with: brew install redis');
    }
  }

  async validateChrome() {
    const chromePaths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium',
    ];

    let chromeFound = false;
    for (const chromePath of chromePaths) {
      if (fs.existsSync(chromePath)) {
        try {
          const chromeVersion = execSync(`"${chromePath}" --version`, { encoding: 'utf8', timeout: 5000 }).trim();
          this.addSuccess(`Chrome found: ${chromeVersion} at ${chromePath}`);
          chromeFound = true;
          break;
        } catch (error) {
          continue;
        }
      }
    }

    if (!chromeFound) {
      this.addError('Chrome/Chromium not found');
      this.addWarning('Install Chrome with: brew install --cask google-chrome');
    }
  }

  async validateDirectories() {
    const requiredDirs = [
      'screenshots',
      'logs',
      'credentials',
      'data',
      'data/processed',
      'data/failed'
    ];

    for (const dir of requiredDirs) {
      const dirPath = path.join(process.cwd(), dir);
      if (fs.existsSync(dirPath)) {
        const stats = fs.statSync(dirPath);
        if (stats.isDirectory()) {
          this.addSuccess(`Directory exists: ${dir}`);
          
          // Check permissions
          try {
            fs.accessSync(dirPath, fs.constants.R_OK | fs.constants.W_OK);
            this.addSuccess(`Directory writable: ${dir}`);
          } catch (error) {
            this.addError(`Directory not writable: ${dir}`);
          }
        } else {
          this.addError(`Path exists but is not a directory: ${dir}`);
        }
      } else {
        this.addWarning(`Directory missing: ${dir} (will be created)`);
        try {
          fs.mkdirSync(dirPath, { recursive: true });
          this.addSuccess(`Created directory: ${dir}`);
        } catch (error) {
          this.addError(`Failed to create directory ${dir}: ${error.message}`);
        }
      }
    }
  }

  async validateEnvironmentFile() {
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      this.addSuccess('.env file exists');
      
      const envContent = fs.readFileSync(envPath, 'utf8');
      const requiredVars = [
        'NODE_ENV',
        'REDIS_HOST',
        'REDIS_PORT',
        'BROWSER_HEADLESS',
        'STORAGE_BASE_DIR'
      ];

      for (const varName of requiredVars) {
        if (envContent.includes(varName)) {
          this.addSuccess(`Environment variable configured: ${varName}`);
        } else {
          this.addWarning(`Environment variable missing: ${varName}`);
        }
      }
    } else {
      this.addError('.env file not found');
      this.addWarning('Create .env file from .env.example');
    }
  }

  async validateDependencies() {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      this.addError('package.json not found');
      return;
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    this.addSuccess('package.json found');

    // Check if node_modules exists
    const nodeModulesPath = path.join(process.cwd(), 'node_modules');
    if (fs.existsSync(nodeModulesPath)) {
      this.addSuccess('node_modules directory exists');
    } else {
      this.addError('node_modules directory not found');
      this.addWarning('Run: npm install');
      return;
    }

    // Check critical dependencies
    const criticalDeps = ['puppeteer', 'redis', 'bull', 'winston'];
    for (const dep of criticalDeps) {
      const depPath = path.join(nodeModulesPath, dep);
      if (fs.existsSync(depPath)) {
        this.addSuccess(`Dependency installed: ${dep}`);
      } else {
        this.addError(`Critical dependency missing: ${dep}`);
      }
    }
  }

  async validateTypeScript() {
    try {
      // Check if TypeScript is compiled
      const distPath = path.join(process.cwd(), 'dist');
      if (fs.existsSync(distPath)) {
        this.addSuccess('TypeScript compiled (dist directory exists)');
      } else {
        this.addWarning('TypeScript not compiled');
        this.addWarning('Run: npm run build');
      }

      // Test TypeScript compilation
      execSync('npx tsc --noEmit', { stdio: 'pipe', timeout: 10000 });
      this.addSuccess('TypeScript compilation check passed');
    } catch (error) {
      this.addError(`TypeScript compilation issues: ${error.message}`);
    }
  }

  async validateSystemResources() {
    const totalMemory = Math.round(os.totalmem() / (1024 * 1024 * 1024));
    const freeMemory = Math.round(os.freemem() / (1024 * 1024 * 1024));
    
    this.addSuccess(`System memory: ${totalMemory}GB total, ${freeMemory}GB free`);
    
    if (totalMemory < 4) {
      this.addWarning('Low system memory detected. Consider reducing CONCURRENT_JOBS');
    }

    const cpuCount = os.cpus().length;
    this.addSuccess(`CPU cores: ${cpuCount}`);
    
    if (cpuCount < 2) {
      this.addWarning('Low CPU core count. Consider reducing CONCURRENT_JOBS');
    }
  }

  async validatePuppeteer() {
    try {
      // Test Puppeteer installation
      const puppeteer = require('puppeteer');
      this.addSuccess('Puppeteer module loaded');

      // Test browser launch
      const browser = await puppeteer.launch({ 
        headless: true,
        timeout: 10000,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      await page.goto('data:text/html,<h1>Test</h1>', { waitUntil: 'networkidle0' });
      await browser.close();
      
      this.addSuccess('Puppeteer browser test successful');
    } catch (error) {
      this.addError(`Puppeteer test failed: ${error.message}`);
    }
  }

  generateReport() {
    console.log('\n' + '='.repeat(80));
    console.log('ENVIRONMENT VALIDATION REPORT');
    console.log('='.repeat(80));
    
    console.log(`\n✅ Successful checks: ${this.checks.length}`);
    console.log(`⚠️  Warnings: ${this.warnings.length}`);
    console.log(`❌ Errors: ${this.errors.length}`);

    if (this.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      this.warnings.forEach(warning => console.log(`   - ${warning}`));
    }

    if (this.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      this.errors.forEach(error => console.log(`   - ${error}`));
    }

    console.log('\n' + '='.repeat(80));
    
    if (this.errors.length === 0) {
      console.log('🎉 Environment validation successful! System is ready.');
      return true;
    } else {
      console.log('❌ Environment validation failed. Please fix the errors above.');
      return false;
    }
  }

  async validate() {
    console.log('Starting environment validation...\n');

    await this.validateNodeJS();
    await this.validateRedis();
    await this.validateChrome();
    await this.validateDirectories();
    await this.validateEnvironmentFile();
    await this.validateDependencies();
    await this.validateTypeScript();
    await this.validateSystemResources();
    await this.validatePuppeteer();

    return this.generateReport();
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new EnvironmentValidator();
  validator.validate()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Validation failed:', error);
      process.exit(1);
    });
}

module.exports = EnvironmentValidator;