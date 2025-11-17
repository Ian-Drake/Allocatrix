import { NextApiResponse } from 'next';
import { sessionMiddleware, AuthenticatedRequest } from './session.middleware';
import * as authService from '../services/auth.service';

/**
 * Auth guard middleware - verify user is authenticated and token is valid
 * Automatically refreshes token if needed
 * Returns true if authorized, false if not
 */
export async function authGuardMiddleware(
  req: AuthenticatedRequest,
  res: NextApiResponse
): Promise<boolean> {
  // First, extract session cookie
  sessionMiddleware(req, res);

  if (!req.tokenId) {
    res.status(401).json({
      code: 'UNAUTHORIZED',
      message: 'Authentication required - please log in',
    });
    return false;
  }

  try {
    // Verify token exists and is not expired
    const status = await authService.getAuthStatus(req.tokenId);

    if (!status.authenticated) {
      res.status(401).json({
        code: 'INVALID_TOKEN',
        message: 'Your session is invalid - please log in again',
      });
      return false;
    }

    // Check if token is about to expire (within 10 minutes) and refresh if needed
    if (status.tokenExpiresAt && authService.isTokenExpired(status.tokenExpiresAt, 600)) {
      try {
        await authService.refreshAccessToken(req.tokenId);
      } catch (error) {
        res.status(401).json({
          code: 'TOKEN_REFRESH_FAILED',
          message: 'Your session expired - please log in again',
          details: {
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        });
        return false;
      }
    }

    return true;
  } catch (error) {
    res.status(500).json({
      code: 'AUTH_ERROR',
      message: 'Authentication check failed',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });
    return false;
  }
}
