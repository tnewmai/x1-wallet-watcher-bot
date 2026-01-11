// Production-grade structured logging with Winston
import winston from 'winston';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

winston.addColors(colors);

// Define format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} [${info.level}]: ${info.message}${info.context ? ` | ${JSON.stringify(info.context)}` : ''}`
  )
);

// Define format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Get log level from environment variable directly (avoid circular dependency with config)
const getLogLevel = (): string => {
  return process.env.LOG_LEVEL || 'info';
};

// Ensure logs directory exists
import fs from 'fs';
import path from 'path';

const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Create the logger instance with lazy log level resolution
const logger = winston.createLogger({
  level: getLogLevel(),
  levels,
  format: fileFormat,
  defaultMeta: { service: 'x1-wallet-watcher-bot' },
  transports: [
    // Console output (colorized)
    new winston.transports.Console({
      format: consoleFormat,
    }),
    // Error log file
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Combined log file
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
  // Handle uncaught exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' }),
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log' }),
  ],
});

// Logger helper class for structured logging
export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  private formatMessage(message: string, meta?: Record<string, any>): object {
    return {
      message,
      context: { module: this.context, ...meta },
    };
  }

  error(message: string, error?: Error | unknown, meta?: Record<string, any>): void {
    if (error instanceof Error) {
      logger.error(message, {
        ...this.formatMessage(message, meta),
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
      });
    } else {
      logger.error(message, this.formatMessage(message, { ...meta, error }));
    }
  }

  warn(message: string, meta?: Record<string, any>): void {
    logger.warn(message, this.formatMessage(message, meta));
  }

  info(message: string, meta?: Record<string, any>): void {
    logger.info(message, this.formatMessage(message, meta));
  }

  http(message: string, meta?: Record<string, any>): void {
    logger.http(message, this.formatMessage(message, meta));
  }

  debug(message: string, meta?: Record<string, any>): void {
    logger.debug(message, this.formatMessage(message, meta));
  }

  // Convenience method for timing operations
  startTimer(operation: string): () => void {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.debug(`${operation} completed`, { durationMs: duration });
    };
  }
}

// Create logger factory
export function createLogger(context: string): Logger {
  return new Logger(context);
}

// Export default logger instance
export default logger;
