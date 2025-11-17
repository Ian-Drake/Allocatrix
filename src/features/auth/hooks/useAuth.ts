import { useEffect, useState, useCallback } from 'react';
import { create } from 'zustand';
import authService from '../services/auth.service';

interface AuthState {
  authenticated: boolean;
  tokenExpiresAt: Date | null;
  refreshTokenExpiresAt: Date | null;
  loading: boolean;
  error: string | null;
  checkStatus: () => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

// Create Zustand store for auth state
export const useAuthStore = create<AuthState>((set) => ({
  authenticated: false,
  tokenExpiresAt: null,
  refreshTokenExpiresAt: null,
  loading: true,
  error: null,

  checkStatus: async () => {
    try {
      set({ loading: true, error: null });
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
  const store = useAuthStore();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    // Check auth status on mount
    if (!initialized) {
      store.checkStatus();
      setInitialized(true);
    }
  }, [initialized, store]);

  // Set up token refresh timer (refresh 1 hour before expiry)
  useEffect(() => {
    if (!store.authenticated || !store.tokenExpiresAt) {
      return;
    }

    const now = new Date().getTime();
    const expiry = store.tokenExpiresAt.getTime();
    const msUntilExpiry = expiry - now;
    const msUntilRefresh = msUntilExpiry - 60 * 60 * 1000; // 1 hour before expiry

    if (msUntilRefresh <= 0) {
      // Token expires soon, refresh immediately
      store.refresh();
      return;
    }

    // Schedule refresh
    const timeoutId = setTimeout(() => {
      store.refresh();
    }, msUntilRefresh);

    return () => clearTimeout(timeoutId);
  }, [store.authenticated, store.tokenExpiresAt, store]);

  return {
    authenticated: store.authenticated,
    tokenExpiresAt: store.tokenExpiresAt,
    refreshTokenExpiresAt: store.refreshTokenExpiresAt,
    loading: store.loading,
    error: store.error,
    logout: store.logout,
    refresh: store.refresh,
    startOAuth: useCallback(() => authService.startOAuth(), []),
  };
}
