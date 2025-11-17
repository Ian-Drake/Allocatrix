import React from 'react';
import { useAuth } from '../../hooks/useAuth';

interface LoginButtonProps {
  className?: string;
  label?: string;
}

/**
 * LoginButton component - initiates OAuth flow
 */
export function LoginButton({ className, label = 'Login with Schwab' }: LoginButtonProps) {
  const { loading, error, startOAuth } = useAuth();

  const handleLogin = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    startOAuth();
  };

  return (
    <div>
      <button
        onClick={handleLogin}
        disabled={loading}
        className={className || 'px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400'}
      >
        {loading ? 'Loading...' : label}
      </button>
      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
    </div>
  );
}
