import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskService } from './task.service';
import { TaskController } from './task.controller';
import { TaskRepository } from './task.repository';
import { TaskEntity } from './entities/task.entity';
import { TaskGateway } from './gateways/task.gateway';
import { SocketModule } from 'src/socket/socket.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TaskEntity]),
    forwardRef(() => SocketModule),
  ],
  controllers: [TaskController],
  providers: [TaskService, TaskRepository, TaskGateway],
  exports: [TaskRepository],
})
export class TaskModule {}
