import { Module } from '@nestjs/common';
import { databaseConfig } from './database/database.config';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { Redis } from 'ioredis';
import { RedisModule } from './redis/redis.module';
import { SocketModule } from './socket/socket.module';
import { TaskModule } from './task/task.module';
import { PgBossModule } from './pg-boss/pg-boss.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot({
      ...databaseConfig,
      autoLoadEntities: true,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],

      useFactory: (configService: ConfigService) => {
        const redis = new Redis({
          host:
            configService.get('NODE_ENV') === 'prod'
              ? 'redis'
              : configService.get<string>('REDIS_HOST'),

          port:
            configService.get('NODE_ENV') === 'prod'
              ? 6379
              : Number(configService.get('REDIS_PORT')),

          password:
            configService.get('NODE_ENV') === 'prod'
              ? undefined
              : configService.get<string>('REDIS_PASSWORD'),
        });

        return {
          throttlers: [
            {
              ttl: 1 * 60 * 1000,
              limit: 3000,
            },
          ],

          storage: new ThrottlerStorageRedisService(redis),
        };
      },
    }),
    RedisModule,
    PgBossModule,
    SocketModule,
    TaskModule,
  ],
})
export class AppModule {}
