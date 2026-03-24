// ============================================================================
// LOGGER - Runtime debug output control
// ============================================================================
//
// Usage:
//   import { logger } from './logger.js';
//   logger.debug('detailed info');
//   logger.info('user-facing message');
//   logger.warn('warning message');
//   logger.error('error message');
//
// Control logging level via LOG_LEVEL environment variable:
//   LOG_LEVEL=debug npm start   # show all
//   LOG_LEVEL=info  npm start   # info, warn, error
//   LOG_LEVEL=warn  npm start   # warn, error
//   LOG_LEVEL=error npm start   # error only
//   (default: info)

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private currentLevel: LogLevel;

  constructor() {
    const envLevel = process.env.LOG_LEVEL as LogLevel | undefined;
    this.currentLevel =
      envLevel && LEVEL_PRIORITY[envLevel] !== undefined ? envLevel : "info";
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[this.currentLevel];
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog("debug")) {
      console.log(`[DEBUG]`, message, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog("info")) {
      console.log(message, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog("warn")) {
      console.warn(`[WARN]`, message, ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog("error")) {
      console.error(`[ERROR]`, message, ...args);
    }
  }

  setLevel(level: LogLevel): void {
    if (LEVEL_PRIORITY[level] !== undefined) {
      this.currentLevel = level;
    }
  }

  getLevel(): LogLevel {
    return this.currentLevel;
  }
}

export const logger = new Logger();
