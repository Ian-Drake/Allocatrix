/**
 * Error Handler Middleware
 * 
 * Translates API errors to user-friendly messages and standardized error responses.
 * Handles:
 * - Schwab API errors (OAuth, trading, market data)
 * - Validation errors
 * - Database errors
 * - Generic application errors
 * 
 * Error Response Format:
 * {
 *   "error": {
 *     "code": "ERROR_CODE",
 *     "message": "User-friendly message",
 *     "details": { ... optional details ... }
 *   }
 * }
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: Record<string, unknown>;
}

/**
 * Standard error codes
 */
export const ErrorCodes = {
  // Authentication errors
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  OAUTH_FAILED: 'OAUTH_FAILED',

  // Validation errors
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_WEIGHT: 'INVALID_WEIGHT',
  WEIGHT_SUM_MISMATCH: 'WEIGHT_SUM_MISMATCH',
  DUPLICATE_PORTFOLIO_NAME: 'DUPLICATE_PORTFOLIO_NAME',

  // Resource errors
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  PORTFOLIO_LOCKED: 'PORTFOLIO_LOCKED',

  // Trading errors
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  TRADE_FAILED: 'TRADE_FAILED',
  SCHWAB_API_ERROR: 'SCHWAB_API_ERROR',
  MARKET_CLOSED: 'MARKET_CLOSED',

  // System errors
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

/**
 * User-friendly error messages
 */
const ErrorMessages: Record<string, string> = {
  AUTH_REQUIRED: 'Please log in to continue.',
  INVALID_TOKEN: 'Your session is invalid. Please log in again.',
  TOKEN_EXPIRED: 'Your session has expired. Please log in again.',
  OAUTH_FAILED: 'Authentication with Schwab failed. Please try again.',

  VALIDATION_FAILED: 'The provided data is invalid. Please check and try again.',
  INVALID_WEIGHT: 'Portfolio weights must be between 0% and 100%.',
  WEIGHT_SUM_MISMATCH: 'Portfolio weights must sum to 100% (±1% tolerance).',
  DUPLICATE_PORTFOLIO_NAME: 'A portfolio with this name already exists.',

  NOT_FOUND: 'The requested resource was not found.',
  ALREADY_EXISTS: 'This resource already exists.',
  PORTFOLIO_LOCKED:
    'This portfolio is assigned to accounts and cannot be modified. Clone it to make changes.',

  INSUFFICIENT_FUNDS: 'Insufficient funds to complete this transaction.',
  TRADE_FAILED: 'Trade execution failed. Please try again or contact support.',
  SCHWAB_API_ERROR: 'Unable to connect to Schwab. Please try again later.',
  MARKET_CLOSED: 'Markets are currently closed. Trading is unavailable.',

  DATABASE_ERROR: 'A database error occurred. Please try again.',
  INTERNAL_ERROR: 'An unexpected error occurred. Please try again.',
};

/**
 * Create a standardized application error
 */
export function createError(
  code: keyof typeof ErrorCodes,
  statusCode: number = 400,
  details?: Record<string, unknown>
): AppError {
  const error = new Error(ErrorMessages[code]) as AppError;
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  return error;
}

/**
 * Detect and translate Schwab API errors
 */
function translateSchwabError(error: AppError): AppError {
  const message = error.message?.toLowerCase() || '';

  // OAuth errors
  if (message.includes('unauthorized') || message.includes('401')) {
    return createError('AUTH_REQUIRED', 401);
  }
  if (message.includes('invalid_grant') || message.includes('token')) {
    return createError('INVALID_TOKEN', 401);
  }

  // Trading errors
  if (message.includes('insufficient funds') || message.includes('buying power')) {
    return createError('INSUFFICIENT_FUNDS', 400, { originalError: error.message });
  }
  if (message.includes('market closed')) {
    return createError('MARKET_CLOSED', 400);
  }

  // Generic Schwab API error
  return createError('SCHWAB_API_ERROR', 502, { originalError: error.message });
}

/**
 * Detect and translate database errors
 */
function translateDatabaseError(error: AppError): AppError {
  const message = error.message?.toLowerCase() || '';

  // Unique constraint violations
  if (message.includes('unique constraint') || message.includes('duplicate')) {
    if (message.includes('model_portfolio.name')) {
      return createError('DUPLICATE_PORTFOLIO_NAME', 409);
    }
    return createError('ALREADY_EXISTS', 409);
  }

  // Foreign key violations
  if (message.includes('foreign key')) {
    return createError('NOT_FOUND', 404, { originalError: 'Referenced resource not found' });
  }

  // Check constraint violations
  if (message.includes('check constraint')) {
    return createError('VALIDATION_FAILED', 400, { originalError: error.message });
  }

  // Generic database error
  return createError('DATABASE_ERROR', 500, { originalError: error.message });
}

/**
 * Error handler middleware
 */
export function errorHandler(
  error: AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  // Default values
  let statusCode = error.statusCode || 500;
  let code = error.code || ErrorCodes.INTERNAL_ERROR;
  let message = error.message || ErrorMessages.INTERNAL_ERROR;
  let details = error.details;

  // Translate specific error types
  if (error.message?.includes('SQLITE') || error.message?.includes('database')) {
    const translated = translateDatabaseError(error);
    statusCode = translated.statusCode || 500;
    code = translated.code || ErrorCodes.DATABASE_ERROR;
    message = translated.message;
    details = translated.details;
  } else if (error.message?.includes('Schwab') || error.code?.startsWith('SCHWAB')) {
    const translated = translateSchwabError(error);
    statusCode = translated.statusCode || 502;
    code = translated.code || ErrorCodes.SCHWAB_API_ERROR;
    message = translated.message;
    details = translated.details;
  }

  // Log the error
  logger.error(`API Error: ${code}`, {
    requestId: (req as any).requestId,
    method: req.method,
    path: req.path,
    statusCode,
    code,
  }, error);

  // Send error response
  res.status(statusCode).json({
    error: {
      code,
      message,
      details: process.env.NODE_ENV !== 'production' ? details : undefined,
    },
  });
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: ErrorCodes.NOT_FOUND,
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
}
