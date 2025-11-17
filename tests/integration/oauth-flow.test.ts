import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import * as authService from '../../src/backend/services/auth.service';
import * as db from '../../src/backend/db/database';

/**
 * Integration tests for OAuth flow (User Story 1)
 * Tests acceptance scenarios 1-5: redirect, callback, token exchange, refresh, expiry
 */

// Mock Schwab API responses
const mockSchwabTokenResponse = {
  access_token: 'test_access_token_12345',
  refresh_token: 'test_refresh_token_67890',
  expires_in: 1800, // 30 minutes
  refresh_token_expires_in: 604800, // 7 days
  token_type: 'Bearer',
  scope: 'PlaceTrades AccountAccess MoveMoney',
};

describe('OAuth Flow Integration Tests', () => {
  beforeAll(async () => {
    // Initialize database
    // Normally you'd set up test database here
  });

  afterAll(async () => {
    // Clean up database
    await db.closeDatabase();
  });

  describe('Scenario 1: User can initiate OAuth flow', () => {
    it('should generate OAuth URL with valid state', () => {
      const { authUrl, state } = authService.generateOAuthUrl();

      expect(authUrl).toContain('https://api.schwabapi.com/v1/oauth/authorize');
      expect(authUrl).toContain('client_id=');
      expect(authUrl).toContain('redirect_uri=');
      expect(authUrl).toContain('response_type=code');
      expect(authUrl).toContain('scope=PlaceTrades');
      expect(authUrl).toContain(`state=${state}`);
      expect(state).toHaveLength(64); // 32 bytes = 64 hex characters
    });

    it('should generate unique state for each request', () => {
      const { state: state1 } = authService.generateOAuthUrl();
      const { state: state2 } = authService.generateOAuthUrl();

      expect(state1).not.toEqual(state2);
    });
  });

  describe('Scenario 2: OAuth callback exchanges code for tokens', () => {
    it('should exchange authorization code for tokens', async () => {
      // Mock fetch
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockSchwabTokenResponse,
      });

      const tokens = await authService.exchangeCodeForTokens('test_auth_code');

      expect(tokens.accessToken).toBe(mockSchwabTokenResponse.access_token);
      expect(tokens.refreshToken).toBe(mockSchwabTokenResponse.refresh_token);
      expect(tokens.expiresAt).toBeInstanceOf(Date);
      expect(tokens.refreshTokenExpiresAt).toBeInstanceOf(Date);

      const now = new Date();
      expect(tokens.expiresAt.getTime()).toBeGreaterThan(now.getTime());
      expect(tokens.refreshTokenExpiresAt.getTime()).toBeGreaterThan(now.getTime());
    });

    it('should handle token exchange errors', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request',
        text: async () => 'Invalid code',
      });

      await expect(authService.exchangeCodeForTokens('invalid_code')).rejects.toThrow(
        'Failed to exchange authorization code'
      );
    });
  });

  describe('Scenario 3: Tokens are encrypted and stored', () => {
    it('should store and retrieve encrypted tokens', async () => {
      const tokens = {
        accessToken: 'test_access',
        refreshToken: 'test_refresh',
        expiresAt: new Date(Date.now() + 1800000),
        refreshTokenExpiresAt: new Date(Date.now() + 604800000),
      };

      // Store tokens
      const tokenId = await authService.storeTokens(tokens);

      expect(tokenId).toBeDefined();
      expect(tokenId).toHaveLength(36); // UUID format

      // Retrieve tokens
      const retrievedTokens = await authService.getTokens(tokenId);

      expect(retrievedTokens).toBeDefined();
      expect(retrievedTokens?.accessToken).toBe(tokens.accessToken);
      expect(retrievedTokens?.refreshToken).toBe(tokens.refreshToken);
    });

    it('should return null for non-existent token', async () => {
      const tokens = await authService.getTokens('non-existent-id');
      expect(tokens).toBeNull();
    });
  });

  describe('Scenario 4: Tokens are automatically refreshed before expiry', () => {
    it('should detect token expiration correctly', () => {
      const now = new Date();
      const expiredToken = new Date(now.getTime() - 1000); // Expired 1 second ago
      const validToken = new Date(now.getTime() + 3600000); // Valid for 1 hour

      expect(authService.isTokenExpired(expiredToken)).toBe(true);
      expect(authService.isTokenExpired(validToken)).toBe(false);
    });

    it('should detect token expiring soon (within 5 minute buffer)', () => {
      const now = new Date();
      const expiringToken = new Date(now.getTime() + 200000); // Expires in ~3 minutes

      // Default buffer is 300 seconds (5 minutes)
      expect(authService.isTokenExpired(expiringToken)).toBe(true);
    });

    it('should refresh access token using refresh token', async () => {
      // Store initial tokens
      const initialTokens = {
        accessToken: 'initial_access',
        refreshToken: 'test_refresh',
        expiresAt: new Date(Date.now() + 1800000),
        refreshTokenExpiresAt: new Date(Date.now() + 604800000),
      };

      const tokenId = await authService.storeTokens(initialTokens);

      // Mock refresh endpoint
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockSchwabTokenResponse,
          access_token: 'refreshed_access_token',
        }),
      });

      // Refresh token
      const refreshedTokens = await authService.refreshAccessToken(tokenId);

      expect(refreshedTokens.accessToken).toBe('refreshed_access_token');
      expect(refreshedTokens.refreshToken).toBe(mockSchwabTokenResponse.refresh_token);

      // Verify tokens were updated in database
      const storedTokens = await authService.getTokens(tokenId);
      expect(storedTokens?.accessToken).toBe('refreshed_access_token');
    });
  });

  describe('Scenario 5: Expired refresh tokens trigger re-authentication', () => {
    it('should reject refresh when refresh token is expired', async () => {
      const expiredTokens = {
        accessToken: 'access',
        refreshToken: 'refresh',
        expiresAt: new Date(Date.now() - 1000), // Expired access token
        refreshTokenExpiresAt: new Date(Date.now() - 1000), // Expired refresh token
      };

      const tokenId = await authService.storeTokens(expiredTokens);

      await expect(authService.refreshAccessToken(tokenId)).rejects.toThrow(
        'Refresh token expired - re-authentication required'
      );
    });

    it('should handle authentication status correctly', async () => {
      // Test unauthenticated status
      let status = await authService.getAuthStatus(null);
      expect(status.authenticated).toBe(false);

      // Test authenticated status
      const tokens = {
        accessToken: 'access',
        refreshToken: 'refresh',
        expiresAt: new Date(Date.now() + 1800000),
        refreshTokenExpiresAt: new Date(Date.now() + 604800000),
      };

      const tokenId = await authService.storeTokens(tokens);
      status = await authService.getAuthStatus(tokenId);

      expect(status.authenticated).toBe(true);
      expect(status.tokenExpiresAt).toBeDefined();
      expect(status.refreshTokenExpiresAt).toBeDefined();
    });
  });

  describe('Session and token invalidation', () => {
    it('should invalidate token on logout', async () => {
      const tokens = {
        accessToken: 'access',
        refreshToken: 'refresh',
        expiresAt: new Date(Date.now() + 1800000),
        refreshTokenExpiresAt: new Date(Date.now() + 604800000),
      };

      const tokenId = await authService.storeTokens(tokens);

      // Verify token exists
      let status = await authService.getAuthStatus(tokenId);
      expect(status.authenticated).toBe(true);

      // Invalidate token
      await authService.invalidateToken(tokenId);

      // Verify token is gone
      status = await authService.getAuthStatus(tokenId);
      expect(status.authenticated).toBe(false);
    });

    it('should create session after successful authentication', () => {
      const tokenId = 'test-token-id';
      const session = authService.createSession(tokenId);

      expect(session.sessionId).toBeDefined();
      expect(session.sessionId).toHaveLength(36); // UUID
      expect(session.tokenId).toBe(tokenId);
    });
  });
});
