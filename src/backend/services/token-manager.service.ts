import { getAsync, runAsync, allAsync } from '../db/database';
import { encrypt, decrypt } from '../utils/encryption';

export interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  refreshTokenExpiresAt: Date;
}

/**
 * Store encrypted Schwab tokens
 */
export async function storeToken(
  accountId: string,
  accessToken: string,
  refreshToken: string,
  expiresIn: number, // seconds
  refreshTokenExpiresIn: number // seconds
): Promise<void> {
  const tokenId = `token-${Date.now()}`;
  const expiresAt = new Date(Date.now() + expiresIn * 1000);
  const refreshTokenExpiresAt = new Date(Date.now() + refreshTokenExpiresIn * 1000);

  const encryptedAccess = encrypt(accessToken);
  const encryptedRefresh = encrypt(refreshToken);

  await runAsync(
    `INSERT OR REPLACE INTO schwab_token 
     (id, accountId, encryptedAccessToken, encryptedRefreshToken, expiresAt, refreshTokenExpiresAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [tokenId, accountId, encryptedAccess, encryptedRefresh, expiresAt.toISOString(), refreshTokenExpiresAt.toISOString()]
  );
}

/**
 * Retrieve and decrypt tokens for an account
 */
export async function getToken(accountId: string): Promise<TokenData | null> {
  const row = await getAsync<{
    encryptedAccessToken: string;
    encryptedRefreshToken: string;
    expiresAt: string;
    refreshTokenExpiresAt: string;
  }>('SELECT * FROM schwab_token WHERE accountId = ?', [accountId]);

  if (!row) {
    return null;
  }

  return {
    accessToken: decrypt(row.encryptedAccessToken),
    refreshToken: decrypt(row.encryptedRefreshToken),
    expiresAt: new Date(row.expiresAt),
    refreshTokenExpiresAt: new Date(row.refreshTokenExpiresAt),
  };
}

/**
 * Check if access token is expired
 */
export function isAccessTokenExpired(tokenData: TokenData): boolean {
  // Refresh if expiring within 5 minutes
  const refreshBuffer = 5 * 60 * 1000;
  return Date.now() >= tokenData.expiresAt.getTime() - refreshBuffer;
}

/**
 * Check if refresh token is expired
 */
export function isRefreshTokenExpired(tokenData: TokenData): boolean {
  return Date.now() >= tokenData.refreshTokenExpiresAt.getTime();
}

/**
 * Delete tokens for an account (logout)
 */
export async function deleteToken(accountId: string): Promise<void> {
  await runAsync('DELETE FROM schwab_token WHERE accountId = ?', [accountId]);
}

/**
 * Get all accounts that need token refresh
 */
export async function getAccountsNeedingRefresh(): Promise<string[]> {
  const rows = await allAsync<{ accountId: string }>(
    `SELECT accountId FROM schwab_token 
     WHERE expiresAt < datetime('now', '+10 minutes')`
  );

  return rows.map((row) => row.accountId);
}
