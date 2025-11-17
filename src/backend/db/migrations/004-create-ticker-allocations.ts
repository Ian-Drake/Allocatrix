import { runAsync } from '../database';

const migration = {
  id: '004',
  name: 'Create ticker_allocation table',
  up: async () => {
    await runAsync(`
      CREATE TABLE ticker_allocation (
        id TEXT PRIMARY KEY,
        assetClassId TEXT NOT NULL,
        symbol TEXT NOT NULL,
        displayName TEXT,
        targetWeightPct REAL NOT NULL CHECK(targetWeightPct > 0 AND targetWeightPct <= 100),
        withinAssetClass REAL NOT NULL CHECK(withinAssetClass > 0 AND withinAssetClass <= 100),
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (assetClassId) REFERENCES asset_class(id) ON DELETE CASCADE,
        UNIQUE(assetClassId, symbol)
      )
    `);
    await runAsync('CREATE INDEX idx_ta_class ON ticker_allocation(assetClassId)');
  },
  down: async () => {
    await runAsync('DROP TABLE IF EXISTS ticker_allocation');
  },
};

export default migration;
