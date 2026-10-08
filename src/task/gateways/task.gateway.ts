import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { forwardRef, Inject, Logger, UseFilters } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { validateSync } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { AllWsExceptionsFilter } from 'src/common/filters/ws-exception.filter';
import { TaskRepository } from 'src/task/task.repository';
import { SocketService } from 'src/socket/socket.service';
import { SubscribeDto } from '../dto/subscribe.dto';
import { TaskStatus } from '../entities/task.entity';

// ── Gateway ───────────────────────────────────────────────────────────────────

/**
 * WebSocket gateway mounted at /ws.
 *
 * Client → subscribe:
 * { "type": "subscribe", "taskId": "abc123" }
 *
 * Client → unsubscribe:
 * { "type": "unsubscribe", "taskId": "abc123" }
 *
 * Server → task:update (unified event for every state):
 * {
 *   "type": "processing" | "completed" | "failed" | "pending",
 *   "taskId": "abc123",
 *   "progress": 50,   // null when completed/failed
 *   "error": null     // string when failed
 * }
 *
 * Reconnect support:
 *   On subscribe, the gateway immediately replays the current task state so
 *   clients that reconnect mid-task receive up-to-date progress without
 *   waiting for the next worker tick.
 */
@UseFilters(AllWsExceptionsFilter)
@WebSocketGateway({ namespace: '/ws', cors: { origin: '*' } })
export class TaskGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private server!: Server;

  private readonly logger = new Logger(TaskGateway.name);

  constructor(
    private readonly socketService: SocketService,
    @Inject(forwardRef(() => TaskRepository))
    private readonly taskRepository: TaskRepository,
  ) {}

  afterInit(server: Server): void {
    this.socketService.setServer(server);
    this.logger.log('TaskGateway initialized ✅');
  }

  handleConnection(client: Socket): void {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ): Promise<void> {
    const dto = plainToInstance(SubscribeDto, body);
    const errors = validateSync(dto);
    if (errors.length > 0) {
      const msg = errors
        .flatMap((e) => Object.values(e.constraints ?? {}))
        .join(', ');
      throw new WsException(`Invalid message: ${msg}`);
    }

    if (dto.type === 'unsubscribe') {
      await client.leave(`task:${dto.taskId}`);
      this.logger.log(
        `Client ${client.id} unsubscribed from task:${dto.taskId}`,
      );
      return;
    }

    // ── Subscribe ────────────────────────────────────────────────────────────
    const task = await this.taskRepository.findById(dto.taskId);
    if (!task) {
      throw new WsException(`Task ${dto.taskId} not found`);
    }

    await client.join(`task:${dto.taskId}`);
    this.logger.log(`Client ${client.id} subscribed to task:${dto.taskId}`);

    client.emit('task:update', {
      type: task.status,
      taskId: task.id,
      progress:
        task.status === TaskStatus.COMPLETED
          ? 100
          : task.status === TaskStatus.FAILED
            ? null
            : task.progress,
      error: task.errorMessage ?? null,
    });
  }
}
