'use client';

import React from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary/ErrorBoundary';
import { DashboardPage } from './DashboardPage';

/**
 * Dashboard page wrapped with error boundary for crash protection
 */
export const DashboardPageWithErrorBoundary: React.FC = () => {
  return (
    <ErrorBoundary>
      <DashboardPage />
    </ErrorBoundary>
  );
};

DashboardPageWithErrorBoundary.displayName = 'DashboardPageWithErrorBoundary';
