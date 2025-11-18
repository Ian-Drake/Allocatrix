/**
 * Request Logging Middleware
 * 
 * Logs all incoming HTTP requests for API observability.
 * Enriches logs with:
 * - Request ID (for correlation)
 * - Method and path
 * - Response time
 * - Status code
 * - User context (if authenticated)
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

// Extend Express Request to include requestId
declare module 'express-serve-static-core' {
  interface Request {
    requestId?: string;
    startTime?: number;
  }
}

/**
 * Request logging middleware
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  // Generate unique request ID
  req.requestId = uuidv4();
  req.startTime = Date.now();

  // Log incoming request
  logger.info('Incoming request', {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    userAgent: req.get('user-agent'),
    ip: req.ip,
  });

  // Intercept response finish event
  const originalSend = res.send;
  res.send = function (data: any): Response {
    const duration = Date.now() - (req.startTime || 0);

    // Log response
    logger.info('Request completed', {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
    });

    // Restore original send
    return originalSend.call(this, data);
  };

  next();
}

/**
 * Request ID middleware (lighter version without full logging)
 * Use this if you only need request IDs without full request/response logging
 */
export function attachRequestId(req: Request, res: Response, next: NextFunction): void {
  req.requestId = uuidv4();
  res.setHeader('X-Request-Id', req.requestId);
  next();
}
