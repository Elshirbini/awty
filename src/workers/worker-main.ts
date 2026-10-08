import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';
import { winstonLogger } from 'src/common/winston-logger';

async function bootstrap() {
  await NestFactory.createApplicationContext(WorkerModule, {
    logger: winstonLogger,
  });

  winstonLogger.log('🚀 Worker running');
}

bootstrap();
