/**
 * Comprehensive error handling and retry mechanisms
 */

import { ErrorType, ErrorContext } from '@/types';
import { logger } from '@/services/LoggingService';
import { config } from '@/config';

export interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  backoffMultiplier?: number;
  maxDelayMs?: number;
  shouldRetry?: (error: Error, attempt: number) => boolean;
}

export class AppError extends Error {
  public readonly type: ErrorType;
  public readonly context?: any;
  public readonly isRetryable: boolean;
  public readonly statusCode?: number;

  constructor(
    message: string,
    type: ErrorType,
    context?: any,
    isRetryable: boolean = true,
    statusCode?: number
  ) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.context = context;
    this.isRetryable = isRetryable;
    this.statusCode = statusCode;

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, AppError);
  }
}

export class ErrorHandler {
  private static instance: ErrorHandler;

  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Execute function with retry logic
   */
  public async withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {},
    errorContext?: Partial<ErrorContext>
  ): Promise<T> {
    const {
      maxAttempts = 3,
      delayMs = 1000,
      backoffMultiplier = 2,
      maxDelayMs = 10000,
      shouldRetry = this.defaultShouldRetry,
    } = options;

    let lastError: Error;
    let currentDelay = delayMs;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxAttempts || !shouldRetry(lastError, attempt)) {
          // Final attempt or non-retryable error
          this.logError(lastError, { ...errorContext, retryCount: attempt - 1 });
          throw lastError;
        }

        // Log retry attempt
        logger.warn('Function failed, retrying', {
          attempt,
          maxAttempts,
          error: lastError.message,
          nextRetryIn: currentDelay,
          ...errorContext,
        });

        // Wait before retry
        await this.delay(currentDelay);

        // Increase delay for next attempt
        currentDelay = Math.min(currentDelay * backoffMultiplier, maxDelayMs);
      }
    }

    throw lastError!;
  }

  /**
   * Default retry logic based on error type
   */
  private defaultShouldRetry = (error: Error, attempt: number): boolean => {
    // Don't retry after 3 attempts
    if (attempt >= 3) return false;

    // Check if it's our custom AppError
    if (error instanceof AppError) {
      return error.isRetryable;
    }

    // Retry network-related errors
    if (this.isNetworkError(error)) {
      return true;
    }

    // Retry timeout errors
    if (this.isTimeoutError(error)) {
      return true;
    }

    // Don't retry validation errors, authentication errors, etc.
    if (this.isUserError(error)) {
      return false;
    }

    // Default to retry for unknown errors (might be transient)
    return true;
  };

  /**
   * Execute function with specific retry strategy
   */
  public async withRetryStrategy<T>(
    fn: () => Promise<T>,
    strategyName: keyof typeof config.retryStrategies,
    errorContext?: Partial<ErrorContext>
  ): Promise<T> {
    const strategy = config.retryStrategies[strategyName];
    
    return this.withRetry(
      fn,
      {
        maxAttempts: strategy.maxAttempts,
        delayMs: strategy.delayMs,
        backoffMultiplier: strategy.backoffMultiplier,
        maxDelayMs: strategy.maxDelayMs,
      },
      errorContext
    );
  }

  /**
   * Wrap async function with error handling
   */
  public wrapAsync<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    context?: Partial<ErrorContext>
  ): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
      try {
        return await fn(...args);
      } catch (error) {
        this.handleError(error as Error, context);
        throw error;
      }
    };
  }

  /**
   * Handle and log errors appropriately
   */
  public handleError(error: Error, context?: Partial<ErrorContext>): void {
    const errorType = this.categorizeError(error);
    
    // Create full error context
    const fullContext: ErrorContext = {
      jobId: 'unknown',
      url: 'unknown',
      selector: 'unknown',
      deviceType: 'Desktop',
      retryCount: 0,
      timestamp: new Date(),
      ...context,
    };

    // Log error with appropriate level
    if (errorType === ErrorType.AUTHENTICATION_ERROR || errorType === ErrorType.PARSING_ERROR) {
      logger.error('Critical error occurred', error, fullContext);
    } else if (this.isRetryableError(error)) {
      logger.warn('Retryable error occurred', {
        error: (error as Error).message,
        type: errorType,
        context: fullContext,
      });
    } else {
      logger.error('Non-retryable error occurred', error, fullContext);
    }

    // Additional error handling based on type
    this.handleSpecificError(error, errorType, fullContext);
  }

  /**
   * Categorize error into predefined types
   */
  public categorizeError(error: Error): ErrorType {
    if (error instanceof AppError) {
      return error.type;
    }

    const message = (error as Error).message.toLowerCase();

    // Network errors
    if (this.isNetworkError(error)) {
      return ErrorType.NETWORK_ERROR;
    }

    // Timeout errors
    if (this.isTimeoutError(error)) {
      return ErrorType.TIMEOUT_ERROR;
    }

    // Browser/Puppeteer errors
    if (message.includes('browser') || message.includes('page') || message.includes('target closed')) {
      return ErrorType.BROWSER_CRASH;
    }

    // Selector errors
    if (message.includes('selector') || message.includes('element not found') || message.includes('waiting for selector')) {
      return ErrorType.SELECTOR_NOT_FOUND;
    }

    // Upload errors
    if (message.includes('upload') || message.includes('drive') || message.includes('storage')) {
      return ErrorType.UPLOAD_ERROR;
    }

    // Parsing errors
    if (message.includes('parse') || message.includes('json') || message.includes('csv')) {
      return ErrorType.PARSING_ERROR;
    }

    // Authentication errors
    if (message.includes('auth') || message.includes('permission') || message.includes('unauthorized')) {
      return ErrorType.AUTHENTICATION_ERROR;
    }

    // Default to network error for unknown errors
    return ErrorType.NETWORK_ERROR;
  }

  /**
   * Check if error is network-related
   */
  private isNetworkError(error: Error): boolean {
    const message = (error as Error).message.toLowerCase();
    const networkKeywords = [
      'network', 'connection', 'timeout', 'econnreset', 'enotfound',
      'econnrefused', 'socket', 'dns', 'fetch', 'request failed'
    ];

    return networkKeywords.some(keyword => message.includes(keyword));
  }

  /**
   * Check if error is timeout-related
   */
  private isTimeoutError(error: Error): boolean {
    const message = (error as Error).message.toLowerCase();
    return message.includes('timeout') || message.includes('timed out') || 
           message.includes('deadline exceeded') || error.name === 'TimeoutError';
  }

  /**
   * Check if error is user-related (not retryable)
   */
  private isUserError(error: Error): boolean {
    const message = (error as Error).message.toLowerCase();
    const userErrorKeywords = [
      'validation', 'invalid', 'bad request', 'unauthorized', 
      'forbidden', 'not found', 'conflict'
    ];

    return userErrorKeywords.some(keyword => message.includes(keyword));
  }

  /**
   * Check if error should be retried
   */
  private isRetryableError(error: Error): boolean {
    if (error instanceof AppError) {
      return error.isRetryable;
    }

    return this.isNetworkError(error) || this.isTimeoutError(error);
  }

  /**
   * Handle specific error types with custom logic
   */
  private handleSpecificError(
    _error: Error,
    errorType: ErrorType,
    context: ErrorContext
  ): void {
    switch (errorType) {
      case ErrorType.BROWSER_CRASH:
        // Could implement browser restart logic here
        logger.warn('Browser crash detected, may need to restart browser session', {
          context,
        });
        break;

      case ErrorType.SELECTOR_NOT_FOUND:
        // Could implement fallback selector logic here
        logger.info('Consider updating selector or adding fallback selectors', {
          selector: context.selector,
          url: context.url,
        });
        break;

      case ErrorType.UPLOAD_ERROR:
        // Could implement local backup logic here
        logger.warn('Upload failed, file should be available locally', {
          context,
        });
        break;

      case ErrorType.AUTHENTICATION_ERROR:
        // Critical error that requires immediate attention
        logger.error('Authentication error requires immediate attention', {
          context,
        });
        break;
    }
  }

  /**
   * Create application error with context
   */
  public createError(
    message: string,
    type: ErrorType,
    context?: any,
    isRetryable: boolean = true
  ): AppError {
    return new AppError(message, type, context, isRetryable);
  }

  /**
   * Delay execution for specified milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Log error with full context
   */
  private logError(error: Error, context?: Partial<ErrorContext>): void {
    if (context?.jobId) {
      const errorType = this.categorizeError(error);
      const fullContext: ErrorContext = {
        jobId: 'unknown',
        url: 'unknown',
        selector: 'unknown',
        deviceType: 'Desktop',
        retryCount: 0,
        timestamp: new Date(),
        ...context,
      };

      logger.logJobError(context.jobId, errorType, error, fullContext);
    } else {
      logger.error('Unhandled error', error, context);
    }
  }

  /**
   * Create circuit breaker for failing operations
   */
  public createCircuitBreaker<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    options: {
      failureThreshold: number;
      resetTimeout: number;
      monitoringPeriod: number;
    }
  ): (...args: T) => Promise<R> {
    let failures = 0;
    let lastFailureTime = 0;
    let state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

    return async (...args: T): Promise<R> => {
      const now = Date.now();

      // Reset failure count if monitoring period has passed
      if (now - lastFailureTime > options.monitoringPeriod) {
        failures = 0;
      }

      // Check circuit state
      if (state === 'OPEN') {
        if (now - lastFailureTime > options.resetTimeout) {
          state = 'HALF_OPEN';
          logger.info('Circuit breaker moving to HALF_OPEN state');
        } else {
          throw new AppError(
            'Circuit breaker is OPEN',
            ErrorType.NETWORK_ERROR,
            { state, failures },
            false
          );
        }
      }

      try {
        const result = await fn(...args);
        
        // Success: reset circuit breaker
        if (state === 'HALF_OPEN') {
          state = 'CLOSED';
          failures = 0;
          logger.info('Circuit breaker reset to CLOSED state');
        }

        return result;
      } catch (error) {
        failures++;
        lastFailureTime = now;

        if (failures >= options.failureThreshold) {
          state = 'OPEN';
          logger.warn('Circuit breaker opened due to repeated failures', {
            failures,
            threshold: options.failureThreshold,
          });
        }

        throw error;
      }
    };
  }

  /**
   * Create rate limiter for API calls
   */
  public createRateLimiter(
    requestsPerWindow: number,
    windowMs: number
  ): () => Promise<void> {
    const requests: number[] = [];

    return async (): Promise<void> => {
      const now = Date.now();
      
      // Remove old requests outside the window
      while (requests.length > 0 && requests[0] <= now - windowMs) {
        requests.shift();
      }

      // Check if we've exceeded the rate limit
      if (requests.length >= requestsPerWindow) {
        const oldestRequest = requests[0];
        const waitTime = oldestRequest + windowMs - now;
        
        logger.debug('Rate limit hit, waiting', { waitTime });
        await this.delay(waitTime);
        
        // Recursive call to check again
        return this.createRateLimiter(requestsPerWindow, windowMs)();
      }

      // Add current request
      requests.push(now);
    };
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();

/**
 * Decorator for automatic error handling
 */
export function HandleErrors(errorContext?: Partial<ErrorContext>) {
  return function (_target: any, _propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      try {
        return await method.apply(this, args);
      } catch (error) {
        errorHandler.handleError(error as Error, errorContext);
        throw error;
      }
    };
  };
}

/**
 * Decorator for automatic retry logic
 */
export function Retry(options: RetryOptions = {}) {
  return function (_target: any, _propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return errorHandler.withRetry(
        () => method.apply(this, args),
        options
      );
    };
  };
}