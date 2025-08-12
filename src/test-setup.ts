/**
 * Test setup configuration for Jest
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.BROWSER_HEADLESS = 'true';
process.env.REDIS_DB = '15'; // Use separate Redis DB for tests

// Global test timeout
jest.setTimeout(30000);

// Mock console methods to reduce test output noise
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};