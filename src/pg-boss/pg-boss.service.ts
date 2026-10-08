import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PgBoss } from 'pg-boss';

/**
 * PgBossService is a queue-agnostic singleton that manages the pg-boss
 * instance lifecycle. It knows nothing about specific queues or job payloads.
 *
 * Each queue is created by the producer/consumer that owns it
 * (e.g. TaskProcessingProcessor). This makes the module reusable for any
 * future queue added to the system.
 *
 * Guarantees:
 *  - pg-boss starts exactly once (onModuleInit) and stops gracefully (onModuleDestroy).
 *  - The raw PgBoss instance is exposed via getInstance() so each consumer can
 *    register its own work() handler and call createQueue() with its own options.
 */
@Injectable()
export class PgBossService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PgBossService.name);
  private readonly boss: PgBoss;

  constructor() {
    this.boss = new PgBoss(this.buildConnectionString());

    this.boss.on('error', (err) => {
      this.logger.error('pg-boss internal error', err);
    });
  }

  async onModuleInit(): Promise<void> {
    await this.boss.start();
    this.logger.log('pg-boss started ✅');
  }

  async onModuleDestroy(): Promise<void> {
    await this.boss.stop({ graceful: true, timeout: 30_000 });
    this.logger.log('pg-boss stopped ✅');
  }

  /** Expose the raw PgBoss instance for queue-specific registration. */
  getInstance(): PgBoss {
    return this.boss;
  }

  private buildConnectionString(): string {
    const { DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_NAME } = process.env;

    return `postgresql://${DB_USERNAME}:${encodeURIComponent(DB_PASSWORD ?? '')}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;
  }
}
