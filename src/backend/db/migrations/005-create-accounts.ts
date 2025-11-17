import { runAsync } from '../database';

const migration = {
  id: '005',
  name: 'Create account table',
  up: async () => {
    await runAsync(`
      CREATE TABLE account (
        id TEXT PRIMARY KEY,
        schwabEncryptedAccountId TEXT NOT NULL UNIQUE,
        nickname TEXT,
        assignedModelPortfolioId TEXT,
        lastSyncedAt DATETIME,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (assignedModelPortfolioId) REFERENCES model_portfolio(id) ON DELETE SET NULL
      )
    `);
    await runAsync('CREATE INDEX idx_acc_model ON account(assignedModelPortfolioId)');
  },
  down: async () => {
    await runAsync('DROP TABLE IF EXISTS account');
  },
};

export default migration;
