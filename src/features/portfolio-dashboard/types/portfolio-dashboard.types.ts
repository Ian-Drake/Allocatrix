/**
 * Portfolio Dashboard Type Definitions
 * 
 * All TypeScript interfaces and types for the Portfolio Dashboard feature
 * including API responses, component props, and internal state
 */

// ============================================================================
// Portfolio & Performance Types
// ============================================================================

export type Timeframe = '30d' | '60d' | '90d' | '180d' | 'ttm';

export interface PortfolioSummary {
  totalValue: number;
  dailyGainLoss: number;
  dailyGainLossPercent: number;
  lastUpdated: string; // ISO 8601 timestamp
}

export interface ChartDataPoint {
  date: string; // ISO 8601 date
  value: number;
}

export type ChartState = {
  selectedTimeframe: Timeframe;
  data: ChartDataPoint[];
  isLoading: boolean;
  error: string | null;
};

// ============================================================================
// Account & Drift Types
// ============================================================================

export interface Account {
  id: string;
  name: string;
  currentValue: number;
  todayGainLoss: number;
  todayGainLossPercent: number;
  excessCash: number;
  correctableDrift: number;
  totalDrift: number;
  positionCount: number;
  cashBalance: number;
}

export interface Position {
  ticker: string;
  quantity: number;
  currentPrice: number;
  marketValue: number;
  allocationPercent: number;
}

export interface ModelAllocation {
  ticker: string;
  targetWeightPercent: number;
}

export interface DriftMetrics {
  totalDrift: number;
  correctableDrift: number;
  remainingDriftAfterRebalance: number;
}

// ============================================================================
// Selection & Action Types
// ============================================================================

export type AccountSelectionState = {
  selectedAccountIds: Set<string>;
  isSelectAll: boolean;
};

export type BulkActionType = 'liquidate' | 'rebalance' | 'useCash';

export interface ActionResult {
  success: boolean;
  successCount: number;
  failureCount: number;
  errors: Array<{
    accountId: string;
    reason: string;
  }>;
  message: string;
}

export type BulkActionState = {
  isExecuting: boolean;
  error: string | null;
  result: ActionResult | null;
};

export type ConfirmDialogState = {
  isOpen: boolean;
  step: number; // 1, 2, or 3 for liquidate; 1 for rebalance
  selectedAccountIds: string[];
  selectedAccounts: Account[];
  isMarketClosed: boolean;
  error: string | null;
};

// ============================================================================
// Hook Return Types
// ============================================================================

export interface UsePortfolioDataReturn {
  summary: PortfolioSummary | null;
  chartData: ChartDataPoint[];
  timeframe: Timeframe;
  isLoading: boolean;
  error: string | null;
  setTimeframe: (timeframe: Timeframe) => void;
  refresh: () => Promise<void>;
}

export interface UseAccountsDataReturn {
  accounts: Account[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export interface UseAccountSelectionReturn {
  selectedAccountIds: string[];
  isAccountSelected: (accountId: string) => boolean;
  toggleAccount: (accountId: string) => void;
  selectAll: (accounts: Account[]) => void;
  clearSelection: () => void;
  getSelectedCount: () => number;
}

export interface UseBulkActionsReturn {
  isExecuting: boolean;
  error: string | null;
  result: ActionResult | null;
  executeLiquidate: (accountIds: string[]) => Promise<ActionResult>;
  executeRebalance: (accountIds: string[]) => Promise<ActionResult>;
  executeUseCash: (accountIds: string[]) => Promise<ActionResult>;
  clearError: () => void;
  reset: () => void;
}

export interface UseMarketHoursReturn {
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
  isClosedOrError: boolean; // true if closed OR detection failed
}

// ============================================================================
// Component Props
// ============================================================================

export interface PortfolioSummaryProps {
  summary: PortfolioSummary | null;
  isLoading: boolean;
  onRefresh: () => Promise<void>;
}

export interface PerformanceChartProps {
  data: ChartDataPoint[];
  timeframe: Timeframe;
  onTimeframeChange: (timeframe: Timeframe) => void;
  isLoading: boolean;
}

export interface AccountGridProps {
  accounts: Account[];
  selectedAccountIds: string[];
  isLoading: boolean;
  onSelectionChange: (accountIds: string[]) => void;
}

export interface BulkActionBarProps {
  selectedCount: number;
  onLiquidate: () => void;
  onRebalance: () => void;
  onUseCash: () => void;
  isEnabled: boolean;
}

export interface LiquidateConfirmDialogProps {
  isOpen: boolean;
  selectedAccounts: Account[];
  isMarketClosed: boolean;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  isExecuting: boolean;
  error: string | null;
}

export interface RebalanceConfirmDialogProps {
  isOpen: boolean;
  selectedAccounts: Account[];
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  isExecuting: boolean;
  error: string | null;
}
