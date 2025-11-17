import type { NextApiRequest, NextApiResponse } from 'next';
import { accountService } from '@/backend/services/account.service';

/**
 * POST /api/accounts/[id]/assign-model
 * Assign a valid model portfolio to an account and lock the model
 *
 * User Story 3: Account Model Assignment
 * Acceptance Scenario 2-3: Assign valid model and lock it
 *
 * Request Body:
 * {
 *   "modelPortfolioId": "uuid"
 * }
 *
 * Response: Updated account with model assignment
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({
      code: 'INVALID_REQUEST',
      message: 'Account ID is required',
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ code: 'METHOD_NOT_ALLOWED', message: 'Only POST requests are allowed' });
  }

  try {
    // TODO: Verify session/authentication
    const { modelPortfolioId } = req.body as { modelPortfolioId?: string };

    if (!modelPortfolioId) {
      return res.status(400).json({
        code: 'INVALID_REQUEST',
        message: 'modelPortfolioId is required',
      });
    }

    // Check if account already has an assignment
    const currentAccount = await accountService.getAccountById(id);

    if (currentAccount.assignedModelPortfolioId) {
      // Use reassign (User Story 3 scenario 4)
      const updated = await accountService.reassignModel(id, modelPortfolioId);
      return res.status(200).json(updated);
    } else {
      // First assignment (User Story 3 scenario 2-3)
      const updated = await accountService.assignModelToAccount(id, modelPortfolioId);
      return res.status(200).json(updated);
    }
  } catch (error) {
    console.error(`Failed to assign model to account ${id}:`, error);
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          code: 'NOT_FOUND',
          message: error.message,
        });
      }
      if (error.message.includes('Cannot assign model')) {
        return res.status(403).json({
          code: 'INVALID_MODEL_STATE',
          message: error.message,
        });
      }
    }
    return res.status(500).json({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to assign model',
    });
  }
}
