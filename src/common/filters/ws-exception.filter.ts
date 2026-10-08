import { Catch, ArgumentsHost, Logger } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Catch()
export class AllWsExceptionsFilter extends BaseWsExceptionFilter {
  private readonly logger = new Logger('ExceptionsFilter');

  catch(exception: any, host: ArgumentsHost) {
    const client = host.switchToWs().getClient<Socket>();

    this.logger.error({
      errors: exception.message,
      stack: exception.stack,
    });
    client.emit('error', {
      message: exception.message || 'Unknown error',
      stack: exception.stack,
    });
  }
}
