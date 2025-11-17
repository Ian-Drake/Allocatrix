import { NextApiResponse } from 'next';
import { AuthenticatedRequest } from '../../../backend/middleware/session.middleware';
import { authGuardMiddleware } from '../../../backend/middleware/auth-guard';
import * as authService from '../../../backend/services/auth.service';

/**
 * GET /api/auth/status
 * Get current authentication status
 * Returns authenticated status and token expiry info
 */
export default async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    res.status(405).json({ code: 'METHOD_NOT_ALLOWED', message: 'Only GET is allowed' });
    return;
  }

  try {
    const isAuthorized = await authGuardMiddleware(req, res);

    if (!isAuthorized) {
      // If not authorized, return authenticated: false (status already sent by guard)
      return;
    }

    if (!req.tokenId) {
      res.status(200).json({ authenticated: false });
      return;
    }

    const status = await authService.getAuthStatus(req.tokenId);
    res.status(200).json(status);
  } catch (error) {
    // If there's an error, assume not authenticated
    res.status(200).json({ authenticated: false });
  }
}
