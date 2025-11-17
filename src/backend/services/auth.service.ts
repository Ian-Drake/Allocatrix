import crypto from 'crypto';
import * as encryptionUtils from '../utils/encryption';
import * as db from '../db/database';

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  refreshTokenExpiresAt: Date;
}

export interface SchwabTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_token_expires_in: number;
  token_type: string;
  scope: string;
}

export interface AuthStatus {
  authenticated: boolean;
  tokenExpiresAt?: Date;
  refreshTokenExpiresAt?: Date;
}

export interface TokenRow {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  refreshTokenExpiresAt: string;
}

const clientId = process.env.SCHWAB_CLIENT_ID || '';
const clientSecret = process.env.SCHWAB_CLIENT_SECRET || '';
const redirectUri = process.env.SCHWAB_REDIRECT_URI || 'http://localhost:3000/api/auth/callback';
const schwabTokenUrl = 'https://api.schwabapi.com/v1/oauth/token';
const schwabAuthUrl = 'https://api.schwabapi.com/v1/oauth/authorize';

if (!clientId || !clientSecret) {
  throw new Error('SCHWAB_CLIENT_ID and SCHWAB_CLIENT_SECRET must be set in environment');
}

/**
 * Generate OAuth authorization URL for Schwab redirect
 * Returns { authUrl, state } where state should be stored in session
 */
export function generateOAuthUrl(): { authUrl: string; state: string } {
  const state = crypto.randomBytes(32).toString('hex');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'PlaceTrades AccountAccess MoveMoney',
    state,
  });

  const authUrl = `${schwabAuthUrl}?${params.toString()}`;
  return { authUrl, state };
}

/**
 * Exchange authorization code for access and refresh tokens
 * Tokens are encrypted and stored in schwab_token table
 */
export async function exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
  try {
    const response = await fetch(schwabTokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }).toString(),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Schwab token exchange failed: ${response.statusText} - ${errorData}`);
    }

    const tokenData: SchwabTokenResponse = await response.json();

    // Calculate expiration times
    const now = new Date();
    const expiresAt = new Date(now.getTime() + tokenData.expires_in * 1000);
    const refreshTokenExpiresAt = new Date(now.getTime() + tokenData.refresh_token_expires_in * 1000);

    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt,
      refreshTokenExpiresAt,
    };
  } catch (error) {
    throw new Error(`Failed to exchange authorization code: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Store encrypted tokens in database
 * Returns the token record ID
 */
export async function storeTokens(tokens: OAuthTokens): Promise<string> {
  const tokenId = crypto.randomUUID();
  const encryptedAccessToken = encryptionUtils.encrypt(tokens.accessToken);
  const encryptedRefreshToken = encryptionUtils.encrypt(tokens.refreshToken);

  const query = `
    INSERT INTO schwab_token (
      id, 
      accessToken, 
      refreshToken, 
      expiresAt, 
      refreshTokenExpiresAt,
      createdAt
    ) VALUES (?, ?, ?, ?, ?, ?)
  `;

  await db.runAsync(query, [
    tokenId,
    encryptedAccessToken,
    encryptedRefreshToken,
    tokens.expiresAt.toISOString(),
    tokens.refreshTokenExpiresAt.toISOString(),
    new Date().toISOString(),
  ]);

  return tokenId;
}

/**
 * Retrieve and decrypt tokens from database
 */
export async function getTokens(tokenId: string): Promise<OAuthTokens | null> {
  const query = `
    SELECT accessToken, refreshToken, expiresAt, refreshTokenExpiresAt 
    FROM schwab_token 
    WHERE id = ?
  `;

  const row = await db.getAsync<TokenRow>(query, [tokenId]);
  if (!row) {
    return null;
  }

  return {
    accessToken: encryptionUtils.decrypt(row.accessToken),
    refreshToken: encryptionUtils.decrypt(row.refreshToken),
    expiresAt: new Date(row.expiresAt),
    refreshTokenExpiresAt: new Date(row.refreshTokenExpiresAt),
  };
}

/**
 * Check if token is expired or about to expire (within 5 minutes)
 */
export function isTokenExpired(expiresAt: Date, bufferSeconds = 300): boolean {
  const now = new Date();
  const expiryBuffer = new Date(expiresAt.getTime() - bufferSeconds * 1000);
  return now >= expiryBuffer;
}

/**
 * Refresh expired access token using refresh token
 * Updates the token record in database
 */
export async function refreshAccessToken(tokenId: string): Promise<OAuthTokens> {
  const currentTokens = await getTokens(tokenId);
  if (!currentTokens) {
    throw new Error('Token not found');
  }

  // Check if refresh token is expired
  if (isTokenExpired(currentTokens.refreshTokenExpiresAt)) {
    throw new Error('Refresh token expired - re-authentication required');
  }

  try {
    const response = await fetch(schwabTokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: currentTokens.refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Schwab token refresh failed: ${response.statusText} - ${errorData}`);
    }

    const tokenData: SchwabTokenResponse = await response.json();

    // Calculate expiration times
    const now = new Date();
    const expiresAt = new Date(now.getTime() + tokenData.expires_in * 1000);
    const refreshTokenExpiresAt = new Date(now.getTime() + tokenData.refresh_token_expires_in * 1000);

    const newTokens: OAuthTokens = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt,
      refreshTokenExpiresAt,
    };

    // Update database with new tokens
    const encryptedAccessToken = encryptionUtils.encrypt(newTokens.accessToken);
    const encryptedRefreshToken = encryptionUtils.encrypt(newTokens.refreshToken);

    const updateQuery = `
      UPDATE schwab_token 
      SET accessToken = ?, 
          refreshToken = ?, 
          expiresAt = ?, 
          refreshTokenExpiresAt = ?,
          updatedAt = ?
      WHERE id = ?
    `;

    await db.runAsync(updateQuery, [
      encryptedAccessToken,
      encryptedRefreshToken,
      newTokens.expiresAt.toISOString(),
      newTokens.refreshTokenExpiresAt.toISOString(),
      new Date().toISOString(),
      tokenId,
    ]);

    return newTokens;
  } catch (error) {
    throw new Error(`Failed to refresh access token: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get current authentication status
 */
export async function getAuthStatus(tokenId: string | null): Promise<AuthStatus> {
  if (!tokenId) {
    return { authenticated: false };
  }

  const tokens = await getTokens(tokenId);
  if (!tokens) {
    return { authenticated: false };
  }

  return {
    authenticated: true,
    tokenExpiresAt: tokens.expiresAt,
    refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
  };
}

/**
 * Invalidate token (logout)
 * Deletes the token record from database
 */
export async function invalidateToken(tokenId: string): Promise<void> {
  const query = 'DELETE FROM schwab_token WHERE id = ?';
  await db.runAsync(query, [tokenId]);
}

/**
 * Create session for user after successful authentication
 * Session stores encrypted tokenId
 */
export function createSession(tokenId: string): { sessionId: string; tokenId: string } {
  const sessionId = crypto.randomUUID();
  // Session data would be stored in session store (redis/memory) or signed cookie
  // For now, we return both - the middleware will handle cookie storage
  return { sessionId, tokenId };
}
