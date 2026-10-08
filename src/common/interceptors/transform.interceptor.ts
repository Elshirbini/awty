import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((responsePayload) => {
        if (typeof responsePayload === 'string') {
          return {
            success: true,
            message: responsePayload,
          };
        }

        if (
          responsePayload &&
          typeof responsePayload === 'object' &&
          ('message' in responsePayload ||
            'data' in responsePayload ||
            'meta' in responsePayload)
        ) {
          return {
            success: true,
            ...(responsePayload.message && {
              message: responsePayload.message,
            }),
            ...(responsePayload.data && { data: responsePayload.data }),
            ...(responsePayload.meta && { meta: responsePayload.meta }),
          } as {
            success: boolean;
            message?: string;
            data?: any;
            meta?: any;
          };
        }

        return {
          success: true,
          data: responsePayload,
        };
      }),
    );
  }
}
