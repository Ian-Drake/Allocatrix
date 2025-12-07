import { NextApiResponse } from 'next';
import { AuthenticatedRequest, sessionMiddleware } from '../../../backend/middleware/session.middleware';
import * as authService from '../../../backend/services/auth.service';

/**
 * GET /api/auth/status
 * Get current authentication status
 * Returns authenticated status and token expiry info
 * This endpoint does NOT require authentication - it's used to check if the user is logged in
 */
export default async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    res.status(405).json({ code: 'METHOD_NOT_ALLOWED', message: 'Only GET is allowed' });
    return;
  }

  try {
    // Extract session (but don't require it)
    sessionMiddleware(req, res);

    // If no session, return not authenticated
    if (!req.tokenId) {
      res.status(200).json({ authenticated: false });
      return;
    }

    // If session exists, get auth status
    const status = await authService.getAuthStatus(req.tokenId);
    res.status(200).json(status);
  } catch (error) {
    // If there's an error, assume not authenticated
    res.status(200).json({ authenticated: false });
  }
}
