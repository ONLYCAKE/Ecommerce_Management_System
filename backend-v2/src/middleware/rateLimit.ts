/**
 * Rate Limiting Middleware
 * 
 * Production security: Prevents brute-force attacks and API abuse
 * Applied to sensitive endpoints: login, payments, email sending
 */

import rateLimit from 'express-rate-limit';

/**
 * Login rate limiter - Strict limit for authentication
 * 5 attempts per 15 minutes per IP
 */
export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts
    message: {
        message: 'Too many login attempts. Please try again after 15 minutes.',
        retryAfter: 15
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Don't count successful logins
});

/**
 * Payment rate limiter - Moderate limit for payment operations
 * 30 payments per minute per IP (allows batch operations)
 */
export const paymentLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 requests
    message: {
        message: 'Too many payment requests. Please slow down.',
        retryAfter: 1
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Email rate limiter - Prevents email spam
 * 10 emails per minute per IP
 */
export const emailLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 emails
    message: {
        message: 'Too many email requests. Please wait before sending more.',
        retryAfter: 1
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * General API rate limiter - Applied globally
 * 100 requests per minute per IP
 */
export const generalLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests
    message: {
        message: 'Too many requests. Please slow down.',
        retryAfter: 1
    },
    standardHeaders: true,
    legacyHeaders: false,
});
