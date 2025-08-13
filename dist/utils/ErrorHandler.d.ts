/**
 * Comprehensive error handling and retry mechanisms
 */
import { ErrorType, ErrorContext } from '../types';
import { config } from '../config';
export interface RetryOptions {
    maxAttempts?: number;
    delayMs?: number;
    backoffMultiplier?: number;
    maxDelayMs?: number;
    shouldRetry?: (error: Error, attempt: number) => boolean;
}
export declare class AppError extends Error {
    readonly type: ErrorType;
    readonly context?: any;
    readonly isRetryable: boolean;
    readonly statusCode?: number;
    constructor(message: string, type: ErrorType, context?: any, isRetryable?: boolean, statusCode?: number);
}
export declare class ErrorHandler {
    private static instance;
    static getInstance(): ErrorHandler;
    /**
     * Execute function with retry logic
     */
    withRetry<T>(fn: () => Promise<T>, options?: RetryOptions, errorContext?: Partial<ErrorContext>): Promise<T>;
    /**
     * Default retry logic based on error type
     */
    private defaultShouldRetry;
    /**
     * Execute function with specific retry strategy
     */
    withRetryStrategy<T>(fn: () => Promise<T>, strategyName: keyof typeof config.retryStrategies, errorContext?: Partial<ErrorContext>): Promise<T>;
    /**
     * Wrap async function with error handling
     */
    wrapAsync<T extends any[], R>(fn: (...args: T) => Promise<R>, context?: Partial<ErrorContext>): (...args: T) => Promise<R>;
    /**
     * Handle and log errors appropriately
     */
    handleError(error: Error, context?: Partial<ErrorContext>): void;
    /**
     * Categorize error into predefined types
     */
    categorizeError(error: Error): ErrorType;
    /**
     * Check if error is network-related
     */
    private isNetworkError;
    /**
     * Check if error is timeout-related
     */
    private isTimeoutError;
    /**
     * Check if error is user-related (not retryable)
     */
    private isUserError;
    /**
     * Check if error should be retried
     */
    private isRetryableError;
    /**
     * Handle specific error types with custom logic
     */
    private handleSpecificError;
    /**
     * Create application error with context
     */
    createError(message: string, type: ErrorType, context?: any, isRetryable?: boolean): AppError;
    /**
     * Delay execution for specified milliseconds
     */
    private delay;
    /**
     * Log error with full context
     */
    private logError;
    /**
     * Create circuit breaker for failing operations
     */
    createCircuitBreaker<T extends any[], R>(fn: (...args: T) => Promise<R>, options: {
        failureThreshold: number;
        resetTimeout: number;
        monitoringPeriod: number;
    }): (...args: T) => Promise<R>;
    /**
     * Create rate limiter for API calls
     */
    createRateLimiter(requestsPerWindow: number, windowMs: number): () => Promise<void>;
}
export declare const errorHandler: ErrorHandler;
/**
 * Decorator for automatic error handling
 */
export declare function HandleErrors(errorContext?: Partial<ErrorContext>): (_target: any, _propertyName: string, descriptor: PropertyDescriptor) => void;
/**
 * Decorator for automatic retry logic
 */
export declare function Retry(options?: RetryOptions): (_target: any, _propertyName: string, descriptor: PropertyDescriptor) => void;
//# sourceMappingURL=ErrorHandler.d.ts.map