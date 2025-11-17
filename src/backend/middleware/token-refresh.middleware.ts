import { NextApiResponse } from 'next';
import { AuthenticatedRequest, sessionMiddleware, setSessionCookie } from './session.middleware';
import * as authService from '../services/auth.service';

/**
 * Token refresh middleware - automatically refreshes token before expiry
 * Should be called on protected routes
 * Returns the (possibly refreshed) tokenId
 */
export async function tokenRefreshMiddleware(
  req: AuthenticatedRequest,
  res: NextApiResponse
): Promise<string | null> {
  // Extract session cookie
  sessionMiddleware(req, res);

  if (!req.tokenId) {
    return null;
  }

  try {
    // Get current token status
    const tokens = await authService.getTokens(req.tokenId);
    if (!tokens) {
      return null;
    }

    // Check if token needs refresh (within 10 minutes of expiry)
    if (authService.isTokenExpired(tokens.expiresAt, 600)) {
      // Attempt refresh
      await authService.refreshAccessToken(req.tokenId);

      // Update the session cookie with new token data
      setSessionCookie(res, req.tokenId);

      return req.tokenId;
    }

    // Token is still valid
    return req.tokenId;
  } catch (error) {
    // Token refresh failed - return null to indicate auth failure
    return null;
  }
}
