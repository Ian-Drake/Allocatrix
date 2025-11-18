/**
 * Portfolio Dashboard Feature Export
 * 
 * Main entry point for the portfolio-dashboard feature module
 * Exports the DashboardPage component for use in routing
 */

export { DashboardPage } from './pages/DashboardPage';

// Re-export types for use by other features
export type {
  Timeframe,
  PortfolioSummary,
  ChartDataPoint,
  Account,
  Position,
  ModelAllocation,
  DriftMetrics,
  ActionResult,
} from './types/portfolio-dashboard.types';
