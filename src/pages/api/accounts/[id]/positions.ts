import type { NextApiRequest, NextApiResponse } from 'next';
import { PositionsService } from '../../../../backend/services/positions.service';
import { SchwabApiService } from '../../../../backend/services/schwab-api.service';
import { getAsync } from '../../../../backend/db/database';

interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
}

interface Position {
  symbol: string;
  quantity: number;
  currentPrice: number;
  currentValue: number;
  percentOfAccount: number;
}

interface PositionsResponse {
  success: boolean;
  data?: {
    accountId: string;
    timestamp: number;
    positions: Position[];
    totalAccountValue: number;
    availableCash: number;
    cacheAge: number | null;
    isCached: boolean;
  };
  error?: string;
}

/**
 * API Endpoint: GET /api/accounts/[id]/positions
 * Fetches current account positions from Schwab (or cache if fresh)
 * SC-003: Full refresh from Schwab <30s
 * SC-004: Load from cache <3s
 *
 * Query Parameters:
 * - forceRefresh: boolean (optional) - Force fetch from Schwab, skip cache
 *
 * Responses:
 * - 200: Positions retrieved successfully
 * - 400: Invalid account ID
 * - 401: Unauthorized (no OAuth token)
 * - 404: Account not found
 * - 503: Schwab API unavailable
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PositionsResponse | ErrorResponse>,
) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: `${req.method} is not supported`,
      statusCode: 405,
    });
  }

  const { id } = req.query;
  const forceRefresh = req.query.forceRefresh === 'true';

  // Validate account ID
  if (!id || typeof id !== 'string' || id.length === 0) {
    return res.status(400).json({
      error: 'Invalid account ID',
      message: 'Account ID is required and must be a non-empty string',
      statusCode: 400,
    });
  }

  try {
    // Check if account exists
    const account = await getAsync<{ id: string }>(
      'SELECT id FROM account WHERE id = ?',
      [id],
    );

    if (!account) {
      return res.status(404).json({
        error: 'Account not found',
        message: `Account with ID ${id} does not exist`,
        statusCode: 404,
      });
    }

    // Check if account has an OAuth token
    const token = await getAsync<{ id: string }>(
      'SELECT id FROM schwab_token LIMIT 1',
    );

    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No Schwab OAuth token found. Please authenticate first.',
        statusCode: 401,
      });
    }

    // Get access token from database (would be decrypted in real implementation)
    const tokenRow = await getAsync<{ encryptedAccessToken: string }>(
      'SELECT encryptedAccessToken FROM schwab_token LIMIT 1',
    );

    if (!tokenRow) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Failed to retrieve authentication token',
        statusCode: 401,
      });
    }

    // Initialize services
    const schwabApiService = new SchwabApiService(
      process.env.SCHWAB_API_BASE_URL || 'https://api.schwabapi.com/trader/v1',
      tokenRow.encryptedAccessToken, // In real implementation, decrypt this
    );

    const positionsService = new PositionsService(schwabApiService);

    // Fetch positions
    const snapshot = await positionsService.getAccountPositions(id, forceRefresh);

    // Get cache age
    const cacheAge = await positionsService.getCacheAge(id);
    const isCached = await positionsService.isPositionsCached(id);

    return res.status(200).json({
      success: true,
      data: {
        accountId: snapshot.accountId,
        timestamp: snapshot.timestamp,
        positions: snapshot.positions,
        totalAccountValue: snapshot.totalAccountValue,
        availableCash: snapshot.availableCash,
        cacheAge: cacheAge,
        isCached: isCached,
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error fetching positions:', error);

    if (error instanceof Error) {
      if (error.message.includes('Account not found')) {
        return res.status(404).json({
          error: 'Account not found',
          message: error.message,
          statusCode: 404,
        });
      }

      if (
        error.message.includes('circuit breaker') ||
        error.message.includes('unavailable')
      ) {
        return res.status(503).json({
          error: 'Service unavailable',
          message: 'Schwab API is temporarily unavailable. Please try again later.',
          statusCode: 503,
        });
      }

      if (error.message.includes('unauthorized')) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: error.message,
          statusCode: 401,
        });
      }

      // Generic error response
      return res.status(500).json({
        error: 'Internal server error',
        message: error.message,
        statusCode: 500,
      });
    }

    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred',
      statusCode: 500,
    });
  }
}
