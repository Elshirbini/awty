/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { config } from 'dotenv';
config();
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import fastifyHelmet from '@fastify/helmet';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import fastifyCompress from '@fastify/compress';
import { SanitizePipe } from './common/pipes/sanitize.pipe';
import { winstonLogger } from './common/winston-logger';
import { RedisIoAdapter } from './redis/redis-io.adapter';
import * as crypto from 'crypto';
import blockedAt from 'blocked-at';

type BlockedAtFn = (
  onBlock: (time: number, stack: unknown) => void,
  options?: { threshold?: number },
) => void;

async function bootstrap() {
  (blockedAt as unknown as BlockedAtFn)(
    (time, stack) => {
      winstonLogger.log(`BLOCKED FOR ${time}ms`);
      winstonLogger.log(stack);
    },
    { threshold: 1000 },
  );
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true, bodyLimit: 2 * 1024 * 1024 }),
    {
      logger: winstonLogger,
    },
  );
  const logger = new Logger('HTTP');

  const adapter = new RedisIoAdapter(app);
  await adapter.connectToRedis();

  app.useWebSocketAdapter(adapter);

  app.enableCors({
    origin: ['http://localhost:5173', 'http://localhost:8080'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT', 'OPTIONS'],
    credentials: true,
  });

  await app.register(fastifyCompress, {
    global: true,
  });

  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onRequest', (req: any, res: any, next) => {
      const start = Date.now();
      const requestId = crypto.randomUUID();

      req.requestId = requestId;

      res.raw.setHeader('x-request-id', requestId);

      res.raw.on('finish', () => {
        logger.log({
          type: 'http_request',
          method: req.method,
          url: req.url,
          statusCode: res.raw.statusCode,
          durationMs: Date.now() - start,
          ip: req.ip || req.headers['x-forwarded-for'],
          userAgent: req.headers['user-agent'],
          requestId,
          userId: req.userId ?? null,
        });
      });

      next();
    });

  await app.register(
    fastifyHelmet as any,
    {
      contentSecurityPolicy: {
        directives: {
          frameSrc: [
            "'self'",
            'https://oppwa.com',
            'https://*.oppwa.com',
            'https://*.visa.com',
            'https://*.mastercard.com',
            'https://*.3dsecure.io',
            'https://*.cardinalcommerce.com',
          ],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'",
            'https://oppwa.com',
            'https://*.oppwa.com',
          ],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            'https://oppwa.com',
            'https://*.oppwa.com',
          ],
          connectSrc: ["'self'", 'https://oppwa.com', 'https://*.oppwa.com'],
          imgSrc: [
            "'self'",
            'data:',
            'https://oppwa.com',
            'https://*.oppwa.com',
          ],
        },
      },
    } as any,
  );

  app.setGlobalPrefix('/api/');

  app.enableVersioning({
    type: VersioningType.URI,
  });

  app.useGlobalPipes(
    new SanitizePipe(),
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      disableErrorMessages: false,
      transform: true,
    }),
  );

  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  await app.listen(8080, '0.0.0.0');
}

bootstrap().catch((err) => {
  winstonLogger.error('Error during application bootstrap:', err);
  process.exit(1);
});
