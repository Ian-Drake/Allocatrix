import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { DashboardPageWithErrorBoundary } from '@/features/portfolio-dashboard/pages/DashboardPageWithErrorBoundary';

export default function Home() {
  const router = useRouter();
  const { authenticated, loading, logout } = useAuth();

  useEffect(() => {
    // If not loading and not authenticated, stay on this page
    // and show a login link rather than auto-redirecting.
    // If you prefer auto-redirect, you can call router.push('/login') here.
  }, [authenticated, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md text-center">
          <h1 className="text-3xl font-bold mb-4">Allocatrix - Model Portfolio Manager</h1>
          <p className="text-gray-600 mb-6">Please log in to view your portfolio dashboard.</p>
          <Link
            href="/login"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="w-full flex justify-end p-4 border-b bg-white/80 backdrop-blur-sm">
        <button
          type="button"
          onClick={logout}
          className="px-3 py-1 text-sm rounded border border-gray-300 hover:bg-gray-100"
        >
          Logout
        </button>
      </header>
      <main className="flex-1">
        <DashboardPageWithErrorBoundary />
      </main>
    </div>
  );
}
