/**
 * Shared backend types for Model Portfolio Account Manager
 */

export type PortfolioStatus = 'Draft' | 'Valid' | 'Locked';
export type AuditAction =
  | 'OAUTH_LOGIN'
  | 'OAUTH_REFRESH'
  | 'OAUTH_LOGOUT'
  | 'MODEL_CREATED'
  | 'MODEL_UPDATED'
  | 'MODEL_VALIDATED'
  | 'MODEL_ASSIGNED'
  | 'MODEL_REASSIGNED'
  | 'MODEL_UNASSIGNED'
  | 'MODEL_CLONED'
  | 'POSITION_REFRESHED'
  | 'DEPLOYMENT_PROPOSED'
  | 'DEPLOYMENT_EXECUTED'
  | 'REBALANCE_PROPOSED'
  | 'REBALANCE_EXECUTED'
  | 'BACKTEST_COMPLETED'
  | 'API_ERROR';

export type AuditStatus = 'pending' | 'executed' | 'failed';
export type OrderType = 'MARKET' | 'LIMIT';
export type DriftStatus = 'aligned' | 'overweight' | 'underweight';

// Portfolio Types
export interface ModelPortfolio {
  id: string;
  name: string;
  description?: string;
  status: PortfolioStatus;
  clonedFromModelId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssetClass {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
}

export interface TickerAllocation {
  id: string;
  assetClassId: string;
  symbol: string;
  displayName?: string;
  targetWeightPctWithinAssetClass: number;
  createdAt: string;
}

// Account Types
export interface Account {
  id: string;
  nickname: string;
  assignedModelPortfolioId?: string | null;
  assignedModelPortfolioName?: string | null;
  lastSyncedAt?: string | null;
  createdAt: string;
}

export interface AccountDetail extends Account {
  positions: Position[];
  totalAccountValue: number;
  availableCash: number;
}

export interface Position {
  symbol: string;
  displayName?: string;
  quantity: number;
  currentPrice: number;
  currentValue: number;
  currentAllocationPct: number;
}

export interface DriftAnalysis {
  symbol: string;
  currentAllocationPct: number;
  targetAllocationPct: number;
  driftPct: number;
  status: DriftStatus;
}

export interface ProposedTrade {
  symbol: string;
  quantity: number;
  orderType: OrderType;
  estimatedPrice?: number;
  estimatedValue?: number;
}

export interface AllocationComparison {
  symbol: string;
  currentAllocationPct: number;
  projectedAllocationPct: number;
  targetAllocationPct: number;
}

// Schwab Token
export interface SchwabToken {
  id: string;
  encryptedAccessToken: string;
  encryptedRefreshToken: string;
  expiresAt: string;
  refreshTokenExpiresAt: string;
  createdAt: string;
  refreshedAt?: string | null;
}

// Account Snapshot (Positions cache)
export interface AccountSnapshot {
  id: string;
  accountId: string;
  timestamp: string;
  positionsJson: string;
  structuredData: Record<string, unknown>;
  totalAccountValue: number;
  availableCash: number;
}

// Audit Log
export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: AuditAction;
  details: Record<string, unknown>;
  status: AuditStatus;
  accountId?: string | null;
  errorMessage?: string | null;
  userId?: string | null;
}

// Backtest Result
export interface BacktestResult {
  id: string;
  modelPortfolioId: string;
  startDate: string;
  endDate: string;
  rebalanceFrequency: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  resultsJson: string;
  createdAt: string;
}
