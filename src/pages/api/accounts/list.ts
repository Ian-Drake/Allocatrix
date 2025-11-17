import type { NextApiRequest, NextApiResponse } from 'next';
import { accountService } from '@/backend/services/account.service';

/**
 * GET /api/accounts
 * List all linked Schwab accounts for the authenticated user
 *
 * User Story 3: Account Model Assignment
 * Acceptance Scenario 1: User can view linked accounts from Schwab
 *
 * Response: Array of accounts with optional model assignment
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ code: 'METHOD_NOT_ALLOWED', message: 'Only GET requests are allowed' });
  }

  try {
    // TODO: Verify session/authentication middleware would have run
    // This endpoint requires valid session (auth-guard middleware)
    const accounts = await accountService.getAllAccounts();

    return res.status(200).json(accounts);
  } catch (error) {
    console.error('Failed to list accounts:', error);
    return res.status(500).json({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to retrieve accounts',
    });
  }
}
