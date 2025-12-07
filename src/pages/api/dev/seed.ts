import type { NextApiRequest, NextApiResponse } from 'next';
import { v4 as uuid } from 'uuid';
import { runAsync } from '@/backend/db/database';

/**
 * POST /api/dev/seed
 * Seed the database with test data for dashboard development
 * 
 * WARNING: This endpoint is for development only!
 * It should be disabled in production.
 */

interface SeedResponse {
  success: boolean;
  message: string;
  accounts?: number;
  totalValue?: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SeedResponse>
) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      message: 'Seed endpoint is disabled in production',
    });
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Only POST and GET requests are allowed',
    });
  }

  try {
    // Create test model portfolios
    const modelId1 = uuid();
    const modelId2 = uuid();
    
    await runAsync(
      `INSERT INTO model_portfolio (id, name, description, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        modelId1,
        'Balanced Growth',
        '60% stocks, 40% bonds',
        'Valid',
        new Date().toISOString(),
        new Date().toISOString(),
      ]
    );

    await runAsync(
      `INSERT INTO model_portfolio (id, name, description, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        modelId2,
        'Aggressive Growth',
        '90% stocks, 10% bonds',
        'Valid',
        new Date().toISOString(),
        new Date().toISOString(),
      ]
    );

    // Create test accounts
    const accountId1 = uuid();
    const accountId2 = uuid();
    const accountId3 = uuid();
    
    await runAsync(
      `INSERT INTO account (id, schwabEncryptedAccountId, nickname, assignedModelPortfolioId, lastSyncedAt, createdAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        accountId1,
        `schwab-enc-${uuid()}`,
        'Retirement IRA',
        modelId1,
        new Date().toISOString(),
        new Date().toISOString(),
      ]
    );

    await runAsync(
      `INSERT INTO account (id, schwabEncryptedAccountId, nickname, assignedModelPortfolioId, lastSyncedAt, createdAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        accountId2,
        `schwab-enc-${uuid()}`,
        'Brokerage Account',
        modelId2,
        new Date().toISOString(),
        new Date().toISOString(),
      ]
    );

    await runAsync(
      `INSERT INTO account (id, schwabEncryptedAccountId, nickname, assignedModelPortfolioId, lastSyncedAt, createdAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        accountId3,
        `schwab-enc-${uuid()}`,
        'College Savings',
        modelId1,
        new Date().toISOString(),
        new Date().toISOString(),
      ]
    );

    // Create account snapshots with position data
    // Account 1: $250,000
    const positions1 = {
      VTI: { qty: 500, price: 220.50, value: 110250, weight: 44.1 },
      BND: { qty: 800, price: 75.25, value: 60200, weight: 24.08 },
      VEA: { qty: 1200, price: 45.00, value: 54000, weight: 21.6 },
      VWO: { qty: 400, price: 38.75, value: 15500, weight: 6.2 },
      CASH: { qty: 1, price: 10050, value: 10050, weight: 4.02 },
    };
    
    await runAsync(
      `INSERT INTO account_snapshot (id, accountId, timestamp, positionsJson, structuredData, totalAccountValue, availableCash, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuid(),
        accountId1,
        new Date().toISOString(),
        JSON.stringify(positions1),
        JSON.stringify(positions1),
        250000,
        10050,
        new Date().toISOString(),
      ]
    );

    // Account 2: $500,000
    const positions2 = {
      VTI: { qty: 1200, price: 220.50, value: 264600, weight: 52.92 },
      QQQ: { qty: 400, price: 385.00, value: 154000, weight: 30.8 },
      BND: { qty: 600, price: 75.25, value: 45150, weight: 9.03 },
      VEA: { qty: 600, price: 45.00, value: 27000, weight: 5.4 },
      CASH: { qty: 1, price: 9250, value: 9250, weight: 1.85 },
    };
    
    await runAsync(
      `INSERT INTO account_snapshot (id, accountId, timestamp, positionsJson, structuredData, totalAccountValue, availableCash, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuid(),
        accountId2,
        new Date().toISOString(),
        JSON.stringify(positions2),
        JSON.stringify(positions2),
        500000,
        9250,
        new Date().toISOString(),
      ]
    );

    // Account 3: $100,000
    const positions3 = {
      VTI: { qty: 200, price: 220.50, value: 44100, weight: 44.1 },
      BND: { qty: 320, price: 75.25, value: 24080, weight: 24.08 },
      VEA: { qty: 480, price: 45.00, value: 21600, weight: 21.6 },
      VWO: { qty: 160, price: 38.75, value: 6200, weight: 6.2 },
      CASH: { qty: 1, price: 4020, value: 4020, weight: 4.02 },
    };
    
    await runAsync(
      `INSERT INTO account_snapshot (id, accountId, timestamp, positionsJson, structuredData, totalAccountValue, availableCash, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuid(),
        accountId3,
        new Date().toISOString(),
        JSON.stringify(positions3),
        JSON.stringify(positions3),
        100000,
        4020,
        new Date().toISOString(),
      ]
    );

    return res.status(200).json({
      success: true,
      message: 'Database seeded successfully',
      accounts: 3,
      totalValue: 850000,
    });
  } catch (error) {
    console.error('Seed error:', error);
    
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to seed database',
    });
  }
}
