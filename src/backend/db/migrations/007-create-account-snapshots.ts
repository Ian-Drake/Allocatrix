import { runAsync } from '../database';

const migration = {
  id: '007',
  name: 'Create account_snapshot table',
  up: async () => {
    await runAsync(`
      CREATE TABLE account_snapshot (
        id TEXT PRIMARY KEY,
        accountId TEXT NOT NULL,
        timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        positionsJson TEXT NOT NULL,
        structuredData TEXT,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (accountId) REFERENCES account(id) ON DELETE CASCADE
      )
    `);
    await runAsync('CREATE INDEX idx_snapshot_account ON account_snapshot(accountId)');
    await runAsync('CREATE INDEX idx_snapshot_timestamp ON account_snapshot(timestamp)');
  },
  down: async () => {
    await runAsync('DROP TABLE IF EXISTS account_snapshot');
  },
};

export default migration;
