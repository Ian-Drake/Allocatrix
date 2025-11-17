/**
 * Frontend Auth Service
 * Handles communication with backend auth endpoints
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

export interface AuthStatus {
  authenticated: boolean;
  tokenExpiresAt?: string;
  refreshTokenExpiresAt?: string;
}

export interface AuthError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

class AuthService {
  /**
   * Start OAuth flow - redirect to Schwab login
   */
  startOAuth(): void {
    window.location.href = `${API_BASE_URL}/api/auth/start`;
  }

  /**
   * Get current authentication status
   */
  async getStatus(): Promise<AuthStatus> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/status`, {
        method: 'GET',
        credentials: 'include', // Include cookies
      });

      if (response.status === 401) {
        return { authenticated: false };
      }

      if (!response.ok) {
        throw new Error(`Failed to get auth status: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting auth status:', error);
      return { authenticated: false };
    }
  }

  /**
   * Manually refresh access token
   */
  async refreshToken(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/refresh-token`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('Failed to refresh token:', response.statusText);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error refreshing token:', error);
      return false;
    }
  }

  /**
   * Log out user
   */
  async logout(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('Failed to logout:', response.statusText);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error logging out:', error);
      return false;
    }
  }
}

const authService = new AuthService();
export default authService;
