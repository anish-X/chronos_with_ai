import { Kysely, PostgresDialect, Migrator, FileMigrationProvider } from 'kysely';
import { Pool } from 'pg';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface MigrationDatabase {
  [key: string]: unknown;
}

async function migrate() {
  const databaseUrl = process.env.DATABASE_URL || 'postgresql://chronos:chronos@localhost:5433/chronos';
  
  const db = new Kysely<MigrationDatabase>({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString: databaseUrl,
        max: 10,
      }),
    }),
  });

  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(__dirname, 'migrations'),
    }),
  });

  const { error, results } = await migrator.migrateToLatest();

  results?.forEach((it) => {
    if (it.status === 'Success') {
      console.log(`Migration "${it.migrationName}" executed successfully`);
    } else if (it.status === 'Error') {
      console.error(`Failed to execute migration "${it.migrationName}"`);
    }
  });

  if (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }

  await db.destroy();
}

void migrate();