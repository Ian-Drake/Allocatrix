import { runAsync } from '../database';

const migration = {
  id: '008',
  name: 'Create audit_log_entry table',
  up: async () => {
    await runAsync(`
      CREATE TABLE audit_log_entry (
        id TEXT PRIMARY KEY,
        timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        action TEXT NOT NULL,
        userId TEXT,
        accountId TEXT,
        details TEXT,
        status TEXT NOT NULL CHECK(status IN ('pending', 'executed', 'failed')) DEFAULT 'pending',
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (accountId) REFERENCES account(id) ON DELETE SET NULL
      )
    `);
    await runAsync('CREATE INDEX idx_audit_timestamp ON audit_log_entry(timestamp)');
    await runAsync('CREATE INDEX idx_audit_account ON audit_log_entry(accountId)');
    await runAsync('CREATE INDEX idx_audit_action ON audit_log_entry(action)');
  },
  down: async () => {
    await runAsync('DROP TABLE IF EXISTS audit_log_entry');
  },
};

export default migration;
