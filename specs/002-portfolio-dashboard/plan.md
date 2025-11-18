# Implementation Plan: Portfolio Dashboard

**Branch**: `002-portfolio-dashboard` | **Date**: November 17, 2025 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from Portfolio Dashboard spec.md

## Summary

Portfolio Dashboard is a React frontend feature that provides portfolio managers with comprehensive visibility into their multi-account portfolios. The dashboard displays real-time portfolio metrics (total value, daily gain/loss), historical performance trends via interactive charts with multiple timeframes, and an account-level grid showing performance and drift metrics. The feature enables bulk account management through action buttons (Liquidate, Rebalance, Use Cash) with progressive confirmation dialogs and market-hours-aware safety warnings.

**Technical Approach**: React + TypeScript frontend component integrated into the existing Next.js application, leveraging existing backend services (account.service, portfolio.service, drift-calculator.service, etc.). Data fetching via REST API endpoints, with client-side state management for selection and UI state. Charts implemented using a charting library (TBD in research), numerical formatting utilities for currency and percentages.

## Technical Context

**Language/Version**: TypeScript with React 18+, Next.js 14+  
**Primary Dependencies**: React 18+, Chart library (to be selected: recharts or Chart.js), existing backend services  
**Storage**: SQLite (existing backend; no new storage required)  
**Testing**: Vitest + React Testing Library (unit/integration); Supertest for contract tests  
**Target Platform**: Web browser (desktop 1920x1080, tablet 768x1024)  
**Project Type**: Web application (frontend component within existing Next.js monolith)  
**Performance Goals**: Dashboard load <3 seconds; chart timeframe switch <1 second; bulk actions complete <30 seconds  
**Constraints**: Must handle 50+ accounts without performance degradation; responsive layout required; on-demand data refresh only  
**Scale/Scope**: Single-page dashboard component with 6-column account grid; 5 chart timeframe options; 3 bulk action buttons with 2-3 confirmation dialogs each

## Constitution Check

✅ **Bulletproof React Architecture**: Feature will be implemented as a self-contained module in `src/features/portfolio-dashboard/` with pages, components, hooks, services, and types subdirectories.

✅ **Test-First Development**: All components and services will have unit tests written before implementation. Integration tests will validate account grid data flow and bulk action workflows. Contract tests will validate API responses.

✅ **Database-Driven Backend**: Dashboard consumes data from existing SQLite-backed services (account.service, portfolio.service, drift-calculator.service). No new database layer required; all data already persisted.

✅ **API Contract Testing**: Existing backend API endpoints will be validated via contract tests. Dashboard components will consume these endpoints with typed responses verified by Vitest.

✅ **Security & Authentication**: Dashboard assumes user is already authenticated (per assumption). All bulk actions (liquidate, rebalance, use cash) route through secured backend endpoints with existing OAuth token validation.

✅ **UI Design Guidelines**: Dashboard will follow professional trading platform aesthetic with minimalist design, data-centric layout, calm color palette (green for gains, red for losses), cards for summary metrics, table for account grid, line chart for performance, responsive grid layout, smooth transitions.

## Project Structure

### Documentation (this feature)

```text
specs/002-portfolio-dashboard/
├── spec.md              # Feature specification with user stories and requirements
├── plan.md              # This file (implementation approach and architecture)
├── research.md          # Phase 0 research (to be generated)
├── data-model.md        # Phase 1 data model and API contracts (to be generated)
├── quickstart.md        # Phase 1 implementation quickstart (to be generated)
├── contracts/           # Phase 1 OpenAPI contract files (to be generated)
├── checklists/
│   └── requirements.md  # Specification quality checklist
└── tasks.md             # Phase 2 task breakdown (to be generated separately)
```

### Source Code (repository root)

```text
src/
├── features/portfolio-dashboard/
│   ├── pages/
│   │   └── DashboardPage.tsx          # Main dashboard page component
│   ├── components/
│   │   ├── PortfolioSummary/          # Top-level summary card (total value, daily P&L, refresh)
│   │   ├── PerformanceChart/          # Interactive chart with timeframe selector
│   │   ├── AccountGrid/               # Table grid showing accounts
│   │   ├── BulkActionBar/             # Action buttons (Liquidate, Rebalance, Use Cash)
│   │   ├── LiquidateConfirmDialog/    # Multi-step liquidate confirmation flow
│   │   ├── RebalanceConfirmDialog/    # Single-step rebalance confirmation
│   │   ├── ErrorBoundary/             # Error handling wrapper
│   │   └── LoadingState/              # Skeleton/spinner states
│   ├── hooks/
│   │   ├── usePortfolioData.ts        # Fetch portfolio summary and chart data
│   │   ├── useAccountsData.ts         # Fetch account grid data
│   │   ├── useAccountSelection.ts     # Manage checkbox selection state
│   │   ├── useBulkActions.ts          # Handle liquidate/rebalance/use-cash execution
│   │   └── useMarketHours.ts          # Detect market open/closed status
│   ├── services/
│   │   ├── portfolio-dashboard.service.ts  # API calls for dashboard data
│   │   ├── bulk-actions.service.ts        # API calls for liquidate/rebalance/use-cash
│   │   └── market-hours.service.ts        # Detect market hours, handle API failures
│   ├── types/
│   │   └── portfolio-dashboard.types.ts   # TypeScript interfaces for dashboard data
│   ├── utils/
│   │   ├── format-currency.ts        # Format numbers as USD currency
│   │   ├── format-percentage.ts      # Format percentages with sign
│   │   └── chart-data-transform.ts   # Transform API data for chart rendering
│   └── index.ts                       # Feature export

tests/
├── unit/
│   └── portfolio-dashboard/
│       ├── components/                # Component unit tests
│       ├── hooks/                     # Hook unit tests
│       └── services/                  # Service unit tests
├── integration/
│   └── portfolio-dashboard/
│       ├── dashboard-flow.test.ts     # E2E user flow: load → view → select → act
│       └── bulk-actions.test.ts       # Bulk action workflows
└── contract/
    └── portfolio-dashboard.test.ts    # API contract validation

src/pages/
└── dashboard.tsx                       # Next.js page routing to DashboardPage
```

**Structure Decision**: Feature is implemented as a React component module within the existing Next.js application's `src/features/` directory following Bulletproof React conventions. The dashboard page is routed from `src/pages/dashboard.tsx` which imports `DashboardPage` from the feature module. All data fetching is abstracted into services and hooks, enabling independent testing of business logic and UI rendering.

## Complexity Tracking

No Constitution violations identified. All principles are satisfied by the implementation approach.
