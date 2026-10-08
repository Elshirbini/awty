import 'dotenv/config';
import { DataSource } from 'typeorm';
import { join } from 'path';
import { databaseConfig } from './database.config';

export const AppDataSource = new DataSource({
  ...databaseConfig,

  entities: [join(__dirname, '../**/*.entity{.js,.ts}')],

  migrations: [join(__dirname, 'migrations/*{.js,.ts}')],
});
