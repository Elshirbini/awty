import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class GracefulShutdownService implements OnModuleDestroy {
  private readonly logger = new Logger(GracefulShutdownService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onModuleDestroy() {
    this.logger.log('Closing db connection...');
    try {
      if (this.dataSource && this.dataSource.isInitialized) {
        await this.dataSource.destroy();
        this.logger.log('Database connection closed successfully');
      } else {
        this.logger.log(
          'Database connection was not initialized or already closed',
        );
      }
    } catch (error) {
      this.logger.error('Error closing database connection:', error);
    }
  }
}
