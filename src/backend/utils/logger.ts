/**
 * Structured JSON Logger
 * 
 * Provides centralized logging with JSON output for production environments
 * and human-readable output for development.
 * 
 * Features:
 * - Structured JSON logging
 * - Log levels: debug, info, warn, error
 * - Context enrichment (requestId, userId, etc.)
 * - Environment-aware formatting
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  requestId?: string;
  userId?: string;
  accountId?: string;
  action?: string;
  duration?: number;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private readonly isDevelopment: boolean;
  private readonly minLevel: LogLevel;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV !== 'production';
    this.minLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.minLevel);
    const targetLevelIndex = levels.indexOf(level);
    return targetLevelIndex >= currentLevelIndex;
  }

  private formatMessage(entry: LogEntry): string {
    if (this.isDevelopment) {
      // Human-readable format for development
      const contextStr = entry.context
        ? ` | ${Object.entries(entry.context)
            .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
            .join(' ')}`
        : '';
      const errorStr = entry.error ? ` | ERROR: ${entry.error.message}` : '';
      return `[${entry.timestamp}] ${entry.level.toUpperCase()}: ${entry.message}${contextStr}${errorStr}`;
    } else {
      // JSON format for production
      return JSON.stringify(entry);
    }
  }

  private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: this.isDevelopment ? error.stack : undefined,
      };
    }

    const formatted = this.formatMessage(entry);

    switch (level) {
      case 'debug':
        console.debug(formatted);
        break;
      case 'info':
        console.info(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'error':
        console.error(formatted);
        break;
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: LogContext, error?: Error): void {
    this.log('error', message, context, error);
  }
}

// Singleton instance
export const logger = new Logger();

// Convenience exports
export const logDebug = (message: string, context?: LogContext) => logger.debug(message, context);
export const logInfo = (message: string, context?: LogContext) => logger.info(message, context);
export const logWarn = (message: string, context?: LogContext) => logger.warn(message, context);
export const logError = (message: string, context?: LogContext, error?: Error) =>
  logger.error(message, context, error);
