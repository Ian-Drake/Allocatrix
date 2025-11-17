import { runAsync, allAsync } from './database';

export interface Migration {
  id: string;
  name: string;
  up: () => Promise<void>;
  down: () => Promise<void>;
}

/**
 * Initialize migrations table if it doesn't exist
 */
export async function initMigrationsTable(): Promise<void> {
  await runAsync(`
    CREATE TABLE IF NOT EXISTS migrations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      executedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

/**
 * Get all executed migrations
 */
export async function getExecutedMigrations(): Promise<string[]> {
  const rows = await allAsync<{ id: string }>(
    'SELECT id FROM migrations ORDER BY executedAt'
  );
  return rows.map((row) => row.id);
}

/**
 * Record a migration as executed
 */
export async function recordMigration(migration: Migration): Promise<void> {
  await runAsync(
    'INSERT INTO migrations (id, name) VALUES (?, ?)',
    [migration.id, migration.name]
  );
}

/**
 * Run all pending migrations
 */
export async function runMigrations(migrations: Migration[]): Promise<void> {
  await initMigrationsTable();

  const executed = await getExecutedMigrations();

  for (const migration of migrations) {
    if (!executed.includes(migration.id)) {
      // eslint-disable-next-line no-console
      console.log(`Running migration: ${migration.id} - ${migration.name}`);
      try {
        await migration.up();
        await recordMigration(migration);
        // eslint-disable-next-line no-console
        console.log(`✓ Migration completed: ${migration.id}`);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`✗ Migration failed: ${migration.id}`, error);
        throw error;
      }
    }
  }

  // eslint-disable-next-line no-console
  console.log(`All migrations completed. ${migrations.length - executed.length} new migrations run.`);
}

/**
 * Rollback a migration
 */
export async function rollbackMigration(migration: Migration): Promise<void> {
  const executed = await getExecutedMigrations();

  if (executed.includes(migration.id)) {
    // eslint-disable-next-line no-console
    console.log(`Rolling back migration: ${migration.id}`);
    try {
      await migration.down();
      await runAsync('DELETE FROM migrations WHERE id = ?', [migration.id]);
      // eslint-disable-next-line no-console
      console.log(`✓ Rollback completed: ${migration.id}`);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`✗ Rollback failed: ${migration.id}`, error);
      throw error;
    }
  }
}
