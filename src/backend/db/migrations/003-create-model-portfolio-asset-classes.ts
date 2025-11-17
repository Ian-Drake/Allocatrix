import { runAsync } from '../database';

const migration = {
  id: '003',
  name: 'Create model_portfolio_asset_class junction table',
  up: async () => {
    await runAsync(`
      CREATE TABLE model_portfolio_asset_class (
        id TEXT PRIMARY KEY,
        modelPortfolioId TEXT NOT NULL,
        assetClassId TEXT NOT NULL,
        targetWeightPct REAL NOT NULL CHECK(targetWeightPct > 0 AND targetWeightPct <= 100),
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (modelPortfolioId) REFERENCES model_portfolio(id) ON DELETE CASCADE,
        FOREIGN KEY (assetClassId) REFERENCES asset_class(id) ON DELETE CASCADE,
        UNIQUE(modelPortfolioId, assetClassId)
      )
    `);
    await runAsync('CREATE INDEX idx_mpc_model ON model_portfolio_asset_class(modelPortfolioId)');
    await runAsync('CREATE INDEX idx_mpc_class ON model_portfolio_asset_class(assetClassId)');
  },
  down: async () => {
    await runAsync('DROP TABLE IF EXISTS model_portfolio_asset_class');
  },
};

export default migration;
