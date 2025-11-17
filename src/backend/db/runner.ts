import { runMigrations } from './migrate';
import { migrations } from './migrations';
import { closeDatabase } from './database';

async function main() {
  try {
    // eslint-disable-next-line no-console
    console.log('Starting database migrations...');
    await runMigrations(migrations);
    // eslint-disable-next-line no-console
    console.log('✓ All migrations completed successfully');
    await closeDatabase();
    process.exit(0);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('✗ Migration failed:', error);
    await closeDatabase();
    process.exit(1);
  }
}

main();
