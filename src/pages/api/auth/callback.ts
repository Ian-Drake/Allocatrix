import { NextApiRequest, NextApiResponse } from 'next';
import * as authService from '../../../backend/services/auth.service';
import { setSessionCookie } from '../../../backend/middleware/session.middleware';

/**
 * GET /api/auth/callback
 * Handles Schwab OAuth callback - exchanges authorization code for tokens
 * Sets HTTP-only session cookie and redirects to dashboard
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET requests (OAuth callback)
  if (req.method !== 'GET') {
    res.status(405).json({ code: 'METHOD_NOT_ALLOWED', message: 'Only GET is allowed' });
    return;
  }

  const { code, state } = req.query;

  // Validate required parameters
  if (!code || typeof code !== 'string') {
    res.status(400).json({
      code: 'MISSING_CODE',
      message: 'Authorization code is required',
    });
    return;
  }

  if (!state || typeof state !== 'string') {
    res.status(400).json({
      code: 'MISSING_STATE',
      message: 'State parameter is required',
    });
    return;
  }

  try {
    // Verify CSRF protection - check state matches what we stored in session
    const sessionState = req.cookies.oauth_state;
    if (!sessionState || sessionState !== state) {
      res.status(401).json({
        code: 'INVALID_STATE',
        message: 'State parameter mismatch - possible CSRF attack',
      });
      return;
    }

    // Exchange authorization code for tokens
    const tokens = await authService.exchangeCodeForTokens(code);

    // Store encrypted tokens in database
    const tokenId = await authService.storeTokens(tokens);

    // Create session and set HTTP-only cookie
    setSessionCookie(res, tokenId);

    // Clear the oauth_state cookie (it's no longer needed)
    res.setHeader('Set-Cookie', [
      `oauth_state=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict; Secure`,
    ]);

    // Redirect to dashboard
    res.redirect(302, '/');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      code: 'TOKEN_EXCHANGE_FAILED',
      message: 'Failed to exchange authorization code for tokens',
      details: { error: message },
    });
  }
}
