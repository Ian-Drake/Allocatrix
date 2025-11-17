import { runAsync } from '../database';

const migration = {
  id: '009',
  name: 'Create backtest_result table',
  up: async () => {
    await runAsync(`
      CREATE TABLE backtest_result (
        id TEXT PRIMARY KEY,
        modelPortfolioId TEXT NOT NULL,
        startDate DATE NOT NULL,
        endDate DATE NOT NULL,
        rebalanceFrequency TEXT NOT NULL CHECK(rebalanceFrequency IN ('monthly', 'quarterly', 'annually')),
        totalReturn REAL,
        volatility REAL,
        maxDrawdown REAL,
        sharpeRatio REAL,
        resultsJson TEXT,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (modelPortfolioId) REFERENCES model_portfolio(id) ON DELETE CASCADE
      )
    `);
    await runAsync('CREATE INDEX idx_backtest_model ON backtest_result(modelPortfolioId)');
  },
  down: async () => {
    await runAsync('DROP TABLE IF EXISTS backtest_result');
  },
};

export default migration;
