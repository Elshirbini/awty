import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Job } from 'pg-boss';
import { PgBossService } from 'src/pg-boss/pg-boss.service';
import { TaskRepository } from 'src/task/task.repository';
import { SocketService } from 'src/socket/socket.service';

export const TASK_QUEUE = 'process-task';

export interface TaskJobData {
  taskId: string;
  duration: number;
}

/** How many percent to advance per tick */
const PROGRESS_STEP = 10;

/**
 * TaskProcessingProcessor runs inside the worker process.
 *
 * Responsibilities:
 *  1. Register itself as the sole consumer of the `process-task` queue.
 *  2. Atomically claim each job (pending → processing) to prevent double-processing
 *     when multiple worker containers are running.
 *  3. Advance progress 10 % per interval, persist state, and push WebSocket
 *     updates via Redis pub/sub (since workers have no Socket.IO server).
 */
@Injectable()
export class TaskProcessingProcessor implements OnModuleInit {
  private readonly logger = new Logger(TaskProcessingProcessor.name);

  constructor(
    private readonly pgBossService: PgBossService,
    private readonly taskRepository: TaskRepository,
    private readonly socketService: SocketService,
  ) {}

  async onModuleInit(): Promise<void> {
    const boss = this.pgBossService.getInstance();

    await boss.createQueue(TASK_QUEUE, {
      retryLimit: 3,
      deleteAfterSeconds: 86_400, // keep completed/failed job rows for 24 h
    });

    await boss.work<TaskJobData>(
      TASK_QUEUE,
      { localConcurrency: 1 },
      (jobs: Job<TaskJobData>[]) => this.handleJobs(jobs),
    );

    this.logger.log(`Registered on queue "${TASK_QUEUE}" ✅`);
  }

  // ────────────────────────────────────────────────────────────────────────────

  private async handleJobs(jobs: Job<TaskJobData>[]): Promise<void> {
    // pg-boss delivers a batch; with localConcurrency=1 it's typically one job.
    await Promise.all(jobs.map((j) => this.processJob(j)));
  }

  private async processJob(job: Job<TaskJobData>): Promise<void> {
    const { taskId, duration } = job.data;
    this.logger.log(
      `Job ${job.id} started | taskId=${taskId} | duration=${duration}s`,
    );

    // Acquire the task. Returns the task with its current progress if it is
    // pending or processing. Returns null if already completed/failed.
    const task = await this.taskRepository.acquireForProcessing(taskId);
    if (!task) {
      this.logger.warn(
        `Task ${taskId} is already finished or missing — skipping.`,
      );
      return;
    }

    try {
      const startProgress = task.progress;
      this.logger.log(
        `Task ${taskId} starting/resuming from progress: ${startProgress}%`,
      );

      // If starting fresh, announce progress 0
      if (startProgress === 0) {
        await this.emitUpdate(taskId, 'processing', 0, null);
      }

      // ── Progress simulation ──────────────────────────────────────────────
      // 9 intermediate steps then one final step to 100 %.
      // The interval is scaled so total elapsed ≈ duration seconds.
      const totalSteps = Math.ceil(100 / PROGRESS_STEP) - 1; // 9
      const intervalMs = Math.round((duration * 1_000) / (totalSteps + 1));

      // Calculate the step to resume from
      const startingStep = Math.floor(startProgress / PROGRESS_STEP) + 1;

      for (let step = startingStep; step <= totalSteps; step++) {
        await this.sleep(intervalMs);

        const progress = step * PROGRESS_STEP;
        await this.taskRepository.updateProgress(taskId, progress);
        await this.emitUpdate(taskId, 'processing', progress, null);
      }

      // Final sleep to fill remaining time, then mark complete
      await this.sleep(intervalMs);
      await this.taskRepository.markCompleted(taskId);
      await this.emitUpdate(taskId, 'completed', 100, null);

      this.logger.log(`Task ${taskId} completed ✅`);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Task ${taskId} failed: ${error}`,
        (err as Error).stack,
      );

      // update DB and notify subscribers
      await this.taskRepository.markFailed(taskId, error);
      await this.emitUpdate(taskId, 'failed', null, error);

      throw err;
    }
  }

  // Emit a unified `task:update` event to all subscribers of this task.
  private async emitUpdate(
    taskId: string,
    type: 'processing' | 'completed' | 'failed',
    progress: number | null,
    error: string | null,
  ): Promise<void> {
    await this.socketService.emitToTask(taskId, 'task:update', {
      type,
      taskId,
      progress,
      error,
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
