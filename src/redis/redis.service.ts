import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env.NODE_ENV === 'prod' ? 'redis' : process.env.REDIS_HOST,
      port:
        process.env.NODE_ENV === 'prod' ? 6379 : Number(process.env.REDIS_PORT),
      password:
        process.env.NODE_ENV === 'prod'
          ? undefined
          : process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: true,
      // tls: {},
    });
    // this.redis = new Redis(process.env.REDIS_URL!, {
    //   maxRetriesPerRequest: null,
    //   enableReadyCheck: false,
    //   tls: {},
    // });
  }

  async set(key: string, value: string, expireSeconds: number) {
    await this.redis.set(key, value, 'EX', expireSeconds);
  }

  async setCacheWithTag(key: string, data: any, ttl: number, tag: string) {
    await this.redis.setex(key, ttl, JSON.stringify(data));

    // add tag set
    await this.redis.sadd(`tag:${tag}`, key);
  }

  async sAdd(tag: string, key: string) {
    await this.redis.sadd(`tag:${tag}`, key);
  }

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async del(key: string) {
    return this.redis.del(key);
  }

  async deleteCacheWithTag(tag: string) {
    const keys = await this.redis.smembers(`tag:${tag}`);

    if (keys.length > 0) {
      await this.redis.del(keys);
      await this.redis.del(`tag:${tag}`);
    }
  }

  getInstance() {
    return this.redis;
  }

  async setIfNotExists(key: string, ttlSeconds: number): Promise<boolean> {
    const setCommandResponse = await this.redis.set(
      key,
      '1',
      'EX',
      ttlSeconds,
      'NX',
    );

    return setCommandResponse === 'OK';
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }
}
