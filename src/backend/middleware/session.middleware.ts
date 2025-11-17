import { NextApiRequest, NextApiResponse } from 'next';
import * as encryptionUtils from '../utils/encryption';

export interface AuthenticatedRequest extends NextApiRequest {
  tokenId?: string;
}

const SESSION_COOKIE_NAME = 'auth_session';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

/**
 * Session middleware - sets and retrieves HTTP-only session cookie
 * Middleware to be used with Next.js API routes
 */
export function sessionMiddleware(req: AuthenticatedRequest, _res: NextApiResponse): void {
  // Extract tokenId from encrypted session cookie
  const sessionCookie = req.cookies[SESSION_COOKIE_NAME];

  if (sessionCookie) {
    try {
      // Decrypt the tokenId from the cookie
      req.tokenId = encryptionUtils.decrypt(sessionCookie);
    } catch (error) {
      // Invalid/corrupted session cookie, continue without auth
      req.tokenId = undefined;
    }
  }
}

/**
 * Set session cookie after successful authentication
 */
export function setSessionCookie(
  res: NextApiResponse,
  tokenId: string,
  options?: { maxAge?: number }
): void {
  const maxAge = options?.maxAge || SESSION_MAX_AGE;
  const encryptedTokenId = encryptionUtils.encrypt(tokenId);

  res.setHeader('Set-Cookie', [
    `${SESSION_COOKIE_NAME}=${encryptedTokenId}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Strict; Secure`,
  ]);
}

/**
 * Clear session cookie on logout
 */
export function clearSessionCookie(res: NextApiResponse): void {
  res.setHeader('Set-Cookie', [
    `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict; Secure`,
  ]);
}

/**
 * Guard middleware - verify user is authenticated
 * Use this to protect API routes
 */
export function authGuard(req: AuthenticatedRequest, res: NextApiResponse): boolean {
  sessionMiddleware(req, res);

  if (!req.tokenId) {
    res.status(401).json({
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
    });
    return false;
  }

  return true;
}
