import { v4 as uuid } from 'uuid';
import { allAsync, getAsync, runAsync } from '../db/database';
import type { Account, AccountDetail, Position } from '../types/index';

/**
 * AccountService handles account management, model assignment, and account-related queries.
 * Responsibilities:
 * - Link Schwab accounts from OAuth
 * - Retrieve accounts with positions
 * - Assign model portfolios to accounts (locks the model)
 * - Handle model reassignment
 * - Track account sync status
 */
export class AccountService {
  /**
   * Get all linked Schwab accounts for this user
   * @returns List of accounts with optional model assignment
   */
  async getAllAccounts(): Promise<Account[]> {
    try {
      const rows = await allAsync<{
        id: string;
        nickname: string | null;
        assignedModelPortfolioId: string | null;
        assignedModelPortfolioName: string | null;
        lastSyncedAt: string | null;
        createdAt: string;
      }>(
        `
        SELECT 
          a.id,
          a.nickname,
          a.assignedModelPortfolioId,
          mp.name as assignedModelPortfolioName,
          a.lastSyncedAt,
          a.createdAt
        FROM account a
        LEFT JOIN model_portfolio mp ON a.assignedModelPortfolioId = mp.id
        ORDER BY a.createdAt DESC
      `
      );

      return rows.map((row) => ({
        id: row.id,
        nickname: row.nickname || `Account ${row.id.slice(0, 8)}`,
        assignedModelPortfolioId: row.assignedModelPortfolioId,
        assignedModelPortfolioName: row.assignedModelPortfolioName,
        lastSyncedAt: row.lastSyncedAt,
        createdAt: row.createdAt,
      }));
    } catch (error) {
      throw new Error(`Failed to retrieve accounts: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get a specific account by ID with optional positions
   * @param accountId - Account UUID
   * @returns Account details with positions (if assigned and synced)
   */
  async getAccountById(accountId: string): Promise<AccountDetail> {
    try {
      const row = await getAsync<{
        id: string;
        nickname: string | null;
        assignedModelPortfolioId: string | null;
        assignedModelPortfolioName: string | null;
        lastSyncedAt: string | null;
        createdAt: string;
      }>(
        `
        SELECT 
          a.id,
          a.nickname,
          a.assignedModelPortfolioId,
          mp.name as assignedModelPortfolioName,
          a.lastSyncedAt,
          a.createdAt
        FROM account a
        LEFT JOIN model_portfolio mp ON a.assignedModelPortfolioId = mp.id
        WHERE a.id = ?
      `,
        [accountId]
      );

      if (!row) {
        throw new Error(`Account ${accountId} not found`);
      }

      // Get latest positions snapshot if available
      const snapshot = await getAsync<{
        structuredData: string;
        totalAccountValue: number;
        availableCash: number;
        timestamp: string;
      }>(
        `
        SELECT structuredData, totalAccountValue, availableCash, timestamp
        FROM account_snapshot
        WHERE accountId = ?
        ORDER BY timestamp DESC
        LIMIT 1
      `,
        [accountId]
      );

      let positions: Position[] = [];
      let totalAccountValue = 0;
      let availableCash = 0;

      if (snapshot) {
        try {
          const structuredData = JSON.parse(snapshot.structuredData) as Record<
            string,
            { qty: number; price: number; value: number; weight: number }
          >;
          positions = Object.entries(structuredData).map(([symbol, data]) => ({
            symbol,
            displayName: symbol,
            quantity: data.qty,
            currentPrice: data.price,
            currentValue: data.value,
            currentAllocationPct: data.weight,
          }));
          totalAccountValue = snapshot.totalAccountValue;
          availableCash = snapshot.availableCash;
        } catch (e) {
          console.error(`Failed to parse positions for account ${accountId}:`, e);
        }
      }

      return {
        id: row.id,
        nickname: row.nickname || `Account ${row.id.slice(0, 8)}`,
        assignedModelPortfolioId: row.assignedModelPortfolioId,
        assignedModelPortfolioName: row.assignedModelPortfolioName,
        lastSyncedAt: row.lastSyncedAt,
        createdAt: row.createdAt,
        positions,
        totalAccountValue,
        availableCash,
      };
    } catch (error) {
      throw new Error(
        `Failed to retrieve account ${accountId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Create a new account record after OAuth linking
   * @param schwabEncryptedAccountId - Encrypted Schwab account ID from OAuth
   * @param nickname - Optional user-friendly nickname
   * @returns New account record
   */
  async createAccount(schwabEncryptedAccountId: string, nickname?: string): Promise<Account> {
    try {
      const accountId = uuid();
      const now = new Date().toISOString();

      await runAsync(
        `
        INSERT INTO account (id, schwabEncryptedAccountId, nickname, createdAt)
        VALUES (?, ?, ?, ?)
      `,
        [accountId, schwabEncryptedAccountId, nickname || null, now]
      );

      return {
        id: accountId,
        nickname: nickname || `Account ${accountId.slice(0, 8)}`,
        lastSyncedAt: null,
        createdAt: now,
      };
    } catch (error) {
      throw new Error(`Failed to create account: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Update account nickname
   * @param accountId - Account UUID
   * @param nickname - New nickname
   * @returns Updated account
   */
  async updateAccountNickname(accountId: string, nickname: string): Promise<Account> {
    try {
      await runAsync(
        `
        UPDATE account
        SET nickname = ?
        WHERE id = ?
      `,
        [nickname, accountId]
      );

      return this.getAccountById(accountId);
    } catch (error) {
      throw new Error(`Failed to update account: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Assign a valid model portfolio to an account and lock the model
   * User Story 3 core operation: lock model when first assigned
   * 
   * @param accountId - Account UUID
   * @param modelPortfolioId - Model Portfolio UUID (must be in Valid state)
   * @returns Updated account with model assignment
   * @throws Error if model is not in Valid state or doesn't exist
   */
  async assignModelToAccount(accountId: string, modelPortfolioId: string): Promise<Account> {
    try {
      // Verify account exists
      const account = await getAsync<{ id: string }>('SELECT id FROM account WHERE id = ?', [accountId]);
      if (!account) {
        throw new Error(`Account ${accountId} not found`);
      }

      // Verify model exists and is in Valid state
      const model = await getAsync<{ id: string; status: string }>(
        'SELECT id, status FROM model_portfolio WHERE id = ?',
        [modelPortfolioId]
      );
      if (!model) {
        throw new Error(`Model portfolio ${modelPortfolioId} not found`);
      }
      if (model.status !== 'Valid') {
        throw new Error(
          `Cannot assign model in ${model.status} state. Only Valid models can be assigned. Please validate the model first.`
        );
      }

      // Update account with model assignment
      await runAsync(
        `
        UPDATE account
        SET assignedModelPortfolioId = ?, lastSyncedAt = ?
        WHERE id = ?
      `,
        [modelPortfolioId, new Date().toISOString(), accountId]
      );

      // Lock the model portfolio (transition Valid → Locked)
      await runAsync(
        `
        UPDATE model_portfolio
        SET status = 'Locked', updatedAt = ?
        WHERE id = ?
      `,
        [new Date().toISOString(), modelPortfolioId]
      );

      // Create audit log entry
      await this.createAuditLogEntry({
        action: 'MODEL_ASSIGNED',
        accountId,
        details: {
          modelPortfolioId,
          action: 'Model assigned to account',
        },
        status: 'executed',
      });

      return this.getAccountById(accountId);
    } catch (error) {
      throw new Error(
        `Failed to assign model to account: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Reassign account to a different model portfolio
   * User Story 3 scenario 4: handle model reassignment
   * Previous model may remain locked if no other accounts use it
   *
   * @param accountId - Account UUID
   * @param newModelPortfolioId - New Model Portfolio UUID (must be in Valid state)
   * @returns Updated account with new model assignment
   */
  async reassignModel(accountId: string, newModelPortfolioId: string): Promise<Account> {
    try {
      // Get current assignment
      const account = await getAsync<{ assignedModelPortfolioId: string | null }>(
        'SELECT assignedModelPortfolioId FROM account WHERE id = ?',
        [accountId]
      );

      if (!account) {
        throw new Error(`Account ${accountId} not found`);
      }

      const previousModelId = account.assignedModelPortfolioId;

      // Assign new model (this will lock it)
      const result = await this.assignModelToAccount(accountId, newModelPortfolioId);

      // Check if previous model is still in use by other accounts
      if (previousModelId) {
        const countResult = await getAsync<{ count: number }>(
          `
          SELECT COUNT(*) as count
          FROM account
          WHERE assignedModelPortfolioId = ? AND id != ?
        `,
          [previousModelId, accountId]
        );

        // If previous model is no longer used by any account, it can be unlocked (optional)
        // For now, we leave it locked as per spec: "Previous model remains locked after reassignment"
        if (countResult && countResult.count === 0) {
          // Optionally unlock previous model if you want different behavior
          // For MVP, we keep it locked to maintain audit trail
        }
      }

      // Create audit log entry for reassignment
      await this.createAuditLogEntry({
        action: 'MODEL_REASSIGNED',
        accountId,
        details: {
          previousModelPortfolioId: previousModelId,
          newModelPortfolioId,
          action: 'Model reassigned to different portfolio',
        },
        status: 'executed',
      });

      return result;
    } catch (error) {
      throw new Error(
        `Failed to reassign model: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Unassign model from account (optional operation)
   * @param accountId - Account UUID
   * @returns Updated account
   */
  async unassignModel(accountId: string): Promise<Account> {
    try {
      await runAsync(
        `
        UPDATE account
        SET assignedModelPortfolioId = NULL
        WHERE id = ?
      `,
        [accountId]
      );

      await this.createAuditLogEntry({
        action: 'MODEL_UNASSIGNED',
        accountId,
        details: {
          action: 'Model unassigned from account',
        },
        status: 'executed',
      });

      return this.getAccountById(accountId);
    } catch (error) {
      throw new Error(`Failed to unassign model: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Update account sync timestamp (called after fetching positions from Schwab)
   * @param accountId - Account UUID
   */
  async updateSyncTimestamp(accountId: string): Promise<void> {
    try {
      await runAsync(
        `
        UPDATE account
        SET lastSyncedAt = ?
        WHERE id = ?
      `,
        [new Date().toISOString(), accountId]
      );
    } catch (error) {
      throw new Error(
        `Failed to update sync timestamp: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Helper: Create audit log entry
   */
  private async createAuditLogEntry(entry: {
    action: string;
    accountId?: string;
    details: unknown;
    status: string;
  }): Promise<void> {
    try {
      await runAsync(
        `
        INSERT INTO audit_log_entry (id, timestamp, action, accountId, details, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
        [
          uuid(),
          new Date().toISOString(),
          entry.action,
          entry.accountId || null,
          JSON.stringify(entry.details),
          entry.status,
        ]
      );
    } catch (error) {
      console.error('Failed to create audit log entry:', error);
      // Don't throw - audit logging failure should not block account operations
    }
  }
}

// Export singleton instance
export const accountService = new AccountService();
