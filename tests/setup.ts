// Vitest setup file
// This file is loaded before running tests

import { runMigrations } from '@/backend/db/migrate';
import { migrations } from '@/backend/db/migrations/index';

/**
 * Run database migrations before all tests
 */
async function setupDatabase() {
  try {
    await runMigrations(migrations);
  } catch (error) {
    console.error('Failed to run migrations during test setup:', error);
    throw error;
  }
}

// Execute setup immediately when this file is loaded
await setupDatabase();

