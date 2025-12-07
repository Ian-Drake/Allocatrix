# Portfolio Dashboard Feature

Comprehensive portfolio management dashboard with real-time metrics, account performance tracking, and bulk actions.

## Overview

The Portfolio Dashboard is a Next.js feature module that provides users with:
- **Portfolio Summary**: Total value, daily P&L metrics
- **Performance Chart**: Interactive time-series chart with multiple timeframe options
- **Account Grid**: Detailed account-level performance and drift metrics
- **Bulk Actions**: Multi-select accounts and execute liquidate/rebalance/use-cash operations with safety confirmations
- **Error Handling**: Comprehensive error states, empty states, and user-friendly messaging
- **Responsive Design**: Optimized for desktop, tablet, and mobile viewports

## Architecture

```
src/features/portfolio-dashboard/
├── components/          # Reusable React components
│   ├── PortfolioSummary/
│   ├── PerformanceChart/
│   ├── AccountGrid/
│   ├── BulkActionBar/
│   ├── LiquidateConfirmDialog/
│   ├── RebalanceConfirmDialog/
│   ├── ErrorBoundary/
│   ├── LoadingState/
│   ├── EmptyState/
│   ├── ActionStatus/
│   └── ZeroPositionIndicator/
├── hooks/               # Custom React hooks
│   ├── usePortfolioData.ts      # Fetch portfolio summary & chart
│   ├── useAccountsData.ts       # Fetch accounts list
│   ├── useAccountSelection.ts   # Manage multi-select state
│   ├── useBulkActions.ts        # Orchestrate bulk operations
│   └── useMarketHours.ts        # Detect market open/closed
├── services/            # API integration layer
│   ├── portfolio-dashboard.service.ts  # Portfolio APIs
│   ├── bulk-actions.service.ts         # Bulk action APIs
│   └── market-hours.service.ts         # Market hours API
├── pages/               # Next.js pages
│   ├── DashboardPage.tsx               # Main dashboard page
│   └── DashboardPageWithErrorBoundary.tsx
├── types/               # TypeScript definitions
│   └── portfolio-dashboard.types.ts
├── utils/               # Utility functions
│   ├── format-currency.ts       # Format numbers as USD
│   ├── format-percentage.ts     # Format percentages
│   └── chart-data-transform.ts  # Transform API data for Recharts
├── styles/              # CSS animations and styles
│   └── dashboard.css
└── index.ts             # Feature exports

tests/
├── unit/portfolio-dashboard/
│   ├── components/      # Component unit tests
│   ├── hooks/           # Hook unit tests
│   ├── utils/           # Utility function tests
│   └── services/        # Service integration tests
├── integration/portfolio-dashboard/
│   ├── portfolio-overview.test.ts
│   ├── account-grid.test.ts
│   ├── bulk-actions.test.ts
│   └── e2e-dashboard.test.ts
└── contract/
    └── portfolio-dashboard.test.ts  # API contract tests
```

## Core Components

### PortfolioSummary
Displays key portfolio metrics:
- Total portfolio value (large, prominent)
- Today's gain/loss with percentage and color coding
- Last refresh timestamp
- Manual refresh button

**Props:**
```tsx
interface PortfolioSummaryProps {
  summary: PortfolioSummary | null;
  isLoading: boolean;
  onRefresh: () => Promise<void>;
}
```

### PerformanceChart
Interactive performance trend visualization:
- Recharts LineChart for time-series data
- Timeframe selector (30/60/90/180/TTM days)
- Smooth animations on timeframe change
- Responsive container sizing

**Props:**
```tsx
interface PerformanceChartProps {
  data: ChartDataPoint[];
  timeframe: Timeframe;
  onTimeframeChange: (timeframe: Timeframe) => void;
  isLoading: boolean;
}
```

### AccountGrid
Detailed account performance table:
- Multi-select via checkboxes
- Virtual scrolling for 50+ accounts
- Responsive columns (7 desktop, 5 tablet, 3 mobile)
- Row hover highlighting
- Columns: Name, Value, Today's P&L, Excess Cash, Correctable Drift, Total Drift

**Props:**
```tsx
interface AccountGridProps {
  accounts: Account[];
  selectedAccountIds: string[];
  isLoading: boolean;
  onSelectionChange: (ids: string[]) => void;
}
```

### BulkActionBar
Action buttons for selected accounts:
- Liquidate, Rebalance, Use Cash buttons
- Selection summary display
- Disabled state when no accounts selected
- Responsive button layout

**Props:**
```tsx
interface BulkActionBarProps {
  selectedCount: number;
  onLiquidate: () => void;
  onRebalance: () => void;
  onUseCash: () => void;
  isEnabled: boolean;
}
```

### LiquidateConfirmDialog
3-step progressive confirmation for liquidation:
1. Intent confirmation (show accounts, confirm action)
2. Impact details (show estimated proceeds, confirm again)
3. Market closed warning (if applicable)
- Back/Cancel/Confirm buttons per step
- Retry capability on errors
- Detailed error messages

### RebalanceConfirmDialog
Single-step confirmation for rebalancing:
- Confirm action intent
- Show selected accounts
- Cancel or Confirm buttons
- Error handling and retry

### ErrorBoundary
React error boundary for crash protection:
- Catches rendering errors
- Displays user-friendly message
- Shows error details in development
- Refresh page button

### LoadingState
Skeleton loaders for dashboard components:
- Animated placeholders for summary, chart, grid
- Configurable component visibility
- Smooth fade-in animations

### EmptyState Components
- `EmptyPortfolioState`: No accounts linked
- `EmptyGridState`: No data available

## Custom Hooks

### usePortfolioData
Fetches and manages portfolio summary + chart data:
```tsx
const {
  summary,      // PortfolioSummary | null
  chartData,    // ChartDataPoint[]
  timeframe,    // Timeframe
  isLoading,    // boolean
  error,        // string | null
  setTimeframe, // (tf: Timeframe) => void
  refresh,      // () => Promise<void>
} = usePortfolioData();
```

### useAccountsData
Fetches and manages accounts list:
```tsx
const {
  accounts,     // Account[]
  isLoading,    // boolean
  error,        // string | null
  refresh,      // () => Promise<void>
} = useAccountsData();
```

### useAccountSelection
Manages multi-select checkbox state:
```tsx
const {
  selectedIds,           // string[]
  isSelected,           // (id: string) => boolean
  toggleAccount,        // (id: string) => void
  selectAll,            // () => void
  clearSelection,       // () => void
} = useAccountSelection();
```

### useBulkActions
Orchestrates bulk action execution:
```tsx
const {
  isExecuting,          // boolean
  error,                // string | null
  result,               // { success, message, errors }
  executeLiquidate,    // (ids: string[]) => Promise<void>
  executeRebalance,    // (ids: string[]) => Promise<void>
  executeUseCash,      // (ids: string[]) => Promise<void>
  reset,               // () => void
} = useBulkActions();
```

### useMarketHours
Detects market open/closed status:
```tsx
const {
  isOpen,         // boolean
  isClosedOrError, // boolean (true if closed OR error)
  isLoading,      // boolean
  error,          // string | null
} = useMarketHours();
```

## API Services

### portfolioDashboardService
```tsx
fetchPortfolioSummary(): Promise<PortfolioSummary>
fetchPortfolioHistory(period: Timeframe): Promise<ChartDataPoint[]>
fetchAccounts(): Promise<Account[]>
```

### bulkActionsService
```tsx
liquidateAccounts(accountIds: string[]): Promise<ActionResult>
rebalanceAccounts(accountIds: string[]): Promise<ActionResult>
useCash(accountIds: string[]): Promise<ActionResult>
```

### marketHoursService
```tsx
isMarketOpen(): Promise<boolean>  // Caches for 1 hour
```

## Utility Functions

### formatCurrency(value: number, precision?: number): string
Formats numbers as USD currency
- Example: `1234567.89` → `$1,234,567.89`

### formatPercentage(value: number, showSign?: boolean): string
Formats numbers as percentages
- Example: `5.5` → `5.50%`
- With sign: `+5.50%` or `-5.50%`

### transformChartData(rawData: any[], timeframe: Timeframe): ChartDataPoint[]
Transforms API response to Recharts format
- Maps `date` and `value` properties
- Handles different timeframe data structures

## Type Definitions

See `src/features/portfolio-dashboard/types/portfolio-dashboard.types.ts` for:
- `PortfolioSummary`
- `Account`
- `Position`
- `Drift`
- `ChartDataPoint`
- `Timeframe` (30d | 60d | 90d | 180d | ttm)
- `BulkActionState`
- `ConfirmDialogState`

## Error Handling

The dashboard implements comprehensive error handling:

1. **API Errors**: Structured error responses with retry logic
2. **Retry Logic**: Automatic retry on network failures, manual retry on UI
3. **Error Boundaries**: React error boundary catches component crashes
4. **Empty States**: Graceful degradation when no data
5. **User Messaging**: User-friendly error messages with actionable next steps
6. **Partial Failures**: Show succeeded/failed counts with details

## Performance Optimizations

1. **Virtual Scrolling**: react-window for 50+ accounts
2. **Memoization**: React.memo for components
3. **Data Caching**: 1-hour cache for market hours
4. **Lazy Loading**: Code splitting for modals
5. **Responsive Images**: Optimized for all viewports

## Responsive Design

| Breakpoint | Portfolio Summary | Chart | Grid Columns | Actions |
|------------|-----------------|-------|--------------|---------|
| Mobile <480px | Stacked layout | Mobile optimized (300px) | 3 columns (Name, P&L, Drift) | Vertical stack |
| Tablet 481-768px | Balanced | Landscape | 5 columns (Name, Value, P&L, Cash, Drift) | Horizontal |
| Desktop >768px | Full | Full width | 7 columns (all) | Full width |

CSS breakpoints use Tailwind defaults: sm (640px), md (768px), lg (1024px), xl (1280px)

## Animations

Custom CSS animations in `src/features/portfolio-dashboard/styles/dashboard.css`:
- `fadeIn`: Fade content in (300ms)
- `slideIn`: Slide from bottom (300ms)
- `slideInDown`: Slide from top (300ms)
- Reduced motion support for accessibility

## Dark Mode

The dashboard supports dark mode through CSS media queries:
- Defined in `src/features/portfolio-dashboard/styles/dashboard.css`
- Colors adjust automatically based on `prefers-color-scheme`

## Testing

### Unit Tests
- Format utilities (currency, percentage, chart transform)
- Hook logic (selection, bulk actions, data fetching)
- Component rendering
- Error handling

### Integration Tests
- Complete user flows
- Multi-account selection
- Bulk action execution
- Market hours detection
- Responsive behavior

### Contract Tests
- API endpoint availability
- Request/response formats
- Error scenarios

### Run Tests
```bash
npm run test
npm run test:watch
npm run test:coverage
```

## Accessibility

Implemented features:
- Semantic HTML (buttons, forms, labels)
- ARIA labels on interactive elements
- Keyboard navigation support
- Color contrast ratios meet WCAG AA
- Focus indicators on interactive elements
- Screen reader tested

## Performance Targets

- Dashboard load time: <3 seconds
- Chart timeframe switch: <1 second
- Bulk action completion (50 accounts): <30 seconds

## Contributing

When adding new features:
1. Update types in `portfolio-dashboard.types.ts`
2. Create service functions with error handling
3. Add custom hooks for data management
4. Build components with responsive design
5. Write tests before implementation (TDD)
6. Update this README

## API Dependencies

The dashboard depends on these backend API endpoints:

- `GET /api/portfolios/summary` - Portfolio metrics
- `GET /api/portfolios/history?period={30d|60d|90d|180d|ttm}` - Chart data
- `GET /api/accounts` - Accounts list
- `POST /api/accounts/{id}/liquidate` - Liquidate account
- `POST /api/accounts/{id}/rebalance` - Rebalance account
- `POST /api/accounts/{id}/use-cash` - Deploy excess cash
- `GET /api/market-hours` - Market open/closed status

See `specs/002-portfolio-dashboard/contracts/` for OpenAPI specifications.

## Deployment

1. Ensure all tests pass: `npm run test`
2. Verify linting: `npm run lint`
3. Build successfully: `npm run build`
4. Create deployment PR with checklist
5. Deploy to staging for UAT
6. Deploy to production

## Support

For issues or questions about the portfolio dashboard:
- Check the implementation notes at `specs/002-portfolio-dashboard/implementation-notes.md`
- Review the spec at `specs/002-portfolio-dashboard/spec.md`
- Check the research document at `specs/002-portfolio-dashboard/research.md`
