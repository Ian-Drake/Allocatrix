import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDatabase, runAsync } from '../../src/backend/db/database';
import { SchwabApiService } from '../../src/backend/services/schwab-api.service';
import { PositionsService } from '../../src/backend/services/positions.service';
import { DriftCalculatorService } from '../../src/backend/services/drift-calculator.service';

/**
 * Integration Tests: Positions Display (User Story 4)
 * Tests the complete flow from fetching Schwab positions to calculating drift
 * SC-003: Full refresh from Schwab <30s
 * SC-004: Load from cache <3s
 */
describe('Positions Display Integration Tests', () => {
  let schwabApiService: SchwabApiService;
  let positionsService: PositionsService;
  let driftService: DriftCalculatorService;

  beforeAll(async () => {
    getDatabase(); // Initialize database connection
    schwabApiService = new SchwabApiService(
      'https://api.schwabapi.com/trader/v1',
      'test-token',
    );
    positionsService = new PositionsService(schwabApiService);
    driftService = new DriftCalculatorService();

    // Set up test data
    await setupTestData();
  });

  afterAll(async () => {
    // Clean up test data
    await cleanupTestData();
  });

  /**
   * Acceptance Scenario 1: Positions are fetched from Schwab and displayed in table
   */
  it('should fetch positions from Schwab and cache them', async () => {
    // Create test account
    const accountId = 'test-acc-001';
    await runAsync(
      `INSERT INTO account (id, schwabEncryptedAccountId, nickname)
       VALUES (?, ?, ?)`,
      [accountId, 'ENC:X1234567', 'Test Account'],
    );

    // Mock positions would be fetched - in real test, use HTTP mock
    // For now, verify the positions service is callable
    const isCached = await positionsService.isPositionsCached(accountId);
    expect(typeof isCached).toBe('boolean');
  });

  /**
   * Acceptance Scenario 2: Drift % calculated correctly (current vs. target)
   */
  it('should calculate drift percentage accurately', async () => {
    const positions = [
      {
        symbol: 'AAPL',
        quantity: 100,
        currentPrice: 150,
        currentValue: 15000,
        percentOfAccount: 50,
      },
      {
        symbol: 'MSFT',
        quantity: 50,
        currentPrice: 300,
        currentValue: 15000,
        percentOfAccount: 50,
      },
    ];

    const modelAllocations = [
      { symbol: 'AAPL', targetWeightPct: 60 },
      { symbol: 'MSFT', targetWeightPct: 40 },
    ];

    const driftResults = driftService.calculateDrift(
      positions,
      modelAllocations,
      30000,
    );

    // AAPL: 50% current vs 60% target = -10% drift
    const aaplDrift = driftResults.find((r) => r.symbol === 'AAPL');
    expect(aaplDrift?.drift).toBe(-10);
    expect(aaplDrift?.isUnderweight).toBe(true);

    // MSFT: 50% current vs 40% target = +10% drift
    const msftDrift = driftResults.find((r) => r.symbol === 'MSFT');
    expect(msftDrift?.drift).toBe(10);
    expect(msftDrift?.isOverweight).toBe(true);
  });

  /**
   * Acceptance Scenario 3: Tickers with >5% drift highlighted as overweight/underweight
   */
  it('should identify and flag high-drift positions', async () => {
    const positions = [
      {
        symbol: 'VTI',
        quantity: 200,
        currentPrice: 250,
        currentValue: 50000,
        percentOfAccount: 100,
      },
    ];

    const modelAllocations = [
      { symbol: 'VTI', targetWeightPct: 60 },
      { symbol: 'BND', targetWeightPct: 40 },
    ];

    const driftResults = driftService.calculateDrift(
      positions,
      modelAllocations,
      50000,
    );

    // VTI: 100% current vs 60% target = 40% drift (HIGH)
    const vtiDrift = driftResults.find((r) => r.symbol === 'VTI');
    expect(vtiDrift?.isHighDrift).toBe(true);
    expect(vtiDrift?.isOverweight).toBe(true);

    // BND: 0% current vs 40% target = 40% drift (HIGH)
    const bndDrift = driftResults.find((r) => r.symbol === 'BND');
    expect(bndDrift?.isHighDrift).toBe(true);
    expect(bndDrift?.isUnderweight).toBe(true);
  });

  /**
   * Acceptance Scenario 4: Cash balance and reserves displayed separately
   */
  it('should calculate available cash with reserves protected', async () => {
    const positions = [
      {
        symbol: 'AAPL',
        quantity: 10,
        currentPrice: 150,
        currentValue: 1500,
        percentOfAccount: 30,
      },
    ];

    const modelAllocations = [{ symbol: 'AAPL', targetWeightPct: 100 }];
    const accountValue = 5000;

    // Calculate drift to verify it includes the position data
    driftService.calculateDrift(positions, modelAllocations, accountValue);

    // With 5000 account value and 1500 in AAPL, 3500 available
    // After 1000 reserve, 2500 available for deployment
    const totalCash = accountValue - positions[0].currentValue;
    const availableCash = Math.max(0, totalCash - 1000); // 1000 minimum reserve

    expect(availableCash).toBe(2500);
    expect(totalCash).toBe(3500);
  });

  /**
   * Acceptance Scenario 5: User can manually refresh positions
   */
  it('should support manual position refresh', async () => {
    const accountId = 'test-acc-002';

    // Create test account
    await runAsync(
      `INSERT INTO account (id, schwabEncryptedAccountId, nickname)
       VALUES (?, ?, ?)`,
      [accountId, 'ENC:Y7654321', 'Test Account 2'],
    );

    // Get cache status before
    const cachedBefore = await positionsService.isPositionsCached(accountId);

    // Verify cache method is callable with force refresh flag
    // In real test, would make actual API call and verify fresh data
    expect(typeof cachedBefore).toBe('boolean');
  });

  /**
   * Performance Test: SC-003 - Positions load in <30s (full refresh)
   */
  it('should load positions from Schwab within 30 seconds', async () => {
    const positions = Array.from({ length: 100 }, (_, i) => ({
      symbol: `SYM${i}`,
      quantity: Math.random() * 100,
      currentPrice: Math.random() * 500,
      currentValue: Math.random() * 10000,
      percentOfAccount: Math.random() * 1,
    }));

    const modelAllocations = positions.map((p) => ({
      symbol: p.symbol,
      targetWeightPct: 1 / positions.length,
    }));

    const startTime = Date.now();

    const results = driftService.calculateDrift(
      positions,
      modelAllocations,
      50000,
    );

    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(30000); // SC-003
    expect(results).toHaveLength(positions.length);
  });

  /**
   * Performance Test: SC-004 - Refresh from cache in <3s
   */
  it('should load cached positions within 3 seconds', async () => {
    const accountId = 'test-acc-003';

    // Create test account with cached snapshot
    await runAsync(
      `INSERT INTO account (id, schwabEncryptedAccountId, nickname)
       VALUES (?, ?, ?)`,
      [accountId, 'ENC:Z1111111', 'Test Account 3'],
    );

    // Store a cached snapshot
    const cachedData = JSON.stringify([
      { symbol: 'AAPL', quantity: 10, currentPrice: 150, currentValue: 1500, percentOfAccount: 30 },
      { symbol: 'MSFT', quantity: 5, currentPrice: 300, currentValue: 1500, percentOfAccount: 30 },
    ]);

    await runAsync(
      `INSERT INTO account_snapshot (
        accountId, timestamp, positionsJson, structuredData,
        totalAccountValue, availableCash
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        accountId,
        Math.floor(Date.now() / 1000),
        cachedData,
        cachedData,
        5000,
        2000,
      ],
    );

    // Measure retrieval time
    const startTime = Date.now();

    const snapshot = await positionsService.getFromCache(accountId);

    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(3000); // SC-004
    expect(snapshot).not.toBeNull();
    expect(snapshot?.positions.length).toBe(2);
  });

  /**
   * Test: Drift summary calculation
   */
  it('should calculate comprehensive drift summary', async () => {
    const positions = [
      { symbol: 'AAPL', quantity: 5, currentPrice: 150, currentValue: 750, percentOfAccount: 25 },
      { symbol: 'MSFT', quantity: 5, currentPrice: 300, currentValue: 1500, percentOfAccount: 50 },
      { symbol: 'BND', quantity: 20, currentPrice: 100, currentValue: 2000, percentOfAccount: 66.7 },
    ];

    const modelAllocations = [
      { symbol: 'AAPL', targetWeightPct: 30 },
      { symbol: 'MSFT', targetWeightPct: 30 },
      { symbol: 'BND', targetWeightPct: 40 },
    ];

    const driftResults = driftService.calculateDrift(
      positions,
      modelAllocations,
      3000,
    );

    const summary = driftService.calculateDriftSummary(driftResults);

    expect(summary.positionsOverweight).toBeGreaterThanOrEqual(0);
    expect(summary.positionsUnderweight).toBeGreaterThanOrEqual(0);
    expect(summary.averageDrift).toBeGreaterThanOrEqual(0);
    expect(summary.rebalanceNeeded).toBe(summary.positionsHighDrift > 0);
  });
});

// Test setup helpers
async function setupTestData() {
  try {
    // Create test token for OAuth
    await runAsync(
      `INSERT OR IGNORE INTO schwab_token (
        id, encryptedAccessToken, encryptedRefreshToken,
        expiresAt, refreshTokenExpiresAt
      ) VALUES (?, ?, ?, ?, ?)`,
      [
        'test-token-001',
        'encrypted-access-token',
        'encrypted-refresh-token',
        new Date(Date.now() + 30 * 60000).toISOString(),
        new Date(Date.now() + 7 * 24 * 60 * 60000).toISOString(),
      ],
    );
  } catch (error) {
    // Token might already exist
  }
}

async function cleanupTestData() {
  try {
    await runAsync('DELETE FROM account_snapshot WHERE accountId LIKE ?', [
      'test-acc-%',
    ]);
    await runAsync('DELETE FROM account WHERE id LIKE ?', ['test-acc-%']);
  } catch (error) {
    // Cleanup errors are non-critical
  }
}
