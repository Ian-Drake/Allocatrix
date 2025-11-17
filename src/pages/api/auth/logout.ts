import { NextApiResponse } from 'next';
import { AuthenticatedRequest, clearSessionCookie, sessionMiddleware } from '../../../backend/middleware/session.middleware';
import * as authService from '../../../backend/services/auth.service';

/**
 * POST /api/auth/logout
 * Log out user by clearing session and invalidating token
 */
export default async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    res.status(405).json({ code: 'METHOD_NOT_ALLOWED', message: 'Only POST is allowed' });
    return;
  }

  try {
    // Extract session
    sessionMiddleware(req, res);

    if (req.tokenId) {
      // Invalidate token in database
      await authService.invalidateToken(req.tokenId);
    }

    // Clear session cookie
    clearSessionCookie(res);

    res.status(204).end();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      code: 'LOGOUT_ERROR',
      message: 'Failed to log out',
      details: { error: message },
    });
  }
}
