/**
 * Seed script to populate the database with test data for dashboard testing
 * 
 * Creates:
 * - 3 test accounts with different portfolios
 * - Account snapshots with position data
 * - Model portfolios
 */

import { v4 as uuid } from 'uuid';
import { runAsync } from '../src/backend/db/database';

async function seed() {
  console.log('Starting database seed...');

  try {
    // Create test model portfolios
    const modelId1 = uuid();
    const modelId2 = uuid();
    
    console.log('Creating model portfolios...');
    await runAsync(
      `INSERT INTO model_portfolio (id, name, description, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        modelId1,
        'Balanced Growth',
        ' 60% stocks, 40% bonds',
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
    
    console.log('Creating test accounts...');
    
    await runAsync(
      `INSERT INTO account (id, schwabEncryptedAccountId, nickname, assignedModelPortfolioId, lastSyncedAt, createdAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        accountId1,
        'schwab-enc-12345',
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
        'schwab-enc-67890',
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
        'schwab-enc-11111',
        'College Savings',
        modelId1,
        new Date().toISOString(),
        new Date().toISOString(),
      ]
    );

    // Create account snapshots with position data
    console.log('Creating account snapshots...');
    
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

    console.log('✅ Database seeded successfully!');
    console.log(`Created ${3} accounts with total value: $${(250000 + 500000 + 100000).toLocaleString()}`);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
}

// Run seed if called directly
if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

export default seed;
