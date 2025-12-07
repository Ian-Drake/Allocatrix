import { runAsync } from '../database';

const migration = {
  id: '006',
  name: 'Create schwab_token table',
  up: async () => {
    await runAsync(`
      CREATE TABLE schwab_token (
        id TEXT PRIMARY KEY,
        accountId TEXT UNIQUE,
        encryptedAccessToken TEXT NOT NULL,
        encryptedRefreshToken TEXT NOT NULL,
        expiresAt DATETIME NOT NULL,
        refreshTokenExpiresAt DATETIME NOT NULL,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await runAsync('CREATE INDEX idx_token_expires ON schwab_token(expiresAt)');
  },
  down: async () => {
    await runAsync('DROP TABLE IF EXISTS schwab_token');
  },
};

export default migration;
