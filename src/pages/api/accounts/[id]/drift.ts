import type { NextApiRequest, NextApiResponse } from 'next';
import { DriftCalculatorService } from '../../../../backend/services/drift-calculator.service';
import { PositionsService } from '../../../../backend/services/positions.service';
import { SchwabApiService } from '../../../../backend/services/schwab-api.service';
import { getAsync, allAsync } from '../../../../backend/db/database';

interface DriftResult {
  symbol: string;
  currentWeight: number;
  targetWeight: number;
  drift: number;
  driftPct: number;
  isOverweight: boolean;
  isUnderweight: boolean;
  isHighDrift: boolean;
  currentValue: number;
  quantity: number;
  currentPrice: number;
}

interface DriftResponse {
  success: boolean;
  data?: {
    accountId: string;
    assignedModel: {
      id: string;
      name: string;
    };
    positions: DriftResult[];
    summary: {
      timestamp: number;
      totalDriftScore: number;
      maxDrift: number;
      minDrift: number;
      positionsOverweight: number;
      positionsUnderweight: number;
      positionsHighDrift: number;
      averageDrift: number;
      rebalanceNeeded: boolean;
    };
  };
  error?: string;
}

interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
}

/**
 * API Endpoint: GET /api/accounts/[id]/drift
 * Calculates drift between current positions and target model allocation
 * Positions are fetched from cache or Schwab, compared against assigned model
 *
 * Responses:
 * - 200: Drift calculated successfully
 * - 400: Invalid account ID or missing model assignment
 * - 401: Unauthorized (no OAuth token)
 * - 404: Account not found
 * - 503: Schwab API unavailable
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DriftResponse | ErrorResponse>,
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

  // Validate account ID
  if (!id || typeof id !== 'string' || id.length === 0) {
    return res.status(400).json({
      error: 'Invalid account ID',
      message: 'Account ID is required and must be a non-empty string',
      statusCode: 400,
    });
  }

  try {
    // Get account with model assignment
    const account = await getAsync<{
      id: string;
      assignedModelPortfolioId: string | null;
    }>(
      'SELECT id, assignedModelPortfolioId FROM account WHERE id = ?',
      [id],
    );

    if (!account) {
      return res.status(404).json({
        error: 'Account not found',
        message: `Account with ID ${id} does not exist`,
        statusCode: 404,
      });
    }

    if (!account.assignedModelPortfolioId) {
      return res.status(400).json({
        error: 'No model assigned',
        message:
          'Account does not have an assigned model portfolio. Please assign a model first.',
        statusCode: 400,
      });
    }

    // Get model details
    const model = await getAsync<{ id: string; name: string }>(
      'SELECT id, name FROM model_portfolio WHERE id = ?',
      [account.assignedModelPortfolioId],
    );

    if (!model) {
      return res.status(400).json({
        error: 'Model not found',
        message: `Assigned model portfolio not found`,
        statusCode: 400,
      });
    }

    // Get model allocations (tickers with target weights)
    const modelAllocations = await allAsync<{
      symbol: string;
      targetWeightPct: number;
    }>(
      `SELECT ta.symbol, (mpac.targetWeightPct * ta.targetWeightPctWithinAssetClass / 100) as targetWeightPct
       FROM ticker_allocation ta
       JOIN model_portfolio_asset_class mpac ON ta.assetClassId = mpac.assetClassId
       WHERE mpac.modelPortfolioId = ?`,
      [account.assignedModelPortfolioId],
    );

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
    const driftService = new DriftCalculatorService();

    // Fetch positions
    const snapshot = await positionsService.getAccountPositions(id);

    // Calculate drift
    const driftCalculations = driftService.calculateDrift(
      snapshot.positions,
      modelAllocations,
      snapshot.totalAccountValue,
    );

    // Calculate summary metrics
    const summary = driftService.calculateDriftSummary(driftCalculations);

    return res.status(200).json({
      success: true,
      data: {
        accountId: id,
        assignedModel: {
          id: model.id,
          name: model.name,
        },
        positions: driftCalculations,
        summary: {
          timestamp: summary.timestamp,
          totalDriftScore: summary.totalDriftScore,
          maxDrift: summary.maxDrift,
          minDrift: summary.minDrift,
          positionsOverweight: summary.positionsOverweight,
          positionsUnderweight: summary.positionsUnderweight,
          positionsHighDrift: summary.positionsHighDrift,
          averageDrift: summary.averageDrift,
          rebalanceNeeded: summary.rebalanceNeeded,
        },
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error calculating drift:', error);

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
