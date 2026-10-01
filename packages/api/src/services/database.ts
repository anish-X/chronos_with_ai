import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import type { Database } from '@chronos/core';

export function createApiDatabase(): Kysely<Database> {
  const databaseUrl = process.env.DATABASE_URL || 'postgresql://chronos:chronos@localhost:5433/chronos';
  
  return new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString: databaseUrl,
        max: 10,
      }),
    }),
  });
}