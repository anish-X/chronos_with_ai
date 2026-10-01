import type { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('jobs')
    .addColumn('worker_id', 'text')
    .execute();

  await db.schema.createIndex('idx_jobs_worker').on('jobs').column('worker_id').execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('idx_jobs_worker').execute();
  await db.schema.alterTable('jobs').dropColumn('worker_id').execute();
}