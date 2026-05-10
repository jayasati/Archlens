import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  details?: unknown;
  path: string;
  requestId?: string;
  timestamp: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const r = res as Record<string, unknown>;
        if (typeof r.message === 'string' || Array.isArray(r.message)) {
          message = r.message as string | string[];
        }
        if (typeof r.error === 'string') {
          error = r.error;
        }
        if (r.details !== undefined) {
          details = r.details;
        }
      }
      if (error === 'Internal Server Error') {
        error = HttpException.name.replace(/Exception$/, '');
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const body: ErrorBody = {
      statusCode: status,
      error,
      message,
      path: request.url,
      requestId: request.id,
      timestamp: new Date().toISOString(),
    };
    if (details !== undefined) body.details = details;

    if (status >= 500) {
      this.logger.error(
        `[${request.id ?? '-'}] ${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception)
      );
    }

    if (response.headersSent) {
      // Response already shipped (e.g. a controller called res.redirect and
      // then threw). Don't try to write a second body — that crashes the
      // process. The error has been logged above; let the request end.
      return;
    }

    response.status(status).json(body);
  }
}
