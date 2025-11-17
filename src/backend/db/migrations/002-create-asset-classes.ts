import { runAsync } from '../database';

const migration = {
  id: '002',
  name: 'Create asset_class table',
  up: async () => {
    await runAsync(`
      CREATE TABLE asset_class (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  },
  down: async () => {
    await runAsync('DROP TABLE IF EXISTS asset_class');
  },
};

export default migration;
