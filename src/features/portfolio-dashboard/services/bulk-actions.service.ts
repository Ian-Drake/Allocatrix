/**
 * Bulk Actions API Service
 * 
 * Handles execution of bulk portfolio operations:
 * - Liquidate: Sell all positions at market
 * - Rebalance: Adjust positions to match model allocation
 * - Use Cash: Deploy available cash to match target allocation
 */

import type { ActionResult } from '../types/portfolio-dashboard.types';
import { logger } from '../../../backend/utils/logger';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

/**
 * Structured error response for API failures
 */
export interface APIError extends Error {
  statusCode?: number;
  code?: string;
  details?: Record<string, unknown>;
}

/**
 * Create structured API error
 */
function createAPIError(
  message: string,
  statusCode?: number,
  code?: string,
  details?: Record<string, unknown>
): APIError {
  const error = new Error(message) as APIError;
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  return error;
}

/**
 * Parse error response from API
 */
async function parseAPIError(response: Response): Promise<APIError> {
  let errorData: Record<string, unknown> = {};
  try {
    errorData = await response.json() as Record<string, unknown>;
  } catch {
    // If response is not JSON, use status text
  }

  const error = (errorData.error as Record<string, unknown>) || {};
  return createAPIError(
    (error.message as string) || `API error: ${response.statusText}`,
    response.status,
    (error.code as string),
    (error.details as Record<string, unknown>)
  );
}

/**
 * Validate action result response schema
 */
function validateActionResult(data: unknown): ActionResult {
  const result = data as Record<string, unknown>;
  
  if (
    typeof result.success !== 'boolean' ||
    typeof result.successCount !== 'number' ||
    typeof result.failureCount !== 'number' ||
    !Array.isArray(result.errors) ||
    typeof result.message !== 'string'
  ) {
    throw createAPIError(
      'Invalid action result response schema',
      500,
      'SCHEMA_VALIDATION_ERROR'
    );
  }

  // Validate error array structure
  for (const error of result.errors) {
    const errorObj = error as Record<string, unknown>;
    if (typeof errorObj.accountId !== 'string' || typeof errorObj.reason !== 'string') {
      throw createAPIError(
        'Invalid error entry in action result',
        500,
        'SCHEMA_VALIDATION_ERROR'
      );
    }
  }

  return result as unknown as ActionResult;
}

/**
 * Validate account IDs array
 */
function validateAccountIds(accountIds: unknown): asserts accountIds is string[] {
  if (
    !Array.isArray(accountIds) ||
    accountIds.length === 0 ||
    accountIds.some((id) => typeof id !== 'string' || id.trim() === '')
  ) {
    throw createAPIError(
      'Account IDs must be a non-empty array of non-empty strings',
      400,
      'VALIDATION_ERROR'
    );
  }
}

/**
 * Execute liquidate action on selected accounts
 * Sells all positions at market price for specified accounts
 * 
 * @param accountIds - Array of account IDs to liquidate
 * @returns Action result with success/failure counts and details
 * @throws APIError if validation or API call fails
 */
export async function liquidateAccounts(
  accountIds: string[]
): Promise<ActionResult> {
  try {
    validateAccountIds(accountIds);

    const response = await fetch(`${API_BASE_URL}/accounts/liquidate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ accountIds }),
      credentials: 'include',
    });

    if (!response.ok) {
      throw await parseAPIError(response);
    }

    const data = await response.json();
    return validateActionResult(data);
  } catch (error) {
    logger.error('Failed to liquidate accounts', { accountIds }, error as Error);
    throw error;
  }
}

/**
 * Execute rebalance action on selected accounts
 * Adjusts positions to match target model allocation
 * 
 * @param accountIds - Array of account IDs to rebalance
 * @returns Action result with success/failure counts and details
 * @throws APIError if validation or API call fails
 */
export async function rebalanceAccounts(
  accountIds: string[]
): Promise<ActionResult> {
  try {
    validateAccountIds(accountIds);

    const response = await fetch(`${API_BASE_URL}/accounts/rebalance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ accountIds }),
      credentials: 'include',
    });

    if (!response.ok) {
      throw await parseAPIError(response);
    }

    const data = await response.json();
    return validateActionResult(data);
  } catch (error) {
    logger.error('Failed to rebalance accounts', { accountIds }, error as Error);
    throw error;
  }
}

/**
 * Execute use-cash action on selected accounts
 * Deploys available cash to purchase securities matching target allocation
 * 
 * @param accountIds - Array of account IDs to deploy cash
 * @returns Action result with success/failure counts and details
 * @throws APIError if validation or API call fails
 */
export async function useCashOnAccounts(
  accountIds: string[]
): Promise<ActionResult> {
  try {
    validateAccountIds(accountIds);

    const response = await fetch(`${API_BASE_URL}/accounts/use-cash`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ accountIds }),
      credentials: 'include',
    });

    if (!response.ok) {
      throw await parseAPIError(response);
    }

    const data = await response.json();
    return validateActionResult(data);
  } catch (error) {
    logger.error('Failed to deploy cash on accounts', { accountIds }, error as Error);
    throw error;
  }
}

/**
 * Retry wrapper for bulk action API calls
 * Only retries on network errors or 5xx responses
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
      const apiError = error as APIError;

      // Don't retry on validation errors (4xx) - only network or 5xx
      if (apiError.statusCode && apiError.statusCode < 500) {
        throw error;
      }

      if (attempt < maxAttempts) {
        const delay = delayMs * Math.pow(2, attempt - 1);
        logger.info(`Retrying bulk action after ${delay}ms (attempt ${attempt}/${maxAttempts})`, {
          error: apiError.message,
        });
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Failed after retries');
}

/**
 * Liquidate with retry logic
 * Retries only on network/500 errors, not validation errors
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
