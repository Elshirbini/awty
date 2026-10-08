import { createAdapter } from '@socket.io/redis-adapter';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { INestApplicationContext, Logger } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';
import { ServerOptions } from 'socket.io';

export class RedisIoAdapter extends IoAdapter {
  private readonly redisLogger = new Logger(RedisIoAdapter.name);

  private adapterConstructor: ReturnType<typeof createAdapter>;

  private pubClient: RedisClientType;
  private subClient: RedisClientType;

  private isConnected = false;

  constructor(app: INestApplicationContext) {
    super(app);
  }

  async connectToRedis() {
    if (this.isConnected) {
      this.redisLogger.warn('Redis adapter already connected');
      return;
    }

    const isProduction = process.env.NODE_ENV === 'prod';

    const url = isProduction
      ? 'redis://redis:6379'
      : `redis://:${process.env.REDIS_PASSWORD}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`;

    this.pubClient = createClient({
      url,
      socket: {
        reconnectStrategy(retries) {
          return Math.min(retries * 100, 3000);
        },
      },
    });

    this.subClient = this.pubClient.duplicate();

    this.pubClient.on('error', (err) => {
      this.redisLogger.error('Redis PubClient Error', err);
    });

    this.subClient.on('error', (err) => {
      this.redisLogger.error('Redis SubClient Error', err);
    });

    this.pubClient.on('connect', () => {
      this.redisLogger.log('PubClient connected');
    });

    this.subClient.on('connect', () => {
      this.redisLogger.log('SubClient connected');
    });

    await this.pubClient.connect();
    await this.subClient.connect();

    this.adapterConstructor = createAdapter(this.pubClient, this.subClient);

    this.isConnected = true;

    this.redisLogger.log('Socket.IO Redis adapter connected ✅');
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, options);

    if (!this.adapterConstructor) {
      throw new Error(
        'Redis adapter not initialized. Call connectToRedis() first.',
      );
    }

    server.adapter(this.adapterConstructor);

    return server;
  }

  async closeRedisConnections() {
    try {
      this.redisLogger.log('Closing Redis adapter connections...');

      if (this.pubClient?.isOpen) {
        await this.pubClient.quit();
      }

      if (this.subClient?.isOpen) {
        await this.subClient.quit();
      }

      this.redisLogger.log('Redis adapter connections closed ✅');
    } catch (error) {
      this.redisLogger.error(
        'Error while closing Redis adapter connections',
        error,
      );
    }
  }
}
