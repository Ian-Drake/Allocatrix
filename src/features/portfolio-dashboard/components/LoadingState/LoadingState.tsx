import React from 'react';

/**
 * Skeleton loader for PortfolioSummary
 */
const SummarySkeleton: React.FC = () => (
  <div className="bg-white rounded-lg shadow p-6 mb-6 animate-pulse">
    <div className="space-y-3">
      <div className="h-4 bg-gray-200 rounded w-24"></div>
      <div className="h-12 bg-gray-200 rounded w-48"></div>
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="h-4 bg-gray-200 rounded"></div>
        <div className="h-4 bg-gray-200 rounded"></div>
      </div>
    </div>
  </div>
);

/**
 * Skeleton loader for PerformanceChart
 */
const ChartSkeleton: React.FC = () => (
  <div className="bg-white rounded-lg shadow p-6 mb-6 animate-pulse">
    <div className="space-y-4">
      <div className="h-4 bg-gray-200 rounded w-24"></div>
      <div className="flex gap-2 mb-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-8 bg-gray-200 rounded w-16"></div>
        ))}
      </div>
      <div className="h-64 bg-gray-200 rounded"></div>
    </div>
  </div>
);

/**
 * Skeleton loader for AccountGrid
 */
const GridSkeleton: React.FC = () => (
  <div className="bg-white rounded-lg shadow p-6 animate-pulse">
    <div className="space-y-3">
      <div className="h-10 bg-gray-200 rounded"></div>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-12 bg-gray-200 rounded"></div>
      ))}
    </div>
  </div>
);

interface LoadingStateProps {
  /** Which components to show skeletons for */
  showSummary?: boolean;
  showChart?: boolean;
  showGrid?: boolean;
}

/**
 * LoadingState component displays skeleton loaders for dashboard components
 * while data is being fetched
 */
export const LoadingState: React.FC<LoadingStateProps> = ({
  showSummary = true,
  showChart = true,
  showGrid = true,
}) => {
  return (
    <div className="space-y-6">
      {showSummary && <SummarySkeleton />}
      {showChart && <ChartSkeleton />}
      {showGrid && <GridSkeleton />}
    </div>
  );
};
