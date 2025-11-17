/**
 * Rate Limiting Middleware
 * 
 * Prevents API abuse by limiting the number of requests per time window.
 * Uses in-memory storage (suitable for single-instance deployments).
 * 
 * Limits:
 * - General API: 100 requests per 15 minutes per IP
 * - Auth endpoints: 5 requests per 15 minutes per IP
 * - Trade endpoints: 20 requests per minute per account
 * 
 * Headers added to response:
 * - X-RateLimit-Limit: Maximum requests allowed
 * - X-RateLimit-Remaining: Requests remaining in window
 * - X-RateLimit-Reset: Unix timestamp when limit resets
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyGenerator?: (req: Request) => string; // Custom key generator
  message?: string; // Custom error message
}

class RateLimiter {
  private storage: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.storage.entries()) {
      if (entry.resetTime < now) {
        this.storage.delete(key);
      }
    }
  }

  private getKey(req: Request, keyGenerator?: (req: Request) => string): string {
    if (keyGenerator) {
      return keyGenerator(req);
    }
    // Default: use IP address
    return req.ip || req.socket.remoteAddress || 'unknown';
  }

  check(req: Request, config: RateLimitConfig): { allowed: boolean; remaining: number; resetTime: number } {
    const key = this.getKey(req, config.keyGenerator);
    const now = Date.now();

    let entry = this.storage.get(key);

    // Create new entry or reset if window expired
    if (!entry || entry.resetTime < now) {
      entry = {
        count: 0,
        resetTime: now + config.windowMs,
      };
      this.storage.set(key, entry);
    }

    // Check limit
    if (entry.count >= config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
      };
    }

    // Increment count
    entry.count++;

    return {
      allowed: true,
      remaining: config.maxRequests - entry.count,
      resetTime: entry.resetTime,
    };
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.storage.clear();
  }
}

// Singleton instance
const rateLimiter = new RateLimiter();

/**
 * Create rate limiting middleware
 */
export function createRateLimit(config: RateLimitConfig) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = rateLimiter.check(req, config);

    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', config.maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000).toString());

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
      res.setHeader('Retry-After', retryAfter.toString());

      logger.warn('Rate limit exceeded', {
        requestId: (req as any).requestId,
        ip: req.ip,
        path: req.path,
        resetTime: new Date(result.resetTime).toISOString(),
      });

      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: config.message || 'Too many requests. Please try again later.',
          retryAfter,
        },
      });
      return;
    }

    next();
  };
}

/**
 * General API rate limiter
 * 100 requests per 15 minutes per IP
 */
export const generalRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,
  message: 'Too many requests from this IP. Please try again in 15 minutes.',
});

/**
 * Auth endpoint rate limiter
 * 5 requests per 15 minutes per IP
 */
export const authRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5,
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
});

/**
 * Trade endpoint rate limiter
 * 20 requests per minute per account
 */
export const tradeRateLimit = createRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 20,
  keyGenerator: (req: Request) => {
    // Use account ID from request params or body
    const accountId = req.params.accountId || (req.body as any)?.accountId || req.ip;
    return `trade:${accountId}`;
  },
  message: 'Too many trade requests for this account. Please try again in 1 minute.',
});

// Export for cleanup in tests
export const rateLimiterInstance = rateLimiter;
