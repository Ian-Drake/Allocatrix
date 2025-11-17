import { getAsync, allAsync, runAsync } from '../db/database';
import { SchwabApiService } from './schwab-api.service';

interface SchwabAccountData {
  accountNumber: string;
  accountType: string;
  isDayTrader: boolean;
  isClosingOnlyRestricted: boolean;
  positions?: Array<{
    symbol: string;
    quantity: number;
    price: number;
    marketValue: number;
    percentOfAccount: number;
  }>;
  balances?: {
    accountValue: number;
    buyingPower: number;
    cashBalance: number;
    cashAvailableForTrading: number;
  };
}

interface CachedPosition {
  symbol: string;
  quantity: number;
  currentPrice: number;
  currentValue: number;
  percentOfAccount: number;
}

interface PositionsSnapshot {
  accountId: string;
  timestamp: number;
  positions: CachedPosition[];
  totalAccountValue: number;
  availableCash: number;
  isStale: boolean;
}

interface CachedRow {
  id: string;
  timestamp: number;
  structuredData: string;
  totalAccountValue: number;
  availableCash: number;
}

interface AccountRow {
  schwabEncryptedAccountId: string;
}

/**
 * Positions Service
 * Handles fetching account positions from Schwab and caching them in SQLite
 * SC-003: Full refresh from Schwab <30s
 * SC-004: Load from cache <3s
 */
export class PositionsService {
  private readonly cacheExpirationMs = 5 * 60 * 1000; // 5 minutes default cache
  private readonly minReserveAmount = 1000; // Minimum cash to hold in reserve

  constructor(private schwabApiService: SchwabApiService) {}

  /**
   * Get current positions for an account
   * First checks cache, fetches from Schwab if cache expired
   */
  async getAccountPositions(
    accountId: string,
    forceRefresh: boolean = false,
  ): Promise<PositionsSnapshot> {
    // Try to get from cache first
    if (!forceRefresh) {
      const cachedSnapshot = await this.getFromCache(accountId);
      if (cachedSnapshot && !cachedSnapshot.isStale) {
        return cachedSnapshot;
      }
    }

    // Cache miss or stale - fetch from Schwab
    return await this.fetchAndCachePositions(accountId);
  }

  /**
   * Get only cached positions without fetching
   */
  async getFromCache(accountId: string): Promise<PositionsSnapshot | null> {
    try {
      const row = await getAsync<CachedRow>(
        `SELECT 
          id,
          timestamp,
          structuredData,
          totalAccountValue,
          availableCash
        FROM account_snapshot
        WHERE accountId = ?
        ORDER BY timestamp DESC
        LIMIT 1`,
        [accountId],
      );

      if (!row) {
        return null;
      }

      const isStale =
        Date.now() - row.timestamp * 1000 > this.cacheExpirationMs;

      const structuredData = JSON.parse(row.structuredData);

      return {
        accountId,
        timestamp: row.timestamp * 1000,
        positions: structuredData,
        totalAccountValue: row.totalAccountValue,
        availableCash: row.availableCash,
        isStale,
      };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error retrieving cached positions:', error);
      return null;
    }
  }

  /**
   * Fetch positions from Schwab and cache in database
   */
  private async fetchAndCachePositions(
    accountId: string,
  ): Promise<PositionsSnapshot> {
    // Get encrypted account number from database
    const encryptedAccountId = await this.getEncryptedAccountId(accountId);

    if (!encryptedAccountId) {
      throw new Error(`Account not found: ${accountId}`);
    }

    // Fetch from Schwab API
    const schwabAccount = (await this.schwabApiService.getAccountPositions(
      encryptedAccountId,
    )) as SchwabAccountData;

    // Transform Schwab response to our format
    const positions = this.transformPositions(schwabAccount);

    // Calculate available cash (total - reserve)
    const schwabCash = schwabAccount.balances?.cashBalance || 0;
    const availableCash = Math.max(0, schwabCash - this.minReserveAmount);

    const snapshot: PositionsSnapshot = {
      accountId,
      timestamp: Date.now(),
      positions,
      totalAccountValue: schwabAccount.balances?.accountValue || 0,
      availableCash,
      isStale: false,
    };

    // Cache in database
    await this.cachePositionsInDb(accountId, snapshot);

    return snapshot;
  }

  /**
   * Transform Schwab position format to our internal format
   */
  private transformPositions(schwabAccount: SchwabAccountData): CachedPosition[] {
    if (!schwabAccount.positions || !Array.isArray(schwabAccount.positions)) {
      return [];
    }

    const totalValue = schwabAccount.balances?.accountValue || 0;

    return schwabAccount.positions.map((pos) => ({
      symbol: pos.symbol,
      quantity: pos.quantity,
      currentPrice: pos.price,
      currentValue: pos.marketValue,
      percentOfAccount: totalValue > 0 ? (pos.marketValue / totalValue) * 100 : 0,
    }));
  }

  /**
   * Store positions snapshot in database
   */
  private async cachePositionsInDb(
    accountId: string,
    snapshot: PositionsSnapshot,
  ): Promise<void> {
    try {
      const positionsJson = JSON.stringify({
        positions: snapshot.positions,
        timestamp: snapshot.timestamp,
      });

      const structuredData = JSON.stringify(snapshot.positions);

      await runAsync(
        `INSERT INTO account_snapshot (
          accountId,
          timestamp,
          positionsJson,
          structuredData,
          totalAccountValue,
          availableCash
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          accountId,
          Math.floor(snapshot.timestamp / 1000), // Store as Unix timestamp in seconds
          positionsJson,
          structuredData,
          snapshot.totalAccountValue,
          snapshot.availableCash,
        ],
      );
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error caching positions in database:', error);
      // Don't throw - allow application to continue with fresh data
    }
  }

  /**
   * Get encrypted account ID from database
   */
  private async getEncryptedAccountId(accountId: string): Promise<string | null> {
    try {
      const row = await getAsync<AccountRow>(
        'SELECT schwabEncryptedAccountId FROM account WHERE id = ?',
        [accountId],
      );
      return row?.schwabEncryptedAccountId || null;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error retrieving account:', error);
      return null;
    }
  }

  /**
   * Clear old cached snapshots (older than 30 days)
   */
  async clearExpiredCache(): Promise<number> {
    try {
      const thirtyDaysAgoMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const thirtyDaysAgoSec = Math.floor(thirtyDaysAgoMs / 1000);

      // Since runAsync doesn't return changes count, we'll count before deleting
      const oldSnapshots = await allAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM account_snapshot WHERE timestamp < ?',
        [thirtyDaysAgoSec],
      );

      const count = oldSnapshots[0]?.count || 0;

      await runAsync('DELETE FROM account_snapshot WHERE timestamp < ?', [
        thirtyDaysAgoSec,
      ]);

      return count;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error clearing expired cache:', error);
      return 0;
    }
  }

  /**
   * Get position history for an account (for analysis)
   */
  async getPositionHistory(
    accountId: string,
    limitDays: number = 30,
  ): Promise<PositionsSnapshot[]> {
    try {
      const limitSec = Math.floor(
        (Date.now() - limitDays * 24 * 60 * 60 * 1000) / 1000,
      );

      const rows = await allAsync<CachedRow>(
        `SELECT 
          id,
          timestamp,
          structuredData,
          totalAccountValue,
          availableCash
        FROM account_snapshot
        WHERE accountId = ? AND timestamp > ?
        ORDER BY timestamp DESC`,
        [accountId, limitSec],
      );

      return rows.map((row) => ({
        accountId,
        timestamp: row.timestamp * 1000, // Convert back to ms
        positions: JSON.parse(row.structuredData),
        totalAccountValue: row.totalAccountValue,
        availableCash: row.availableCash,
        isStale: false,
      }));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error retrieving position history:', error);
      return [];
    }
  }

  /**
   * Get total account value history
   */
  async getAccountValueHistory(
    accountId: string,
    limitDays: number = 30,
  ): Promise<Array<{ timestamp: number; value: number }>> {
    try {
      const limitSec = Math.floor(
        (Date.now() - limitDays * 24 * 60 * 60 * 1000) / 1000,
      );

      const rows = await allAsync<{ timestamp: number; totalAccountValue: number }>(
        `SELECT timestamp, totalAccountValue
        FROM account_snapshot
        WHERE accountId = ? AND timestamp > ?
        ORDER BY timestamp ASC`,
        [accountId, limitSec],
      );

      return rows.map((row) => ({
        timestamp: row.timestamp * 1000, // Convert back to ms
        value: row.totalAccountValue,
      }));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error retrieving account value history:', error);
      return [];
    }
  }

  /**
   * Check if positions are cached (and not stale)
   */
  async isPositionsCached(accountId: string): Promise<boolean> {
    const snapshot = await this.getFromCache(accountId);
    return snapshot !== null && !snapshot.isStale;
  }

  /**
   * Get cache age in milliseconds
   */
  async getCacheAge(accountId: string): Promise<number | null> {
    const snapshot = await this.getFromCache(accountId);
    if (!snapshot) {
      return null;
    }
    return Date.now() - snapshot.timestamp;
  }
}
