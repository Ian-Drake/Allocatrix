import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { LoginButton } from '@/features/auth/components/LoginButton/LoginButton';

/**
 * Login page - displays OAuth login button
 * Redirects to dashboard if already authenticated
 */
export default function LoginPage() {
  const router = useRouter();
  const { authenticated, loading } = useAuth();

  useEffect(() => {
    // If already authenticated, redirect to dashboard
    if (authenticated && !loading) {
      router.push('/');
    }
  }, [authenticated, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md">
        <h1 className="text-3xl font-bold mb-4">Allocatrix</h1>
        <p className="text-gray-600 mb-6">Portfolio Management for Schwab Accounts</p>
        <LoginButton label="Login with Schwab" />
        <p className="text-gray-500 text-xs mt-6">
          We use Schwab OAuth to securely connect your account. No password is shared with us.
        </p>
      </div>
    </div>
  );
}
