import { Injectable, Logger } from '@nestjs/common';
import Redlock, { Lock, ResourceLockedError } from 'redlock';
import { RedisService } from './redis.service';

@Injectable()
export class LockService {
  private redlock: Redlock;
  private logger = new Logger(LockService.name);

  constructor(private redis: RedisService) {
    this.redlock = new Redlock([this.redis.getInstance()], {
      retryCount: 3,
      retryDelay: 200,
      retryJitter: 200,
    });
  }

  async withLock<T>(
    key: string,
    ttl: number,
    task: () => Promise<T>,
  ): Promise<T | null> {
    let lock: null | Lock = null;

    try {
      lock = await this.redlock.acquire([key], ttl);

      return await task();
    } catch (err: unknown) {
      if (err instanceof ResourceLockedError) {
        this.logger.debug(`Lock not acquired: ${key}`);
        return null;
      }

      this.logger.error(
        `Unexpected error while holding lock ${key}`,
        err as Error,
      );
      throw err;
    } finally {
      if (lock) {
        try {
          await lock.release();
        } catch (err) {
          this.logger.error(
            `Failed to release lock ${key} error : ${(err as Error).message}`,
          );
        }
      }
    }
  }
}
