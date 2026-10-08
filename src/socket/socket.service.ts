import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import { Server } from 'socket.io';
import type Redis from 'ioredis';

/** Channels */
const TASK_EMIT_CHANNEL = 'awty:socket:task:emit';

interface UserEmitMessage {
  userId: string;
  event: string;
  payload: unknown;
}

interface TaskEmitMessage {
  taskId: string;
  event: string;
  payload: unknown;
}

type InboundMessage = UserEmitMessage | TaskEmitMessage;

@Injectable()
export class SocketService implements OnModuleDestroy {
  private server: Server;
  private readonly logger = new Logger('SocketService');
  private subscriber?: Redis;
  private subscriberStarted = false;

  constructor(private readonly redisService: RedisService) {}

  setServer(server: Server): void {
    this.server = server;
    this.logger.log('Socket server attached ✅');
    void this.startSubscriber();
  }

  /**
   * Emit an event to every socket subscribed to `task:<taskId>`.
   * Workers (separate process) use Redis to reach HTTP/Gateway processes.
   */
  async emitToTask(
    taskId: string,
    event: string,
    payload: unknown,
  ): Promise<void> {
    if (this.server) {
      this.server.to(`task:${taskId}`).emit(event, payload);
      this.logger.debug(`[local] emitted "${event}" to task ${taskId}`);
      return;
    }

    const message: TaskEmitMessage = { taskId, event, payload };
    await this.redisService
      .getInstance()
      .publish(TASK_EMIT_CHANNEL, JSON.stringify(message));
    this.logger.debug(`[pub] published "${event}" for task ${taskId}`);
  }

  private async startSubscriber(): Promise<void> {
    if (this.subscriberStarted) return;
    this.subscriberStarted = true;

    try {
      this.subscriber = this.redisService.getInstance().duplicate();
      await this.subscriber.subscribe(TASK_EMIT_CHANNEL);

      this.subscriber.on('message', (channel, message) => {
        if (!this.server) return;

        try {
          const parsed = JSON.parse(message) as InboundMessage;

          const { taskId, event, payload } = parsed as TaskEmitMessage;
          this.server.local.to(`task:${taskId}`).emit(event, payload);
          this.logger.debug(
            `[sub/task] delivered "${event}" to task ${taskId}`,
          );
        } catch (err) {
          this.logger.error('Failed to handle published socket event', err);
        }
      });

      this.logger.log('Socket event Redis subscriber connected ✅');
    } catch (err) {
      this.subscriberStarted = false;
      this.logger.error('Failed to start Redis subscriber', err);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.subscriber) {
      await this.subscriber.quit();
    }
  }
}
