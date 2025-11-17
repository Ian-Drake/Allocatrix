import { runAsync } from '../database';

const migration = {
  id: '001',
  name: 'Create model_portfolio table',
  up: async () => {
    await runAsync(`
      CREATE TABLE model_portfolio (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        status TEXT NOT NULL CHECK(status IN ('Draft', 'Valid', 'Locked')) DEFAULT 'Draft',
        clonedFromModelId TEXT,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (clonedFromModelId) REFERENCES model_portfolio(id) ON DELETE SET NULL
      )
    `);
  },
  down: async () => {
    await runAsync('DROP TABLE IF EXISTS model_portfolio');
  },
};

export default migration;
