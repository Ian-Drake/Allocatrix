/**
 * Transaction Utility
 * Provides transaction support for atomic operations (all succeed or all fail)
 * Used for rebalance operations where all trades must succeed together
 * 
 * User Story 6: Full Rebalance (Priority: P2)
 * Requirement: SC-015 - Rebalance trades atomic (all succeed or all fail)
 */

import { getDatabase } from '../db/database';

/**
 * Transaction callback function that performs database operations
 * If it throws an error, the transaction is rolled back
 */
export type TransactionCallback<T> = () => Promise<T>;

/**
 * Execute a database operation within a transaction
 * Automatically handles BEGIN TRANSACTION and COMMIT/ROLLBACK
 * 
 * Example:
 * ```
 * const result = await executeTransaction(async () => {
 *   await runAsync('INSERT INTO trades (symbol, action) VALUES (?, ?)', ['AAPL', 'BUY']);
 *   await runAsync('UPDATE account_snapshot SET totalValue = ? WHERE id = ?', [12000, 'acc-001']);
 *   return { success: true };
 * });
 * ```
 * 
 * @param callback - Async function containing database operations
 * @returns Result from callback if transaction commits
 * @throws Error with details if transaction fails
 */
export async function executeTransaction<T>(callback: TransactionCallback<T>): Promise<T> {
  const db = getDatabase();

  return new Promise((resolve, reject) => {
    // Start transaction
    db.run('BEGIN TRANSACTION', (beginErr) => {
      if (beginErr) {
        return reject(new Error(`Failed to begin transaction: ${beginErr.message}`));
      }

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      (async () => {
        try {
          // Execute the callback with all database operations
          const result = await callback();

          // Commit the transaction
          db.run('COMMIT', (commitErr) => {
            if (commitErr) {
              // Attempt rollback if commit fails
              db.run('ROLLBACK', (rollbackErr) => {
                const message = `Transaction commit failed: ${commitErr.message}. Rollback ${
                  rollbackErr ? 'also failed' : 'succeeded'
                }.`;
                reject(new Error(message));
              });
            } else {
              resolve(result);
            }
          });
        } catch (error) {
          // Rollback on error in callback
          db.run('ROLLBACK', (rollbackErr) => {
            const originalError = error instanceof Error ? error.message : String(error);
            const message = `Transaction failed: ${originalError}. Rollback ${
              rollbackErr ? `also failed: ${rollbackErr.message}` : 'succeeded'
            }.`;
            reject(new Error(message));
          });
        }
      })();
    });
  });
}

/**
 * Verify a transaction executed successfully by checking result
 * Useful for integration tests
 * 
 * @param result - Result from transaction execution
 * @returns true if result indicates success
 */
export function isTransactionSuccessful<T>(result: T): boolean {
  if (typeof result === 'object' && result !== null) {
    const obj = result as Record<string, unknown>;
    return obj.success === true || obj.transactionId !== undefined;
  }
  return false;
}
