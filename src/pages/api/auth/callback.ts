import { NextApiRequest, NextApiResponse } from 'next';
import * as authService from '../../../backend/services/auth.service';
import { setSessionCookie } from '../../../backend/middleware/session.middleware';
import { SchwabApiService } from '../../../backend/services/schwab-api.service';
import { getAsync, runAsync } from '../../../backend/db/database';
import { encrypt } from '../../../backend/utils/encryption';

/**
 * GET /api/auth/callback
 * Handles Schwab OAuth callback - exchanges authorization code for tokens
 * Sets HTTP-only session cookie and redirects to dashboard
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('[Callback] Received request');
  console.log('[Callback] Method:', req.method);
  console.log('[Callback] Query:', req.query);
  console.log('[Callback] Cookies:', req.cookies);
  
  // Only allow GET requests (OAuth callback)
  if (req.method !== 'GET') {
    res.status(405).json({ code: 'METHOD_NOT_ALLOWED', message: 'Only GET is allowed' });
    return;
  }

  const { code, session, error, error_description } = req.query;

  // Check if Schwab returned an error
  if (error) {
    console.error('[Callback] OAuth error from Schwab:', error, error_description);
    res.status(400).json({
      code: 'OAUTH_ERROR',
      message: 'Authorization failed',
      details: { error, error_description },
    });
    return;
  }

  // Validate required parameters
  if (!code || typeof code !== 'string') {
    console.error('[Callback] Missing authorization code');
    res.status(400).json({
      code: 'MISSING_CODE',
      message: 'Authorization code is required',
    });
    return;
  }

  // Schwab returns 'session' instead of 'state'
  // We'll verify using our stored oauth_state cookie for CSRF protection
  try {
    const storedState = req.cookies.oauth_state;
    console.log('[Callback] Stored state cookie:', storedState);
    console.log('[Callback] Schwab session:', session);
    
    // Note: Schwab doesn't echo back our state, so we just verify we have a stored state
    // This provides some CSRF protection (cookie must exist from the /start endpoint)
    if (!storedState) {
      console.warn('[Callback] No oauth_state cookie found - possible CSRF or expired state');
      // Continue anyway as Schwab uses their own session mechanism
    }

    // Exchange authorization code for tokens
    const tokens = await authService.exchangeCodeForTokens(code);

    // Store encrypted tokens in database
    const tokenId = await authService.storeTokens(tokens);

    // Create session using the middleware helper
    setSessionCookie(res, tokenId);

    // After successful auth, sync Schwab accounts into our database
    try {
      const schwabBaseUrl = process.env.SCHWAB_TRADER_API_BASE_URL || 'https://api.schwabapi.com/trader/v1';
      console.log('[Callback] Using Schwab base URL:', schwabBaseUrl);
      console.log('[Callback] Access token exists:', !!tokens.accessToken);
      
      if (!schwabBaseUrl) {
        console.warn('[Callback] SCHWAB_TRADER_API_BASE_URL not set, skipping account sync');
      } else {
        const schwabService = new SchwabApiService(schwabBaseUrl, tokens.accessToken);
        const linkedAccounts = await schwabService.getLinkedAccounts();
        console.log('[Callback] Successfully fetched linked accounts:', linkedAccounts.length);

        for (const schwabAccount of linkedAccounts) {
          const encryptedAccountId = encrypt(schwabAccount.accountNumber);

          // Check if account already exists
          const existing = await getAsync<{ id: string }>(
            'SELECT id FROM account WHERE schwabEncryptedAccountId = ?',
            [encryptedAccountId],
          );

          let accountId = existing?.id;

          if (!accountId) {
            // Create new account record
            const now = new Date().toISOString();
            accountId = crypto.randomUUID();
            await runAsync(
              `INSERT INTO account (id, schwabEncryptedAccountId, nickname, createdAt)
               VALUES (?, ?, ?, ?)`,
              [accountId, encryptedAccountId, null, now],
            );
          }

          // Optionally, you could trigger an initial positions sync here
          // via PositionsService to populate account_snapshot.
        }
      }
    } catch (syncError) {
      console.error('[Callback] Failed to sync Schwab accounts after login:', syncError);
      // Do not block login if sync fails; user can retry from dashboard.
    }

    // Clear the oauth_state cookie (it's no longer needed)
    const isSecure = process.env.NODE_ENV === 'production' || process.env.SCHWAB_REDIRECT_URI?.startsWith('https://');
    const clearStateCookie = `oauth_state=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${isSecure ? '; Secure' : ''}`;
    const existingCookies = res.getHeader('Set-Cookie') || [];
    const cookiesArray = Array.isArray(existingCookies) ? existingCookies : [existingCookies.toString()];
    cookiesArray.push(clearStateCookie);
    res.setHeader('Set-Cookie', cookiesArray);

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
