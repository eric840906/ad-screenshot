"use strict";
/**
 * Comprehensive error handling and retry mechanisms
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.ErrorHandler = exports.AppError = void 0;
exports.HandleErrors = HandleErrors;
exports.Retry = Retry;
const types_1 = require("../types");
const LoggingService_1 = require("../services/LoggingService");
const config_1 = require("../config");
class AppError extends Error {
    type;
    context;
    isRetryable;
    statusCode;
    constructor(message, type, context, isRetryable = true, statusCode) {
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
exports.AppError = AppError;
class ErrorHandler {
    static instance;
    static getInstance() {
        if (!ErrorHandler.instance) {
            ErrorHandler.instance = new ErrorHandler();
        }
        return ErrorHandler.instance;
    }
    /**
     * Execute function with retry logic
     */
    async withRetry(fn, options = {}, errorContext) {
        const { maxAttempts = 3, delayMs = 1000, backoffMultiplier = 2, maxDelayMs = 10000, shouldRetry = this.defaultShouldRetry, } = options;
        let lastError;
        let currentDelay = delayMs;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await fn();
            }
            catch (error) {
                lastError = error;
                if (attempt === maxAttempts || !shouldRetry(lastError, attempt)) {
                    // Final attempt or non-retryable error
                    this.logError(lastError, { ...errorContext, retryCount: attempt - 1 });
                    throw lastError;
                }
                // Log retry attempt
                LoggingService_1.logger.warn('Function failed, retrying', {
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
        throw lastError;
    }
    /**
     * Default retry logic based on error type
     */
    defaultShouldRetry = (error, attempt) => {
        // Don't retry after 3 attempts
        if (attempt >= 3)
            return false;
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
    async withRetryStrategy(fn, strategyName, errorContext) {
        const strategy = config_1.config.retryStrategies[strategyName];
        return this.withRetry(fn, {
            maxAttempts: strategy.maxAttempts,
            delayMs: strategy.delayMs,
            backoffMultiplier: strategy.backoffMultiplier,
            maxDelayMs: strategy.maxDelayMs,
        }, errorContext);
    }
    /**
     * Wrap async function with error handling
     */
    wrapAsync(fn, context) {
        return async (...args) => {
            try {
                return await fn(...args);
            }
            catch (error) {
                this.handleError(error, context);
                throw error;
            }
        };
    }
    /**
     * Handle and log errors appropriately
     */
    handleError(error, context) {
        const errorType = this.categorizeError(error);
        // Create full error context
        const fullContext = {
            jobId: 'unknown',
            url: 'unknown',
            selector: 'unknown',
            deviceType: 'Desktop',
            retryCount: 0,
            timestamp: new Date(),
            ...context,
        };
        // Log error with appropriate level
        if (errorType === types_1.ErrorType.AUTHENTICATION_ERROR || errorType === types_1.ErrorType.PARSING_ERROR) {
            LoggingService_1.logger.error('Critical error occurred', error, fullContext);
        }
        else if (this.isRetryableError(error)) {
            LoggingService_1.logger.warn('Retryable error occurred', {
                error: error.message,
                type: errorType,
                context: fullContext,
            });
        }
        else {
            LoggingService_1.logger.error('Non-retryable error occurred', error, fullContext);
        }
        // Additional error handling based on type
        this.handleSpecificError(error, errorType, fullContext);
    }
    /**
     * Categorize error into predefined types
     */
    categorizeError(error) {
        if (error instanceof AppError) {
            return error.type;
        }
        const message = error.message.toLowerCase();
        // Network errors
        if (this.isNetworkError(error)) {
            return types_1.ErrorType.NETWORK_ERROR;
        }
        // Timeout errors
        if (this.isTimeoutError(error)) {
            return types_1.ErrorType.TIMEOUT_ERROR;
        }
        // Browser/Puppeteer errors
        if (message.includes('browser') || message.includes('page') || message.includes('target closed')) {
            return types_1.ErrorType.BROWSER_CRASH;
        }
        // Selector errors
        if (message.includes('selector') || message.includes('element not found') || message.includes('waiting for selector')) {
            return types_1.ErrorType.SELECTOR_NOT_FOUND;
        }
        // Upload errors
        if (message.includes('upload') || message.includes('drive') || message.includes('storage')) {
            return types_1.ErrorType.UPLOAD_ERROR;
        }
        // Parsing errors
        if (message.includes('parse') || message.includes('json') || message.includes('csv')) {
            return types_1.ErrorType.PARSING_ERROR;
        }
        // Authentication errors
        if (message.includes('auth') || message.includes('permission') || message.includes('unauthorized')) {
            return types_1.ErrorType.AUTHENTICATION_ERROR;
        }
        // Default to network error for unknown errors
        return types_1.ErrorType.NETWORK_ERROR;
    }
    /**
     * Check if error is network-related
     */
    isNetworkError(error) {
        const message = error.message.toLowerCase();
        const networkKeywords = [
            'network', 'connection', 'timeout', 'econnreset', 'enotfound',
            'econnrefused', 'socket', 'dns', 'fetch', 'request failed'
        ];
        return networkKeywords.some(keyword => message.includes(keyword));
    }
    /**
     * Check if error is timeout-related
     */
    isTimeoutError(error) {
        const message = error.message.toLowerCase();
        return message.includes('timeout') || message.includes('timed out') ||
            message.includes('deadline exceeded') || error.name === 'TimeoutError';
    }
    /**
     * Check if error is user-related (not retryable)
     */
    isUserError(error) {
        const message = error.message.toLowerCase();
        const userErrorKeywords = [
            'validation', 'invalid', 'bad request', 'unauthorized',
            'forbidden', 'not found', 'conflict'
        ];
        return userErrorKeywords.some(keyword => message.includes(keyword));
    }
    /**
     * Check if error should be retried
     */
    isRetryableError(error) {
        if (error instanceof AppError) {
            return error.isRetryable;
        }
        return this.isNetworkError(error) || this.isTimeoutError(error);
    }
    /**
     * Handle specific error types with custom logic
     */
    handleSpecificError(_error, errorType, context) {
        switch (errorType) {
            case types_1.ErrorType.BROWSER_CRASH:
                // Could implement browser restart logic here
                LoggingService_1.logger.warn('Browser crash detected, may need to restart browser session', {
                    context,
                });
                break;
            case types_1.ErrorType.SELECTOR_NOT_FOUND:
                // Could implement fallback selector logic here
                LoggingService_1.logger.info('Consider updating selector or adding fallback selectors', {
                    selector: context.selector,
                    url: context.url,
                });
                break;
            case types_1.ErrorType.UPLOAD_ERROR:
                // Could implement local backup logic here
                LoggingService_1.logger.warn('Upload failed, file should be available locally', {
                    context,
                });
                break;
            case types_1.ErrorType.AUTHENTICATION_ERROR:
                // Critical error that requires immediate attention
                LoggingService_1.logger.error('Authentication error requires immediate attention', {
                    context,
                });
                break;
        }
    }
    /**
     * Create application error with context
     */
    createError(message, type, context, isRetryable = true) {
        return new AppError(message, type, context, isRetryable);
    }
    /**
     * Delay execution for specified milliseconds
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Log error with full context
     */
    logError(error, context) {
        if (context?.jobId) {
            const errorType = this.categorizeError(error);
            const fullContext = {
                jobId: 'unknown',
                url: 'unknown',
                selector: 'unknown',
                deviceType: 'Desktop',
                retryCount: 0,
                timestamp: new Date(),
                ...context,
            };
            LoggingService_1.logger.logJobError(context.jobId, errorType, error, fullContext);
        }
        else {
            LoggingService_1.logger.error('Unhandled error', error, context);
        }
    }
    /**
     * Create circuit breaker for failing operations
     */
    createCircuitBreaker(fn, options) {
        let failures = 0;
        let lastFailureTime = 0;
        let state = 'CLOSED';
        return async (...args) => {
            const now = Date.now();
            // Reset failure count if monitoring period has passed
            if (now - lastFailureTime > options.monitoringPeriod) {
                failures = 0;
            }
            // Check circuit state
            if (state === 'OPEN') {
                if (now - lastFailureTime > options.resetTimeout) {
                    state = 'HALF_OPEN';
                    LoggingService_1.logger.info('Circuit breaker moving to HALF_OPEN state');
                }
                else {
                    throw new AppError('Circuit breaker is OPEN', types_1.ErrorType.NETWORK_ERROR, { state, failures }, false);
                }
            }
            try {
                const result = await fn(...args);
                // Success: reset circuit breaker
                if (state === 'HALF_OPEN') {
                    state = 'CLOSED';
                    failures = 0;
                    LoggingService_1.logger.info('Circuit breaker reset to CLOSED state');
                }
                return result;
            }
            catch (error) {
                failures++;
                lastFailureTime = now;
                if (failures >= options.failureThreshold) {
                    state = 'OPEN';
                    LoggingService_1.logger.warn('Circuit breaker opened due to repeated failures', {
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
    createRateLimiter(requestsPerWindow, windowMs) {
        const requests = [];
        return async () => {
            const now = Date.now();
            // Remove old requests outside the window
            while (requests.length > 0 && requests[0] <= now - windowMs) {
                requests.shift();
            }
            // Check if we've exceeded the rate limit
            if (requests.length >= requestsPerWindow) {
                const oldestRequest = requests[0];
                const waitTime = oldestRequest + windowMs - now;
                LoggingService_1.logger.debug('Rate limit hit, waiting', { waitTime });
                await this.delay(waitTime);
                // Recursive call to check again
                return this.createRateLimiter(requestsPerWindow, windowMs)();
            }
            // Add current request
            requests.push(now);
        };
    }
}
exports.ErrorHandler = ErrorHandler;
// Export singleton instance
exports.errorHandler = ErrorHandler.getInstance();
/**
 * Decorator for automatic error handling
 */
function HandleErrors(errorContext) {
    return function (_target, _propertyName, descriptor) {
        const method = descriptor.value;
        descriptor.value = async function (...args) {
            try {
                return await method.apply(this, args);
            }
            catch (error) {
                exports.errorHandler.handleError(error, errorContext);
                throw error;
            }
        };
    };
}
/**
 * Decorator for automatic retry logic
 */
function Retry(options = {}) {
    return function (_target, _propertyName, descriptor) {
        const method = descriptor.value;
        descriptor.value = async function (...args) {
            return exports.errorHandler.withRetry(() => method.apply(this, args), options);
        };
    };
}
//# sourceMappingURL=ErrorHandler.js.map