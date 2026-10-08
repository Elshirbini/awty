import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskEntity, TaskStatus } from './entities/task.entity';

@Injectable()
export class TaskRepository {
  private readonly logger = new Logger(TaskRepository.name);

  constructor(
    @InjectRepository(TaskEntity)
    private readonly repo: Repository<TaskEntity>,
  ) {}

  async create(duration: number): Promise<TaskEntity> {
    const task = this.repo.create({
      duration,
      status: TaskStatus.PENDING,
      progress: 0,
    });
    return this.repo.save(task);
  }

  async findById(id: string): Promise<TaskEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  async updateProgress(id: string, progress: number): Promise<void> {
    await this.repo.update(id, {
      status: TaskStatus.PROCESSING,
      progress,
    });
  }

  async markCompleted(id: string): Promise<void> {
    await this.repo.update(id, {
      status: TaskStatus.COMPLETED,
      progress: 100,
    });
    this.logger.log(`Task ${id} completed ✅`);
  }

  async markFailed(id: string, errorMessage: string): Promise<void> {
    await this.repo.update(id, {
      status: TaskStatus.FAILED,
      errorMessage,
    });
    this.logger.error(`Task ${id} failed ❌: ${errorMessage}`);
  }

  /**
   * Acquire the task for processing.
   * Allows transitioning from pending -> processing, or resuming an already
   * processing task (e.g. if a worker crashed and the job is retried).
   * Returns the task with its current progress, or null if it's already completed/failed.
   */
  async acquireForProcessing(id: string): Promise<TaskEntity | null> {
    const task = await this.findById(id);
    if (!task) return null;

    // If it's already finished, don't process it again
    if (
      task.status === TaskStatus.COMPLETED ||
      task.status === TaskStatus.FAILED
    ) {
      return null;
    }

    // If it's pending, mark it as processing
    if (task.status === TaskStatus.PENDING) {
      await this.repo.update(id, { status: TaskStatus.PROCESSING });
      task.status = TaskStatus.PROCESSING;
    }

    return task;
  }
}
