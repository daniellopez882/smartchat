import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';

import { env } from '@/config/env';
import { User, Chat, ChatMessage, ChatFile, AIConfig } from '@/src/db/entities';
import { InitialSchema1700000000000 } from '@/src/db/migrations/1700000000000-InitialSchema';

/**
 * Migrations are imported, not globbed: Next bundles the server, so a
 * `src/db/migration/*.ts` pattern (which also pointed at a directory that
 * did not exist) finds nothing at runtime. They run on first connection.
 *
 * Driver: better-sqlite3. The `sqlite3` package had no prebuilt binary for
 * current Node releases and fell back to a native build (which failed on the
 * development machine), and its install chain carried advisories of its own.
 */
export const buildOptions = (overrides: Partial<DataSourceOptions> = {}): DataSourceOptions =>
  ({
    type: 'better-sqlite3',
    database: env.DATABASE_PATH,
    entities: [User, Chat, ChatMessage, ChatFile, AIConfig],
    migrations: [InitialSchema1700000000000],
    migrationsRun: true,
    synchronize: false,
    logging: false,
    ...overrides
  }) as DataSourceOptions;

/** A fresh, initialised data source — for tests (`{ database: ':memory:' }`). */
export const createDataSource = async (overrides: Partial<DataSourceOptions> = {}) => {
  const dataSource = new DataSource(buildOptions(overrides));
  await dataSource.initialize();
  return dataSource;
};

class AppDataSourceSingleton {
  private static instance: DataSource | undefined;

  private constructor() {}

  public static async getInstance(): Promise<DataSource> {
    if (!AppDataSourceSingleton.instance) {
      AppDataSourceSingleton.instance = new DataSource(buildOptions());
    }
    if (!AppDataSourceSingleton.instance.isInitialized) {
      await AppDataSourceSingleton.instance.initialize();
    }
    return AppDataSourceSingleton.instance;
  }

  /** For tests: swap the process-wide instance. */
  public static setInstance(dataSource: DataSource | undefined) {
    AppDataSourceSingleton.instance = dataSource;
  }
}

export default AppDataSourceSingleton;
