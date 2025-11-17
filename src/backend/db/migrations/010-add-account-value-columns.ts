import { runAsync } from '../database';

const migration = {
  id: '010',
  name: 'Add account value columns to account_snapshot',
  up: async () => {
    // Add totalAccountValue and availableCash columns to account_snapshot table
    // These are used to track account balance at time of snapshot
    try {
      await runAsync(`
        ALTER TABLE account_snapshot ADD COLUMN totalAccountValue DECIMAL(15,2) DEFAULT 0;
      `);
    } catch (e) {
      // Column may already exist, that's ok
    }
    
    try {
      await runAsync(`
        ALTER TABLE account_snapshot ADD COLUMN availableCash DECIMAL(12,2) DEFAULT 0;
      `);
    } catch (e) {
      // Column may already exist, that's ok
    }
  },
  down: async () => {
    // SQLite doesn't support DROP COLUMN in older versions
    // For now, just note that this would need manual cleanup
    // Alternatively, we could recreate the table without these columns
  },
};

export default migration;
