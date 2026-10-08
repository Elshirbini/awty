import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { TaskRepository } from './task.repository';
import { PgBossService } from 'src/pg-boss/pg-boss.service';
import { TaskEntity } from './entities/task.entity';
import { CreateTaskDto } from './dto/createTask.dto';
import { TASK_QUEUE } from 'src/workers/processors/task/task-processing.processor';

@Injectable()
export class TaskService {
  private readonly logger = new Logger(TaskService.name);

  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly pgBossService: PgBossService,
  ) {}

  /**
   * Create a new task record and immediately enqueue it.
   * The HTTP request returns without waiting for processing.
   */
  async createTask(
    taskData: CreateTaskDto,
  ): Promise<{ id: string; status: string }> {
    const task = await this.taskRepository.create(taskData.duration);

    // Enqueue for async processing.
    // singletonKey = taskId → pg-boss ignores a second enqueue for the same key
    // while a job with that key is already queued or active.
    const jobId = await this.pgBossService
      .getInstance()
      .send(
        TASK_QUEUE,
        { taskId: task.id, duration: task.duration },
        { singletonKey: task.id },
      );

    this.logger.log(
      `Task created: ${task.id} | job: ${jobId ?? '(duplicate)'}`,
    );
    return { id: task.id, status: task.status };
  }

  async getTaskById(id: string): Promise<TaskEntity> {
    const task = await this.taskRepository.findById(id);
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return task;
  }
}
