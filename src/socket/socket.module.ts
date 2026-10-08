import { Global, Module } from '@nestjs/common';
import { RedisModule } from 'src/redis/redis.module';
import { SocketService } from './socket.service';

/**
 * Global module — SocketService is available everywhere without re-importing.
 * The TaskGateway has moved into TaskModule where it belongs; SocketModule
 * no longer needs the circular forwardRef to TaskModule.
 */
@Global()
@Module({
  imports: [RedisModule],
  providers: [SocketService],
  exports: [SocketService],
})
export class SocketModule {}
