import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  Optional,
  PipeTransform,
} from '@nestjs/common';
import type { ZodTypeAny } from 'zod';

@Injectable()
export class ZodValidationPipe<T extends ZodTypeAny = ZodTypeAny> implements PipeTransform {
  constructor(@Optional() private readonly schema?: T) {}

  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    const schema =
      this.schema ??
      (this.isZodSchema(metadata.metatype)
        ? (metadata.metatype as unknown as ZodTypeAny)
        : undefined);

    if (!schema) return value;

    const result = schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Validation failed',
        details: result.error.issues.map((i) => ({
          path: i.path.join('.'),
          code: i.code,
          message: i.message,
        })),
      });
    }
    return result.data;
  }

  private isZodSchema(t: unknown): boolean {
    return !!t && typeof (t as { safeParse?: unknown }).safeParse === 'function';
  }
}
