import { Injectable, ConsoleLogger, Scope } from '@nestjs/common';

export type LogMeta = Record<string, any>;

@Injectable({ scope: Scope.DEFAULT })
export class LoggerService extends ConsoleLogger {
  private formatLogMessage(message: any, meta?: LogMeta): string {
    const baseMsg =
      typeof message === 'object' && message !== null
        ? JSON.stringify(message)
        : String(message);

    if (!meta || typeof meta !== 'object' || Object.keys(meta).length === 0) {
      return baseMsg;
    }

    try {
      return `${baseMsg} | ${JSON.stringify(meta)}`;
    } catch {
      return `${baseMsg} | [Unserializable Meta]`;
    }
  }

  override log(message: any, context?: string, meta?: LogMeta): void {
    if (context && typeof context === 'object') {
      super.log(this.formatLogMessage(message, context as LogMeta));
      return;
    }
    super.log(this.formatLogMessage(message, meta), context);
  }

  override error(
    message: any,
    traceOrError?: unknown,
    context?: string,
    meta?: LogMeta,
  ): void {
    let trace: string | undefined;
    let actualContext = context;
    let actualMeta = meta;

    if (traceOrError instanceof Error) {
      trace = traceOrError.stack;
      if (typeof actualContext === 'object') {
        actualMeta = actualContext as LogMeta;
        actualContext = undefined;
      }
    } else if (typeof traceOrError === 'string') {
      trace = traceOrError;
    } else if (traceOrError && typeof traceOrError === 'object') {
      actualMeta = traceOrError as LogMeta;
    }

    const formatted = this.formatLogMessage(message, actualMeta);
    super.error(formatted, trace, actualContext);
  }

  override warn(message: any, contextOrError?: unknown, meta?: LogMeta): void {
    if (contextOrError instanceof Error) {
      super.warn(`${message} - ${contextOrError.message}`, contextOrError.stack);
      return;
    }
    if (contextOrError && typeof contextOrError === 'object') {
      super.warn(this.formatLogMessage(message, contextOrError as LogMeta));
      return;
    }
    super.warn(this.formatLogMessage(message, meta), contextOrError as string);
  }

  override debug(message: any, context?: string, meta?: LogMeta): void {
    if (context && typeof context === 'object') {
      super.debug(this.formatLogMessage(message, context as LogMeta));
      return;
    }
    super.debug(this.formatLogMessage(message, meta), context);
  }

  override verbose(message: any, context?: string, meta?: LogMeta): void {
    if (context && typeof context === 'object') {
      super.verbose(this.formatLogMessage(message, context as LogMeta));
      return;
    }
    super.verbose(this.formatLogMessage(message, meta), context);
  }
}
