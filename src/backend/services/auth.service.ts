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
  refresh_token_expires_in?: number; // Optional - not returned on refresh token endpoint
  token_type: string;
  scope: string;
}

export interface AuthStatus {
  authenticated: boolean;
  tokenExpiresAt?: Date;
  refreshTokenExpiresAt?: Date;
}

export interface TokenRow {
  encryptedAccessToken: string;
  encryptedRefreshToken: string;
  expiresAt: string;
  refreshTokenExpiresAt: string;
}

const clientId = process.env.SCHWAB_CLIENT_ID || '';
const clientSecret = process.env.SCHWAB_CLIENT_SECRET || '';
const redirectUri = process.env.SCHWAB_REDIRECT_URI || 'https://localhost:3000/api/auth/callback';
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

  // Build authorization URL exactly as shown in Schwab documentation
  // Template: https://api.schwabapi.com/v1/oauth/authorize?client_id={CONSUMER_KEY}&redirect_uri={APP_CALLBACK_URL}
  const authUrl = `${schwabAuthUrl}?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  
  return { authUrl, state };
}

/**
 * Exchange authorization code for access and refresh tokens
 * Tokens are encrypted and stored in schwab_token table
 */
export async function exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
  try {
    // Schwab requires Basic Auth with Base64 encoded client_id:client_secret
    // Per Schwab docs: code must be URL decoded prior to making request
    const decodedCode = decodeURIComponent(code);
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    const response = await fetch(schwabTokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: decodedCode,
        redirect_uri: redirectUri,
      }).toString(),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('[Auth] Token exchange failed:', errorData);
      throw new Error(`Schwab token exchange failed: ${response.statusText} - ${errorData}`);
    }

    const tokenData: SchwabTokenResponse = await response.json();

    // Calculate expiration times
    const now = new Date();
    const expiresIn = tokenData.expires_in || 1800; // Default to 30 minutes if not provided
    const refreshExpiresIn = tokenData.refresh_token_expires_in || 604800; // Default to 7 days if not provided
    
    const expiresAt = new Date(now.getTime() + expiresIn * 1000);
    const refreshTokenExpiresAt = new Date(now.getTime() + refreshExpiresIn * 1000);

    // Log token info for debugging (without exposing the actual tokens)
    console.error('[Auth] Access token length:', tokenData.access_token.length);
    console.error('[Auth] Refresh token length:', tokenData.refresh_token.length);
    console.error('[Auth] Refresh token first 20 chars:', tokenData.refresh_token.substring(0, 20));

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
export async function storeTokens(tokens: OAuthTokens, accountId?: string): Promise<string> {
  const tokenId = crypto.randomUUID();
  
  // Validate tokens are properly formatted before encrypting
  if (!tokens.accessToken || !tokens.refreshToken) {
    throw new Error('Access token and refresh token are required');
  }
  
  const encryptedAccessToken = encryptionUtils.encrypt(tokens.accessToken);
  const encryptedRefreshToken = encryptionUtils.encrypt(tokens.refreshToken);

  // Debug: Verify round-trip encryption
  const testDecryptAccess = encryptionUtils.decrypt(encryptedAccessToken);
  const testDecryptRefresh = encryptionUtils.decrypt(encryptedRefreshToken);
  
  if (testDecryptAccess !== tokens.accessToken) {
    throw new Error('Access token encryption round-trip failed - data corruption');
  }
  if (testDecryptRefresh !== tokens.refreshToken) {
    throw new Error('Refresh token encryption round-trip failed - data corruption');
  }

  const query = `
    INSERT INTO schwab_token (
      id, 
      accountId,
      encryptedAccessToken, 
      encryptedRefreshToken, 
      expiresAt, 
      refreshTokenExpiresAt,
      createdAt,
      updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  await db.runAsync(query, [
    tokenId,
    accountId || null, // Use null if accountId not provided
    encryptedAccessToken,
    encryptedRefreshToken,
    tokens.expiresAt.toISOString(),
    tokens.refreshTokenExpiresAt.toISOString(),
    new Date().toISOString(),
    new Date().toISOString(),
  ]);

  console.error('[Auth] Token stored successfully. ID:', tokenId);
  console.error('[Auth] Stored access token length:', tokens.accessToken.length);
  console.error('[Auth] Stored refresh token length:', tokens.refreshToken.length);

  return tokenId;
}

/**
 * Retrieve and decrypt tokens from database
 */
export async function getTokens(tokenId: string): Promise<OAuthTokens | null> {
  const query = `
    SELECT encryptedAccessToken, encryptedRefreshToken, expiresAt, refreshTokenExpiresAt 
    FROM schwab_token 
    WHERE id = ?
  `;

  const row = await db.getAsync<TokenRow>(query, [tokenId]);
  if (!row) {
    return null;
  }

  return {
    accessToken: encryptionUtils.decrypt(row.encryptedAccessToken),
    refreshToken: encryptionUtils.decrypt(row.encryptedRefreshToken),
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
    // Schwab requires Basic Auth with Base64 encoded client_id:client_secret
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    // Validate refresh token is not empty or malformed
    const refreshToken = currentTokens.refreshToken.trim();
    if (!refreshToken) {
      throw new Error('Refresh token is empty or invalid');
    }
    
    console.error('[Auth] Refresh token length:', refreshToken.length);
    console.error('[Auth] Refresh token first 20 chars:', refreshToken.substring(0, 20));
    
    // Build form body manually to ensure proper encoding
    const bodyParams = new URLSearchParams();
    bodyParams.append('grant_type', 'refresh_token');
    bodyParams.append('refresh_token', refreshToken);
    const body = bodyParams.toString();
    
    console.error('[Auth] Request body length:', body.length);
    
    const response = await fetch(schwabTokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body,
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('[Auth] Refresh token endpoint error:', errorData);
      throw new Error(`Schwab token refresh failed: ${response.statusText} - ${errorData}`);
    }

    const tokenData: SchwabTokenResponse = await response.json();

    // Calculate expiration times
    const now = new Date();
    const expiresAt = new Date(now.getTime() + tokenData.expires_in * 1000);
    // Note: Refresh token endpoint doesn't return refresh_token_expires_in
    // Keep the original refresh token expiration date since the refresh token itself doesn't change
    const refreshTokenExpiresAt = currentTokens.refreshTokenExpiresAt;

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
      SET encryptedAccessToken = ?, 
          encryptedRefreshToken = ?, 
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
