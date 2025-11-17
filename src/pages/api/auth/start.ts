import { NextApiRequest, NextApiResponse } from 'next';
import * as authService from '../../../backend/services/auth.service';

/**
 * GET /api/auth/start
 * Initiates Schwab OAuth flow by generating OAuth URL and redirecting user
 * Stores state in session for CSRF protection
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    res.status(405).json({ code: 'METHOD_NOT_ALLOWED', message: 'Only GET is allowed' });
    return;
  }

  try {
    // Generate OAuth URL and state
    const { authUrl, state } = authService.generateOAuthUrl();

    // Store state in session cookie for CSRF verification during callback
    res.setHeader('Set-Cookie', [
      `oauth_state=${state}; Path=/; Max-Age=600; HttpOnly; SameSite=Strict; Secure`,
    ]);

    // Redirect user to Schwab OAuth endpoint
    res.redirect(302, authUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      code: 'OAUTH_ERROR',
      message: 'Failed to generate OAuth URL',
      details: { error: message },
    });
  }
}
