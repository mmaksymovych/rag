import * as winston from 'winston';
import * as path from 'path';
import * as fs from 'fs';
import { config } from './config';

// Ensure logs directory exists
const logsDir = path.resolve(config.logging.dir);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for console output with colors
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, component, requestId, ...meta }) => {
    let log = `[${timestamp}]`;
    
    if (component) {
      log += ` [${component}]`;
    }
    
    if (requestId) {
      log += ` [${requestId}]`;
    }
    
    log += ` ${level}: ${message}`;
    
    // Add metadata if present
    const metaKeys = Object.keys(meta);
    if (metaKeys.length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    
    return log;
  })
);

// JSON format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json()
);

// Create the logger (console logging disabled, only file logging)
export const logger = winston.createLogger({
  level: config.logging.level,
  transports: [
    // File transport with JSON
    new winston.transports.File({
      filename: path.join(logsDir, 'agent.log'),
      format: fileFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
    // Error log file
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
  ],
});

// Helper function to create a child logger with component context
export function createComponentLogger(component: string) {
  return {
    debug: (message: string, meta?: any) => logger.debug(message, { component, ...meta }),
    info: (message: string, meta?: any) => logger.info(message, { component, ...meta }),
    warn: (message: string, meta?: any) => logger.warn(message, { component, ...meta }),
    error: (message: string, meta?: any) => logger.error(message, { component, ...meta }),
  };
}

// Helper to generate request IDs
let requestCounter = 0;
export function generateRequestId(): string {
  return `req_${Date.now()}_${++requestCounter}`;
}

// Export logger for direct use
export default logger;

