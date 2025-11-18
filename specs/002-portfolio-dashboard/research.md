# Phase 0 Research: Portfolio Dashboard

**Purpose**: Resolve all technical unknowns and validate assumptions before design phase

## Research Summary

This document consolidates findings from research into technology choices, best practices, integration patterns, and implementation approaches for the Portfolio Dashboard feature. All decisions below are now resolved and ready for Phase 1 design.

## Technology Decisions

### 1. Chart Library Selection

**Unknown**: Which charting library should be used for the performance chart (timeframe selector, multiple data series)?

**Decision**: **Recharts**

**Rationale**: 
- React-native component library (perfect fit for Bulletproof React)
- Excellent TypeScript support with full type definitions
- Built-in responsive behavior and mobile support (meets tablet 768x1024 constraint)
- Lightweight bundle (~60KB gzipped)
- Active community with clear documentation
- Responsive ResponsiveContainer component handles sizing automatically
- Simple data format (array of objects) aligns with our data structure
- Built-in animations enable SC-002 requirement (smooth <1s transitions)

**Alternatives Considered**:
- Chart.js: Excellent but canvas-based; less React-friendly, more imperative API
- Plotly.js: Feature-rich but heavier bundle (~300KB), overkill for our use case
- Victory: Fully React-native but less popular, smaller ecosystem
- Apache ECharts: Powerful but steep learning curve, large bundle size

**Implementation Note**: Recharts components include `LineChart` (for performance trend), `XAxis`, `YAxis`, `Legend`, `Tooltip`, and `ResponsiveContainer`. Data transformation utility will convert API response to Recharts data format: `[{ date: "2025-11-17", value: 150000 }, ...]`

---

### 2. State Management for Account Selection

**Unknown**: Should account selection state be managed locally in the component, or using a global state manager?

**Decision**: **Local component state with Context for sub-components**

**Rationale**:
- Selection state is transient (lost on page reload, not persisted)
- Selection only affects action button visibility and confirmation dialogs
- No other features need access to selection state
- Avoids Zustand/Context API overhead for simple use case
- Keeps feature self-contained per Bulletproof React principle
- React's `useState` hook is sufficient; sub-components can receive selection state via props or local Context

**Alternatives Considered**:
- Zustand global store: Overkill; adds unnecessary complexity and bundle size
- Redux: Way too heavy for this use case
- URL query parameters: Possible but defeats purpose of transient selection state

**Implementation Note**: `useAccountSelection` hook will manage checkbox state internally, providing `selectedAccountIds`, `isAccountSelected()`, `toggleAccount()`, `selectAll()`, `clearSelection()`. Sub-components pass selection state via props.

---

### 3. Data Fetching Strategy

**Unknown**: Should dashboard use client-side fetching (hooks) or server-side rendering with Next.js getServerSideProps?

**Decision**: **Client-side fetching with React hooks** (useEffect + fetch/axios)

**Rationale**:
- Dashboard is user-specific data (requires authentication); SSR adds complexity
- Data is user-initiated refresh only (no auto-refresh); lazy loading is fine
- Allows independent testing of data fetching logic
- Enables error handling at component level (show spinner, retry button)
- Aligns with existing Allocatrix patterns (backend services used by frontend hooks)
- Reduces server load for static dashboard layout

**Alternatives Considered**:
- Next.js getServerSideProps: Forces server rendering on every request; slower
- Static generation (getStaticProps): Inappropriate for real-time portfolio data
- GraphQL: Adds overhead; REST API is sufficient

**Implementation Note**: `usePortfolioData` and `useAccountsData` hooks will handle fetching, loading state, error state, and optional `refetch()` function. Errors surface error boundary or inline error message.

---

### 4. API Response Data Structure

**Unknown**: What format should backend API return for portfolio metrics and account grid data?

**Decision**: **Separate endpoints with consistent schemas** (detailed in data-model.md and contracts/)

**Rationale**:
- Separation of concerns: portfolio summary vs account-level details
- Allows independent caching/refresh of summary and grid
- Aligns with REST principles (each resource has own endpoint)
- Enables contract testing of each endpoint independently

**Endpoints** (detailed in Phase 1 contracts):
- `GET /api/portfolios/summary` → Total value, daily P&L, last updated
- `GET /api/portfolios/history?period={30|60|90|180|ttm}` → Array of {date, value} points for chart
- `GET /api/accounts` → Array of accounts with all metrics (name, value, drift, cash, etc.)

**Implementation Note**: Services layer (`portfolio-dashboard.service.ts`, `bulk-actions.service.ts`) will abstract these endpoints, providing typed responses that components consume.

---

### 5. Drift Calculation Execution

**Unknown**: Should drift calculations happen in backend or frontend? Who triggers the "correctable drift" simulation?

**Decision**: **Backend calculates; frontend displays**

**Rationale**:
- Drift calculation is complex (requires simulating rebalance trades, accounting for discrete shares and pricing constraints)
- Backend has access to real market pricing, cash positions, and model allocations
- Avoids duplicating complex business logic in frontend
- Performance: backend can cache drift calculations; frontend only displays
- Security: ensures calculations are authoritative and tamper-proof

**Alternatives Considered**:
- Frontend calculates drift: Risky (duplicates logic), slower (needs market data), no single source of truth
- Hybrid: Partial calculation in frontend: Adds complexity, hard to maintain

**Implementation Note**: `GET /api/accounts` endpoint returns pre-calculated `totalDrift` and `correctableDrift` values. Frontend formats and displays only. Backend (existing services) already implements drift calculation per clarification session.

---

### 6. Market Hours Detection

**Unknown**: How should the system determine if US markets are open? What if the API fails?

**Decision**: **Use backend market hours service with safe default (assume closed)**

**Rationale**:
- Market hours data is centralized (backend responsibility)
- API failure handling: assume market is closed → display thin-order-book warning (safer default per clarification)
- Prevents silent errors or incorrect warnings
- User is warned in either case; liquidate proceeds cautiously

**Alternatives Considered**:
- Client-side detection (hardcoded times): Doesn't account for market holidays
- Let user manually specify: Adds friction; error-prone
- No warning if API fails: Risky; could result in poor execution

**Implementation Note**: `useMarketHours` hook calls backend endpoint. On error or if closed, displays additional thin-order-book warning. See FR-013 for behavior.

---

### 7. Confirmation Dialog Flow for Liquidate

**Unknown**: How should the multi-dialog flow work for liquidate? What's the exact sequence?

**Decision**: **Staged progressive disclosure with market-hours gate**

**Rationale**:
- First dialog: Confirm intent (prevent accidental clicks)
- Second dialog: Final confirmation (double-check before execution)
- Third dialog (conditional): If market is closed or detection fails, warn about thin order books
- Staged approach prevents decision fatigue while protecting against critical mistakes

**Flow**:
1. User selects account(s) and clicks "Liquidate"
2. Check market hours (call backend)
3. If open: Show Dialog 1 (intent confirmation), then Dialog 2 (final)
4. If closed or API error: Show Dialog 1 (intent), Dialog 2 (final), Dialog 3 (thin books warning)
5. After all confirmations: Execute liquidate action

**Implementation Note**: `LiquidateConfirmDialog` component manages state machine with three steps. See quickstart.md for pseudo-code.

---

### 8. Bulk Action Button Availability Logic

**Unknown**: When should Liquidate, Rebalance, and Use Cash buttons be enabled/disabled? Should they be hidden if no accounts selected, or just disabled?

**Decision**: **Disabled when <1 account selected; visibility remains constant**

**Rationale**:
- Keeps UI consistent (no jumping/resizing)
- Disabled state is visual indicator (grayed out, cursor not-allowed)
- Easier to implement than conditional rendering
- Aligns with standard UI patterns (enable/disable based on selection)

**Exceptions**:
- Use Cash: Always available (can use cash even from empty accounts; just no-op)
- Liquidate/Rebalance: Disabled if account has 0 positions (optional; could show tooltip explaining why)

**Implementation Note**: `BulkActionBar` component checks `selectedAccountIds.length > 0` and conditionally sets `disabled` prop on buttons.

---

### 9. Error Handling for Bulk Actions

**Unknown**: If a liquidate/rebalance/use-cash action partially fails (e.g., 2 of 3 accounts succeed), how should we handle it?

**Decision**: **Show error modal with detailed results; allow retry or cancel**

**Rationale**:
- Partial success is not necessarily failure; user needs visibility into what succeeded/failed
- Retry capability lets user fix transient errors (network, rate limit)
- Detailed results help user understand what needs manual intervention
- Prevents silent failures or data loss

**Implementation Note**: Bulk action service returns structured response: `{ successCount, failureCount, errors: [{ accountId, reason }] }`. Component displays results in modal with retry option.

---

### 10. Performance Optimization for 50+ Accounts

**Unknown**: How should we handle performance when rendering 50+ accounts in the grid?

**Decision**: **Virtual scrolling (lazy rendering) for large lists**

**Rationale**:
- 50+ accounts would result in 50+ DOM nodes (row components)
- Virtual scrolling renders only visible rows (e.g., 10-15 at a time)
- Massive performance boost with minimal code complexity
- Library options: `react-window` or `react-virtual`

**Alternatives Considered**:
- Pagination: Forces user to navigate between pages; poor UX
- No optimization: Grid becomes sluggish; violates SC-006

**Implementation Note**: `AccountGrid` component uses `react-window` `FixedSizeList` to virtualize rows. Each row is a light component that receives account data as props.

---

### 11. Responsive Design Breakpoints

**Unknown**: What breakpoints should be used for responsive dashboard layout?

**Decision**: **Desktop-first with breakpoints at 768px (tablet), 480px (mobile)**

**Rationale**:
- SC-007 specifies desktop (1920x1080) and tablet (768x1024) support
- Mobile support is nice-to-have (not required, but achievable)
- Desktop-first approach: start with desktop layout, simplify for smaller screens
- Common breakpoint: 768px is standard tablet threshold

**Layout Changes**:
- Desktop (>768px): Side-by-side summary + chart, full 6-column grid
- Tablet (768px): Stacked summary/chart, 4-column grid (drop Excess Cash or combine columns)
- Mobile (<480px): 2-column grid, minimal metrics

**Implementation Note**: Use Tailwind CSS responsive utilities (`md:`, `lg:`) or CSS media queries. Test on actual devices (1920x1080, 768x1024).

---

## Integration Points with Existing Code

### Backend Services (Already Exist)

The dashboard integrates with these existing backend services. No new service implementations required:

- **account.service.ts**: Fetches account data, balances, positions
- **portfolio.service.ts**: Aggregates account data into portfolio metrics
- **drift-calculator.service.ts**: Computes total drift and correctable drift
- **trades.service.ts**: Executes liquidate, rebalance, use-cash operations
- **token-manager.service.ts**: Handles OAuth token refresh for API calls
- **historical-data.service.ts**: Provides portfolio value history for chart

### API Endpoints (Assumed to Exist or Require Creation)

These endpoints are documented in Phase 1 data-model.md and contracts/. If they don't exist, backend team must implement them:

- `GET /api/portfolios/summary`
- `GET /api/portfolios/history?period={30|60|90|180|ttm}`
- `GET /api/accounts`
- `POST /api/accounts/{id}/liquidate` (confirm + execute)
- `POST /api/accounts/{id}/rebalance` (confirm + execute)
- `POST /api/accounts/{id}/use-cash` (confirm + execute)
- `GET /api/market-hours` (detect market open/closed)

---

## Potential Challenges & Mitigations

### Challenge 1: Data Consistency
**Issue**: Portfolio summary and account grid fetch from separate endpoints; could show inconsistent totals.

**Mitigation**: Implement cache invalidation strategy. After bulk action completes, invalidate both summary and grid caches. Component refetches both on action completion.

### Challenge 2: Real-Time Updates
**Issue**: User expects dashboard to reflect market changes, but we use on-demand refresh only.

**Mitigation**: Per clarification, on-demand refresh is intentional (reduces server load). Add prominent "Last Refreshed: X minutes ago" indicator and refresh button in summary. Users understand refresh is manual.

### Challenge 3: Market Hours Edge Cases
**Issue**: Market hours detection API fails; we default to "assume closed" warning. User might be confused.

**Mitigation**: Log error server-side for monitoring. Display user-friendly message: "Unable to determine market status. Proceeding with caution; order may execute immediately." User informed; action proceeds.

### Challenge 4: Bulk Action Cancellation
**Issue**: User cancels a liquidate action mid-dialog; dialog state needs to reset cleanly.

**Mitigation**: Dialog component manages its own state machine. Cancellation resets to initial state. Sub-components don't leak state.

---

## Phase 1 Deliverables Ready

All research questions resolved. Ready to proceed with Phase 1 (Design phase):

✅ Technology stack finalized (Recharts, React hooks, client-side fetch)  
✅ API contract decisions made (separate endpoints, schemas TBD in Phase 1)  
✅ State management approach defined (local + Context)  
✅ Error handling strategy established  
✅ Performance optimization identified (virtual scrolling)  
✅ Responsive design breakpoints set  
✅ Integration points mapped to existing services  
✅ Risk mitigations documented  

**Next Step**: Run `/speckit.plan` Phase 1 to generate:
- `data-model.md` (Entity relationships and API schemas)
- `contracts/` (OpenAPI specifications for all endpoints)
- `quickstart.md` (Implementation walkthrough with code snippets)
