import { Injectable, LoggerService as NestLoggerService, Logger } from '@nestjs/common';

export type LogMeta = Record<string, any>;

@Injectable()
export class LoggerService implements NestLoggerService {
  private readonly nestLogger = new Logger();

  private formatMessage(message: string, meta?: LogMeta): string {
    if (!meta || Object.keys(meta).length === 0) {
      return message;
    }
    return `${message} | ${JSON.stringify(meta)}`;
  }

  log(message: string, context?: string, meta?: LogMeta) {
    this.nestLogger.log(this.formatMessage(message, meta), context);
  }

  error(message: string, trace?: string, context?: string, meta?: LogMeta) {
    this.nestLogger.error(this.formatMessage(message, meta), trace, context);
  }

  warn(message: string, context?: string, meta?: LogMeta) {
    this.nestLogger.warn(this.formatMessage(message, meta), context);
  }

  debug(message: string, context?: string, meta?: LogMeta) {
    this.nestLogger.debug(this.formatMessage(message, meta), context);
  }

  verbose(message: string, context?: string, meta?: LogMeta) {
    this.nestLogger.verbose(this.formatMessage(message, meta), context);
  }
}
