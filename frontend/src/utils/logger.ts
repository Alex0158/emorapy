/**
 * 日誌工具
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: string;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 100;

  private formatMessage(level: LogLevel, message: string, data?: any): LogEntry {
    return {
      level,
      message,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  private addLog(entry: LogEntry): void {
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }

  debug(message: string, data?: any): void {
    const entry = this.formatMessage('debug', message, data);
    this.addLog(entry);
    if (import.meta.env.DEV) {
      console.debug(`[DEBUG] ${message}`, data);
    }
  }

  info(message: string, data?: any): void {
    const entry = this.formatMessage('info', message, data);
    this.addLog(entry);
    // 生產環境不輸出到console，應發送到日誌服務
    if (import.meta.env.DEV) {
    console.info(`[INFO] ${message}`, data);
    } else if (import.meta.env.VITE_SENTRY_DSN) {
      // 生產環境發送到Sentry等日誌服務（可選）
      // import * as Sentry from '@sentry/react';
      // Sentry.captureMessage(message, { level: 'info', extra: data });
    }
  }

  warn(message: string, data?: any): void {
    const entry = this.formatMessage('warn', message, data);
    this.addLog(entry);
    // 生產環境只記錄警告，不輸出到console
    if (import.meta.env.DEV) {
    console.warn(`[WARN] ${message}`, data);
    } else if (import.meta.env.VITE_SENTRY_DSN) {
      // 生產環境發送到Sentry
      // import * as Sentry from '@sentry/react';
      // Sentry.captureMessage(message, { level: 'warning', extra: data });
    }
  }

  error(message: string, error?: Error | any): void {
    const entry = this.formatMessage('error', message, error);
    this.addLog(entry);
    // 錯誤始終輸出到console以便調試，生產環境應發送到日誌服務
    if (import.meta.env.DEV) {
    console.error(`[ERROR] ${message}`, error);
    }
    // 生產環境發送到Sentry等日誌服務
    if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
      // import * as Sentry from '@sentry/react';
      // Sentry.captureException(error || new Error(message));
    }
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

export const logger = new Logger();

