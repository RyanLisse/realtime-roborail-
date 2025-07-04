import { env } from '../config/env';

export interface LogContext {
  userId?: string;
  sessionId?: string;
  ip?: string;
  userAgent?: string;
  endpoint?: string;
  duration?: number;
  error?: Error;
  [key: string]: any;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private logLevel: LogLevel;

  constructor() {
    this.logLevel = env.LOG_LEVEL || 'info';
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };
    return levels[level] >= levels[this.logLevel];
  }

  private formatLog(level: LogLevel, message: string, context?: LogContext) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...context,
      environment: env.NODE_ENV,
    };

    // In production, use structured logging
    if (env.NODE_ENV === 'production') {
      return JSON.stringify(logEntry);
    }

    // In development, use readable format
    const contextStr = context ? ` ${JSON.stringify(context, null, 2)}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${contextStr}`;
  }

  debug(message: string, context?: LogContext) {
    if (this.shouldLog('debug')) {
      console.debug(this.formatLog('debug', message, context));
    }
  }

  info(message: string, context?: LogContext) {
    if (this.shouldLog('info')) {
      console.info(this.formatLog('info', message, context));
    }
  }

  warn(message: string, context?: LogContext) {
    if (this.shouldLog('warn')) {
      console.warn(this.formatLog('warn', message, context));
    }
  }

  error(message: string, context?: LogContext) {
    if (this.shouldLog('error')) {
      console.error(this.formatLog('error', message, context));
    }
  }

  // Security-specific logging
  security(event: string, context: LogContext = {}) {
    this.warn(`[SECURITY] ${event}`, {
      ...context,
      type: 'security_event',
    });
  }

  // Performance logging
  performance(operation: string, duration: number, context: LogContext = {}) {
    this.info(`[PERFORMANCE] ${operation}`, {
      ...context,
      duration,
      type: 'performance_metric',
    });
  }

  // API logging
  api(method: string, endpoint: string, status: number, duration: number, context: LogContext = {}) {
    const level = status >= 400 ? 'error' : 'info';
    this[level](`[API] ${method} ${endpoint} - ${status}`, {
      ...context,
      method,
      endpoint,
      status,
      duration,
      type: 'api_request',
    });
  }

  // Audit logging for sensitive operations
  audit(action: string, context: LogContext = {}) {
    this.info(`[AUDIT] ${action}`, {
      ...context,
      type: 'audit_event',
    });
  }
}

export const logger = new Logger();

// Performance monitoring utility
export function withPerformanceLogging<T extends (...args: any[]) => any>(
  fn: T,
  operation: string
): T {
  return ((...args: any[]) => {
    const start = Date.now();
    try {
      const result = fn(...args);
      
      if (result instanceof Promise) {
        return result
          .then((res) => {
            logger.performance(operation, Date.now() - start);
            return res;
          })
          .catch((err) => {
            logger.performance(operation, Date.now() - start, { error: err.message });
            throw err;
          });
      }
      
      logger.performance(operation, Date.now() - start);
      return result;
    } catch (error) {
      logger.performance(operation, Date.now() - start, { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }) as T;
}

// Error context utility
export function createErrorContext(error: Error, additionalContext: LogContext = {}): LogContext {
  return {
    ...additionalContext,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
  };
}

// Request context utility
export function createRequestContext(request: Request): LogContext {
  return {
    method: request.method,
    url: request.url,
    userAgent: request.headers.get('user-agent') || undefined,
    contentType: request.headers.get('content-type') || undefined,
    referer: request.headers.get('referer') || undefined,
  };
}