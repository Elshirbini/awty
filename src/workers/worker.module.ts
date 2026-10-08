import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfig } from 'src/database/database.config';
import { RedisModule } from 'src/redis/redis.module';
import { SocketModule } from 'src/socket/socket.module';
import { PgBossModule } from 'src/pg-boss/pg-boss.module';
import { TaskProcessingProcessor } from './processors/task/task-processing.processor';
import { TaskRepository } from 'src/task/task.repository';
import { TaskEntity } from 'src/task/entities/task.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    TypeOrmModule.forRoot({
      ...databaseConfig,
      autoLoadEntities: true,
    }),
    TypeOrmModule.forFeature([TaskEntity]),
    RedisModule,
    PgBossModule,
    SocketModule,
  ],
  providers: [TaskRepository, TaskProcessingProcessor],
})
export class WorkerModule {}
