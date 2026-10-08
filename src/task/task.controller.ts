import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { TaskService } from './task.service';
import { CreateTaskDto } from './dto/createTask.dto';

@Controller({ path: 'tasks', version: '1' })
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  /**
   * POST /api/v1/tasks
   * Body: { "duration": 10 }
   * Response: { "id": "abc123", "status": "pending" }
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createTask(@Body() taskData: CreateTaskDto) {
    return this.taskService.createTask(taskData);
  }

  /**
   * GET /api/v1/tasks/:id
   * Response: { "id": "abc123", "status": "processing", "progress": 50 }
   */
  @Get('/:id')
  async getTaskById(@Param('id', ParseUUIDPipe) id: string) {
    return this.taskService.getTaskById(id);
  }
}
