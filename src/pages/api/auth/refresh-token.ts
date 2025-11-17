import { NextApiResponse } from 'next';
import { AuthenticatedRequest } from '../../../backend/middleware/session.middleware';
import { authGuardMiddleware } from '../../../backend/middleware/auth-guard';
import * as authService from '../../../backend/services/auth.service';
import { setSessionCookie } from '../../../backend/middleware/session.middleware';

/**
 * POST /api/auth/refresh-token
 * Manually refresh access token
 * Requires valid session cookie (HTTP-only)
 */
export default async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    res.status(405).json({ code: 'METHOD_NOT_ALLOWED', message: 'Only POST is allowed' });
    return;
  }

  // Verify authentication
  const isAuthorized = await authGuardMiddleware(req, res);
  if (!isAuthorized) {
    return;
  }

  try {
    if (!req.tokenId) {
      res.status(401).json({
        code: 'NO_SESSION',
        message: 'No active session',
      });
      return;
    }

    // Refresh the token
    const newTokens = await authService.refreshAccessToken(req.tokenId);

    // Update session cookie (tokenId stays the same, but token data is updated in DB)
    setSessionCookie(res, req.tokenId);

    res.status(200).json({
      accessToken: newTokens.accessToken,
      expiresAt: newTokens.expiresAt.toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    // Check if it's a refresh token expiration error
    if (message.includes('Refresh token expired')) {
      res.status(401).json({
        code: 'REFRESH_TOKEN_EXPIRED',
        message: 'Your session has expired - please log in again',
      });
      return;
    }

    res.status(500).json({
      code: 'REFRESH_FAILED',
      message: 'Failed to refresh access token',
      details: { error: message },
    });
  }
}
