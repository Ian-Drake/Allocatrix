/**
 * Bulk Actions API Service
 * 
 * Handles execution of bulk portfolio operations:
 * - Liquidate: Sell all positions at market
 * - Rebalance: Adjust positions to match model allocation
 * - Use Cash: Deploy available cash to match target allocation
 */

import type { ActionResult } from '../types/portfolio-dashboard.types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

/**
 * Execute liquidate action on selected accounts
 * Sells all positions at market price for specified accounts
 * 
 * @param accountIds - Array of account IDs to liquidate
 * @returns Action result with success/failure counts and details
 * @throws Error if API call fails
 */
export async function liquidateAccounts(
  accountIds: string[]
): Promise<ActionResult> {
  const response = await fetch(`${API_BASE_URL}/accounts/liquidate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ accountIds }),
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to liquidate accounts: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Execute rebalance action on selected accounts
 * Adjusts positions to match target model allocation
 * 
 * @param accountIds - Array of account IDs to rebalance
 * @returns Action result with success/failure counts and details
 * @throws Error if API call fails
 */
export async function rebalanceAccounts(
  accountIds: string[]
): Promise<ActionResult> {
  const response = await fetch(`${API_BASE_URL}/accounts/rebalance`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ accountIds }),
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to rebalance accounts: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Execute use-cash action on selected accounts
 * Deploys available cash to purchase securities matching target allocation
 * 
 * @param accountIds - Array of account IDs to deploy cash
 * @returns Action result with success/failure counts and details
 * @throws Error if API call fails
 */
export async function useCashOnAccounts(
  accountIds: string[]
): Promise<ActionResult> {
  const response = await fetch(`${API_BASE_URL}/accounts/use-cash`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ accountIds }),
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to deploy cash: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Retry wrapper for bulk action API calls
 * 
 * @param fn - Async function to retry
 * @param maxAttempts - Maximum number of retry attempts
 * @param delayMs - Initial delay in milliseconds
 * @returns Result of the function call
 * @throws Error if all retries fail
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxAttempts) {
        const delay = delayMs * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Failed after retries');
}

/**
 * Liquidate with retry logic
 */
export async function liquidateAccountsWithRetry(
  accountIds: string[]
): Promise<ActionResult> {
  return retryWithBackoff(() => liquidateAccounts(accountIds));
}

/**
 * Rebalance with retry logic
 */
export async function rebalanceAccountsWithRetry(
  accountIds: string[]
): Promise<ActionResult> {
  return retryWithBackoff(() => rebalanceAccounts(accountIds));
}

/**
 * Deploy cash with retry logic
 */
export async function deployUseCashWithRetry(
  accountIds: string[]
): Promise<ActionResult> {
  return retryWithBackoff(
    () => useCashOnAccounts(accountIds),
    3,
    1000
  );
}
