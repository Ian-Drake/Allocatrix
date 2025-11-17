import type { NextApiRequest, NextApiResponse } from 'next';
import { accountService } from '@/backend/services/account.service';

/**
 * GET /api/accounts/[id]
 * Retrieve specific account details with positions and model assignment
 *
 * User Story 3: Account Model Assignment
 * Acceptance Scenario 1: User can view linked accounts with assignment info
 *
 * Query Parameters:
 * - id: Account UUID (required, from route)
 *
 * Response: Account with positions, total value, available cash
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({
      code: 'INVALID_REQUEST',
      message: 'Account ID is required',
    });
  }

  if (req.method === 'GET') {
    return handleGet(id, res);
  } else if (req.method === 'PUT') {
    return handlePut(id, req, res);
  } else {
    return res.status(405).json({ code: 'METHOD_NOT_ALLOWED', message: 'Only GET and PUT requests are allowed' });
  }
}

async function handleGet(accountId: string, res: NextApiResponse) {
  try {
    // TODO: Verify session/authentication
    const account = await accountService.getAccountById(accountId);
    return res.status(200).json(account);
  } catch (error) {
    console.error(`Failed to get account ${accountId}:`, error);
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: error.message,
      });
    }
    return res.status(500).json({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to retrieve account',
    });
  }
}

interface UpdateAccountRequest {
  nickname?: string;
  assignedModelPortfolioId?: string | null;
}

async function handlePut(accountId: string, req: NextApiRequest, res: NextApiResponse) {
  try {
    // TODO: Verify session/authentication
    const { nickname, assignedModelPortfolioId } = req.body as UpdateAccountRequest;

    // Update nickname if provided
    if (nickname !== undefined) {
      await accountService.updateAccountNickname(accountId, nickname);
    }

    // Handle model assignment if provided
    if (assignedModelPortfolioId !== undefined) {
      if (assignedModelPortfolioId === null) {
        // Unassign model
        await accountService.unassignModel(accountId);
      } else {
        // Assign or reassign model
        const currentAccount = await accountService.getAccountById(accountId);
        if (currentAccount.assignedModelPortfolioId) {
          // Already has a model, so reassign
          await accountService.reassignModel(accountId, assignedModelPortfolioId);
        } else {
          // First assignment
          await accountService.assignModelToAccount(accountId, assignedModelPortfolioId);
        }
      }
    }

    // Return updated account
    const updatedAccount = await accountService.getAccountById(accountId);
    return res.status(200).json(updatedAccount);
  } catch (error) {
    console.error(`Failed to update account ${accountId}:`, error);
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
      message: 'Failed to update account',
    });
  }
}
