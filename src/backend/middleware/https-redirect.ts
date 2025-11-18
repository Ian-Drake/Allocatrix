/**
 * HTTPS Redirect Middleware
 * 
 * Enforces HTTPS in production environments.
 * Redirects HTTP requests to HTTPS for security.
 * 
 * Disabled in development to allow local testing with http://localhost
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * HTTPS enforcement middleware
 * 
 * Redirects HTTP requests to HTTPS in production.
 * Checks X-Forwarded-Proto header for proxy/load balancer setups (Vercel, AWS, etc.)
 */
export function httpsRedirect(req: Request, res: Response, next: NextFunction): void {
  // Skip in non-production environments
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  // Check if request is already HTTPS
  const isHttps =
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https' ||
    req.get('X-Forwarded-Proto') === 'https';

  if (!isHttps) {
    const httpsUrl = `https://${req.get('host')}${req.url}`;

    logger.warn('Redirecting HTTP to HTTPS', {
      requestId: (req as any).requestId,
      originalUrl: req.url,
      redirectUrl: httpsUrl,
      ip: req.ip,
    });

    return res.redirect(301, httpsUrl);
  }

  next();
}

/**
 * Strict Transport Security (HSTS) middleware
 * 
 * Instructs browsers to only use HTTPS for future requests.
 * Includes subdomains and preload directive for maximum security.
 */
export function hsts(req: Request, res: Response, next: NextFunction): void {
  // Skip in non-production environments
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  // Set HSTS header: 1 year, include subdomains, allow preload list
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  next();
}
