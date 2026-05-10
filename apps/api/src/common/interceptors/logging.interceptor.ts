import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import type { Request, Response } from 'express';

const REQUEST_ID_HEADER = 'x-request-id';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request & { id?: string }>();
    const res = http.getResponse<Response>();

    const requestId = (req.headers[REQUEST_ID_HEADER] as string | undefined) ?? uuidv4();
    req.id = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);

    const started = Date.now();
    this.logger.log(`[${requestId}] -> ${req.method} ${req.url}`);

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - started;
          this.logger.log(`[${requestId}] <- ${req.method} ${req.url} ${res.statusCode} ${ms}ms`);
        },
        error: (err: unknown) => {
          const ms = Date.now() - started;
          const status =
            err && typeof err === 'object' && 'status' in (err as object)
              ? (err as { status?: number }).status
              : 500;
          this.logger.warn(`[${requestId}] xx ${req.method} ${req.url} ${status ?? 500} ${ms}ms`);
        },
      })
    );
  }
}
