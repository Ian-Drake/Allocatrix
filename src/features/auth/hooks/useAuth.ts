import { useEffect, useCallback } from 'react';
import { create } from 'zustand';
import authService from '../services/auth.service';

interface AuthState {
  authenticated: boolean;
  tokenExpiresAt: Date | null;
  refreshTokenExpiresAt: Date | null;
  loading: boolean;
  error: string | null;
  initialized: boolean;
  checkStatus: () => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

// Create Zustand store for auth state
export const useAuthStore = create<AuthState>((set, get) => ({
  authenticated: false,
  tokenExpiresAt: null,
  refreshTokenExpiresAt: null,
  loading: true,
  error: null,
  initialized: false,

  checkStatus: async () => {
    // Prevent multiple simultaneous status checks
    const state = get();
    if (state.initialized && state.loading) {
      return; // Already checking status
    }

    try {
      set({ loading: true, error: null, initialized: true });
      const status = await authService.getStatus();
      set({
        authenticated: status.authenticated,
        tokenExpiresAt: status.tokenExpiresAt ? new Date(status.tokenExpiresAt) : null,
        refreshTokenExpiresAt: status.refreshTokenExpiresAt ? new Date(status.refreshTokenExpiresAt) : null,
        loading: false,
      });
    } catch (error) {
      set({
        authenticated: false,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },

  logout: async () => {
    try {
      set({ loading: true, error: null });
      const success = await authService.logout();
      if (success) {
        set({
          authenticated: false,
          tokenExpiresAt: null,
          refreshTokenExpiresAt: null,
          loading: false,
        });
      } else {
        throw new Error('Logout failed');
      }
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },

  refresh: async () => {
    try {
      set({ error: null });
      const success = await authService.refreshToken();
      if (success) {
        // Re-check status after refresh
        const status = await authService.getStatus();
        set({
          authenticated: status.authenticated,
          tokenExpiresAt: status.tokenExpiresAt ? new Date(status.tokenExpiresAt) : null,
          refreshTokenExpiresAt: status.refreshTokenExpiresAt ? new Date(status.refreshTokenExpiresAt) : null,
        });
      } else {
        throw new Error('Token refresh failed');
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
}));

/**
 * useAuth hook - use auth state and check status on mount
 */
export function useAuth() {
  const authenticated = useAuthStore((state) => state.authenticated);
  const tokenExpiresAt = useAuthStore((state) => state.tokenExpiresAt);
  const refreshTokenExpiresAt = useAuthStore((state) => state.refreshTokenExpiresAt);
  const loading = useAuthStore((state) => state.loading);
  const error = useAuthStore((state) => state.error);
  const logout = useAuthStore((state) => state.logout);
  const initialized = useAuthStore((state) => state.initialized);

  // Check auth status on mount (only once globally via the store)
  useEffect(() => {
    if (!initialized) {
      useAuthStore.getState().checkStatus();
    }
  }, [initialized]);

  // Set up token refresh timer (refresh 1 hour before expiry)
  useEffect(() => {
    if (!authenticated || !tokenExpiresAt) {
      return;
    }

    const now = new Date().getTime();
    const expiry = tokenExpiresAt.getTime();
    const msUntilExpiry = expiry - now;
    const msUntilRefresh = msUntilExpiry - 60 * 60 * 1000; // 1 hour before expiry

    if (msUntilRefresh <= 0) {
      // Token expires soon, but prevent rapid successive refreshes
      // Only refresh if token has actually expired or is within 5 minutes
      if (msUntilExpiry <= 5 * 60 * 1000) {
        useAuthStore.getState().refresh();
      }
      return;
    }

    // Schedule refresh
    const timeoutId = setTimeout(() => {
      useAuthStore.getState().refresh();
    }, msUntilRefresh);

    return () => clearTimeout(timeoutId);
  }, [authenticated, tokenExpiresAt]);

  return {
    authenticated,
    tokenExpiresAt,
    refreshTokenExpiresAt,
    loading,
    error,
    logout,
    refresh: useCallback(() => useAuthStore.getState().refresh(), []),
    startOAuth: useCallback(() => authService.startOAuth(), []),
  };
}
