# Implementation Tasks: Model Portfolio Account Manager

**Feature**: 001-portfolio-manager  
**Status**: Ready for Implementation  
**Generated**: 2025-11-16  
**Total Tasks**: 87  

---

## 📋 Task Overview

This document contains all implementation tasks organized by phase and user story. Each task is independently executable and follows the strict checklist format with Task IDs, priority markers, story labels, and file paths.

**Task Format**: `- [ ] [TaskID] [P?] [Story?] Description with file path`

**Task Count Summary**:
- Phase 1 (Setup): 8 tasks
- Phase 2 (Foundational): 12 tasks
- Phase 3 (User Story 1 - OAuth): 14 tasks
- Phase 4 (User Story 2 - Portfolio Creation): 15 tasks
- Phase 5 (User Story 3 - Portfolio Assignment): 10 tasks
- Phase 6 (User Story 4 - Positions & Drift): 12 tasks
- Phase 7 (User Story 5 - Cash Deployment): 13 tasks
- Phase 8 (User Story 6 - Full Rebalance): 13 tasks
- Phase 9 (User Story 7 - Backtesting): 10 tasks
- Phase 10 (Polish & Cross-Cutting): 8 tasks

---

## 🔄 User Story Dependency Graph

```
Phase 1: Setup (Project Init)
    ↓
Phase 2: Foundational (Database, Auth Middleware, API Base)
    ├─→ Phase 3: User Story 1 (OAuth) ─────────────────┐
    │                                                    │
    ├─→ Phase 4: User Story 2 (Portfolio CRUD) ────┐   │
    │   (Independent of Story 1)                     │   │
    │                                                ↓   ↓
    ├─→ Phase 5: User Story 3 (Assignment)         │   │ (Depends on 1 & 2)
    │                                                ├──→┤
    ├─→ Phase 6: User Story 4 (Positions/Drift)    │   │ (Depends on 1 & 3)
    │                                                ├──→┤
    ├─→ Phase 7: User Story 5 (Cash Deployment)    │   │ (Depends on 1, 3, 4)
    │                                                ├──→┤
    ├─→ Phase 8: User Story 6 (Rebalance)          │   │ (Depends on 1, 3, 4)
    │                                                ├──→┤
    └─→ Phase 9: User Story 7 (Backtesting)────────┘   │ (Depends on 1, 2)
                                                         ↓
Phase 10: Polish & Cross-Cutting (Logging, Error Handling)
```

**MVP Scope**: Implement Phase 1 + Phase 2 + Phase 3 (User Story 1) first. This enables authentication and provides foundation for all other features. Estimated MVP completion: 30-40 hours.

**Parallel Opportunities**:
- Phase 4 (Portfolio CRUD) can start in parallel with Phase 3 (no dependency)
- Phase 6 (Positions) and Phase 7 (Cash Deployment) can run in parallel after Phase 5
- Phase 8 (Rebalance) and Phase 7 can run in parallel (both post-Phase 5)
- Phase 9 (Backtesting) can start after Phase 2 only (no user account needed)

---

## Phase 1: Project Setup & Infrastructure

Initialize project, install dependencies, and configure build tools.

### Phase 1 Goals
- ✅ Set up Next.js project structure per plan.md
- ✅ Install all required dependencies (frontend, backend, testing, utilities)
- ✅ Configure TypeScript, ESLint, Prettier
- ✅ Create initial environment variables and configuration
- ✅ Set up git repository branch structure

### Phase 1 Tasks

- [X] T001 Create Next.js project structure with Bulletproof React folder layout in `src/pages`, `src/features`, `src/shared`, `src/backend`
- [X] T002 Install core dependencies: next@14, react@18, typescript, zustand, express, sqlite3, crypto
- [X] T003 Install testing dependencies: vitest, jest, @testing-library/react, supertest, openapi-backend
- [X] T004 Configure TypeScript: Create `tsconfig.json` with strict mode, target ES2020, module resolution
- [X] T005 Set up ESLint configuration in `.eslintrc.json` with Next.js and React rules
- [X] T006 Configure Prettier in `.prettierrc.json` with 2-space indentation and semicolons
- [X] T007 Create `.env.example` with placeholder values: SCHWAB_CLIENT_ID, CLIENT_SECRET, ENCRYPTION_KEY, DATABASE_URL
- [X] T008 Initialize git branch: `git checkout -b 001-portfolio-manager` and create `.gitignore` excluding .env.local, node_modules, build artifacts

---

## Phase 2: Foundational Infrastructure (Blocking Prerequisites)

Set up database, authentication middleware, API base structure, and utilities. These tasks block all user stories.

### Phase 2 Goals
- ✅ Database schema created with all 9 entities
- ✅ Encryption utilities for token/account ID protection
- ✅ Token manager service for OAuth refresh logic
- ✅ API response/error handling middleware
- ✅ Base service layer for Schwab API integration
- ✅ HTTP-only session cookie middleware

### Phase 2 Tasks

- [X] T009 Create database initialization: `src/backend/db/database.ts` with SQLite connection pooling and migration runner
- [X] T010 Create migration 001: `src/backend/db/migrations/001-create-model-portfolios.ts` (model_portfolio table)
- [X] T011 Create migration 002: `src/backend/db/migrations/002-create-asset-classes.ts` (asset_class table)
- [X] T012 Create migration 003: `src/backend/db/migrations/003-create-model-portfolio-asset-classes.ts` (junction table)
- [X] T013 Create migration 004: `src/backend/db/migrations/004-create-ticker-allocations.ts` (ticker_allocation table)
- [X] T014 Create migration 005: `src/backend/db/migrations/005-create-accounts.ts` (account table with encryption fields)
- [X] T015 Create migration 006: `src/backend/db/migrations/006-create-schwab-tokens.ts` (schwab_token table with encrypted columns)
- [X] T016 Create migration 007: `src/backend/db/migrations/007-create-account-snapshots.ts` (account_snapshot table with JSON fields)
- [X] T017 Create migration 008: `src/backend/db/migrations/008-create-audit-log.ts` (audit_log_entry table with JSON details)
- [X] T018 Create migration 009: `src/backend/db/migrations/009-create-backtest-results.ts` (backtest_result table with JSON results)
- [X] T019 [P] Create encryption utility: `src/backend/utils/encryption.ts` with AES-256 encrypt/decrypt functions using ENCRYPTION_KEY
- [X] T020 [P] Create token manager service: `src/backend/services/token-manager.service.ts` with token refresh logic and expiry checking

---

## Phase 3: User Story 1 - Schwab OAuth Account Linking (Priority: P1)

**Story Goal**: User can securely connect Schwab brokerage accounts via OAuth 2.0. This is the entry point and blocker for all other features.

**Independent Test Criteria**:
- ✅ User can initiate OAuth flow without errors
- ✅ OAuth callback correctly exchanges authorization code for tokens
- ✅ Access and refresh tokens are encrypted and stored in SQLite
- ✅ Tokens are automatically refreshed before expiry (30-min access tokens)
- ✅ Account list is fetched and stored after OAuth
- ✅ HTTP-only session cookies protect token access from frontend
- ✅ Expired refresh tokens trigger re-authentication

**Implementation Strategy**: 
1. Create auth service with OAuth client logic
2. Implement API endpoints: `/api/auth/start`, `/api/auth/callback`, `/api/auth/refresh-token`
3. Write integration tests covering all acceptance scenarios
4. Add UI: LoginButton component and OAuth redirect handler

### Phase 3 Tasks

- [X] T021 [US1] Create auth service: `src/backend/services/auth.service.ts` with Schwab OAuth configuration and token exchange
- [X] T022 [US1] Create token refresh middleware: `src/backend/middleware/token-refresh.middleware.ts` that checks token expiry and refreshes if needed
- [X] T023 [US1] Create auth guard middleware: `src/backend/middleware/auth-guard.ts` that validates session and ensures user is authenticated
- [X] T024 [US1] Create API endpoint: `src/pages/api/auth/start.ts` that generates OAuth URL and redirects user to Schwab
- [X] T025 [US1] Create API endpoint: `src/pages/api/auth/callback.ts` that handles OAuth callback, exchanges code for tokens, encrypts and stores
- [X] T026 [US1] Create API endpoint: `src/pages/api/auth/refresh-token.ts` that refreshes expired tokens using refresh token
- [X] T027 [US1] Create API endpoint: `src/pages/api/auth/logout.ts` that clears session cookie and invalidates token
- [X] T028 [US1] Create session middleware: `src/backend/middleware/session.middleware.ts` with HTTP-only cookie configuration
- [X] T029 [US1] [P] Write integration test: `tests/integration/oauth-flow.test.ts` for acceptance scenario 1-5 (redirect, callback, token exchange, refresh, expiry)
- [X] T030 [US1] [P] Write contract test: `tests/contract/auth-contract.test.ts` validating /api/auth/* endpoints against auth-apis.openapi.yaml
- [X] T031 [US1] Create auth service in frontend: `src/features/auth/services/auth.service.ts` with endpoints for login/logout
- [X] T032 [US1] Create auth hook: `src/features/auth/hooks/useAuth.ts` managing authentication state with Zustand store
- [X] T033 [US1] Create LoginButton component: `src/features/auth/components/LoginButton/LoginButton.tsx` that initiates OAuth flow
- [X] T034 [US1] Create login page: `src/pages/login.tsx` with LoginButton and OAuth callback handler

---

## Phase 4: User Story 2 - Model Portfolio Creation & Editing (Priority: P1)

**Story Goal**: User can create and edit model portfolios defining target asset allocations. Portfolio states (Draft → Valid → Locked) control modification permissions.

**Independent Test Criteria**:
- ✅ User can create Draft portfolio
- ✅ User can add Asset Classes with target weights
- ✅ User can add tickers within Asset Classes
- ✅ Weight validation prevents invalid portfolios (sum ≠ 100% ±1%)
- ✅ User can transition from Draft → Valid after validation
- ✅ User cannot edit Valid/Locked portfolios (must clone)
- ✅ User can clone locked portfolios to new Draft copies

**Implementation Strategy**:
1. Create portfolio service with CRUD and validation logic
2. Implement API endpoints: `/api/portfolios/*` for CRUD + validate
3. Write unit tests for weight validation (Red-Green-Refactor)
4. Write integration tests for full portfolio creation flow
5. Create form UI components with validation feedback

### Phase 4 Tasks

- [X] T035 [US2] Create portfolio validation service: `src/backend/services/portfolio-validation.service.ts` with weight sum checks and tolerance logic
- [X] T036 [US2] Create portfolio service: `src/backend/services/portfolio.service.ts` with CRUD, state transition, and cloning logic
- [X] T037 [US2] [P] Write unit test: `tests/unit/portfolio/portfolio-validation.test.ts` for weight sum validation (TDD: Red-Green-Refactor)
- [X] T038 [US2] [P] Write unit test: `tests/unit/portfolio/portfolio-state-machine.test.ts` for state transitions (Draft → Valid → Locked)
- [X] T039 [US2] Create API endpoint: `src/pages/api/portfolios/create.ts` that creates Draft portfolio
- [X] T040 [US2] Create API endpoint: `src/pages/api/portfolios/list.ts` that retrieves all portfolios with state
- [X] T041 [US2] Create API endpoint: `src/pages/api/portfolios/[id].ts` that retrieves, updates, and deletes portfolio
- [X] T042 [US2] Create API endpoint: `src/pages/api/portfolios/[id]/validate.ts` that validates portfolio and transitions to Valid
- [X] T043 [US2] Create API endpoint: `src/pages/api/portfolios/[id]/clone.ts` that clones locked portfolio to new Draft
- [X] T044 [US2] Create API endpoint: `src/pages/api/portfolios/[id]/asset-classes.ts` for managing Asset Classes within portfolio
- [X] T045 [US2] Create API endpoint: `src/pages/api/portfolios/[id]/tickers.ts` for managing ticker allocations
- [X] T046 [US2] [P] Write integration test: `tests/integration/portfolio-creation.test.ts` for acceptance scenarios 1-6
- [X] T047 [US2] [P] Write contract test: `tests/contract/portfolio-contract.test.ts` validating portfolio endpoints against portfolio-apis.openapi.yaml
- [X] T048 [US2] Create portfolio store: `src/features/portfolio-management/services/portfolio.store.ts` with Zustand for state management
- [X] T049 [US2] Create portfolio form component: `src/features/portfolio-management/components/PortfolioForm/PortfolioForm.tsx` with name/description inputs
- [X] T050 [US2] Create asset class editor component: `src/features/portfolio-management/components/AssetClassEditor/AssetClassEditor.tsx` for managing asset classes and weights
- [X] T051 [US2] Create ticker allocator component: `src/features/portfolio-management/components/TickerAllocator/TickerAllocator.tsx` for managing tickers within classes
- [X] T052 [US2] Create portfolio pages: `src/pages/portfolios/index.tsx` (list) and `src/pages/portfolios/[id].tsx` (edit)

---

## Phase 5: User Story 3 - Account Model Assignment (Priority: P1)

**Story Goal**: User can assign a valid model portfolio to a Schwab account to establish target allocation. Assignment locks the model.

**Independent Test Criteria**:
- ✅ User can view linked accounts from Schwab
- ✅ User can select and assign valid model to account
- ✅ Assignment locks the model (prevents editing)
- ✅ User can reassign account to different model
- ✅ Previous model remains locked after reassignment
- ✅ UI prevents editing locked models with helpful message

**Implementation Strategy**:
1. Create account service for management
2. Implement API endpoints: `/api/accounts/*` for assignment
3. Write integration tests for assignment workflow
4. Create account detail UI with model selector

### Phase 5 Tasks

- [X] T053 [US3] Create account service: `src/backend/services/account.service.ts` with account management and model assignment
- [X] T054 [US3] Create API endpoint: `src/pages/api/accounts/list.ts` that retrieves Schwab accounts via OAuth
- [X] T055 [US3] Create API endpoint: `src/pages/api/accounts/[id].ts` that retrieves account details and assignment
- [X] T056 [US3] Create API endpoint: `src/pages/api/accounts/[id]/assign-model.ts` that assigns model and locks it
- [X] T057 [US3] [P] Write integration test: `tests/integration/portfolio-assignment.test.ts` for acceptance scenarios 1-5
- [X] T058 [US3] [P] Write contract test: `tests/contract/account-contract.test.ts` validating account endpoints
- [X] T059 [US3] Create account store: `src/features/account-management/services/account.store.ts` with Zustand
- [X] T060 [US3] Create account card component: `src/features/account-management/components/AccountCard/AccountCard.tsx` displaying account and model assignment
- [X] T061 [US3] Create model selector component: `src/features/account-management/components/ModelSelector/ModelSelector.tsx` for assigning model to account
- [X] T062 [US3] Create account pages: `src/pages/accounts/index.tsx` (list) and `src/pages/accounts/[id].tsx` (detail with assignment)

---

## Phase 6: User Story 4 - Account Positions & Drift Display (Priority: P2)

**Story Goal**: User can view current account positions from Schwab and see how they drift from target allocation.

**Independent Test Criteria**:
- ✅ Positions are fetched from Schwab and displayed in table
- ✅ Drift % calculated correctly (current vs. target)
- ✅ Tickers with >5% drift highlighted as overweight/underweight
- ✅ Cash balance and reserves displayed separately
- ✅ User can manually refresh positions
- ✅ Performance: Positions load in <30s, refresh in <3s (SC-003, SC-004)

**Implementation Strategy**:
1. Create Schwab API service for fetching positions
2. Create drift calculator service
3. Create account snapshot service for caching
4. Write integration tests with performance assertions
5. Create positions table UI component

### Phase 6 Tasks

- [X] T063 [US4] Create Schwab API service: `src/backend/services/schwab-api.service.ts` with retry logic and circuit breaker for API calls
- [X] T064 [US4] Create positions service: `src/backend/services/positions.service.ts` for fetching and caching positions
- [X] T065 [US4] Create drift calculator: `src/backend/services/drift-calculator.service.ts` computing drift % for each ticker
- [X] T066 [US4] [P] Write unit test: `tests/unit/account/drift-calculator.test.ts` for drift calculation (Red-Green-Refactor)
- [X] T067 [US4] Create API endpoint: `src/pages/api/accounts/[id]/positions.ts` that fetches and caches positions
- [X] T068 [US4] Create API endpoint: `src/pages/api/accounts/[id]/drift.ts` that calculates drift for assigned model
- [X] T069 [US4] Create API endpoint: `src/pages/api/accounts/[id]/refresh-positions.ts` that manually refreshes position cache
- [X] T070 [US4] [P] Write integration test: `tests/integration/positions-display.test.ts` for acceptance scenarios 1-5 including performance tests
- [X] T071 [US4] [P] Write contract test: `tests/contract/position-contract.test.ts` validating position/drift endpoints against openapi schemas
- [X] T072 [US4] Create positions hook: `src/features/account-management/hooks/useAccountPositions.ts` fetching and managing position state
- [X] T073 [US4] Create drift hook: `src/features/account-management/hooks/useAccountDrift.ts` calculating and displaying drift
- [X] T074 [US4] Create positions table component: `src/features/account-management/components/PositionsTable/PositionsTable.tsx` with highlight for drift >5%

---

## Phase 7: User Story 5 - Cash Deployment (Priority: P2)

**Story Goal**: User can deploy available cash into underweight positions according to model allocation to gradually build toward target.

**Independent Test Criteria**:
- ✅ Algorithm calculates target dollar amounts for underweight tickers
- ✅ Trades proportionally allocated across underweights
- ✅ Projected allocation preview shown before execution (SC-007: <5 clicks)
- ✅ Trades submitted to Schwab and recorded in audit log
- ✅ Reserve amount protected (not deployed)
- ✅ Insufficient cash handled: proportional allocation across available funds
- ✅ Performance: Calculation <1s (SC-005)
- ✅ Rounding handled: minimal leftover cash

**Implementation Strategy**:
1. Create cash deployment calculator service
2. Create trades service for Schwab submission
3. Create API endpoints for preview and execution
4. Write integration tests with performance assertions
5. Create preview UI with trade list and projected allocation

### Phase 7 Tasks

- [X] T075 [US5] Create cash deployment service: `src/backend/services/cash-deployment.service.ts` with proportional allocation calculator
- [X] T076 [US5] [P] Write unit test: `tests/unit/account/cash-deployment.test.ts` for allocation algorithm (Red-Green-Refactor)
- [X] T077 [US5] Create trades service: `src/backend/services/trades.service.ts` for Schwab order submission and audit logging
- [X] T078 [US5] Create API endpoint: `src/pages/api/accounts/[id]/deploy-cash.ts` that calculates and previews deployment
- [X] T079 [US5] Create API endpoint: `src/pages/api/accounts/[id]/deploy-cash/execute.ts` that submits trades to Schwab
- [X] T080 [US5] [P] Write integration test: `tests/integration/cash-deployment.test.ts` for acceptance scenarios 1-5 including SC-005 performance
- [X] T081 [US5] Create cash deployment hook: `src/features/account-management/hooks/useCashDeployment.ts` managing deployment state
- [X] T082 [US5] Create deployment widget: `src/features/account-management/components/CashDeploymentWidget/CashDeploymentWidget.tsx` with preview and execution
- [X] T083 [US5] Create trade preview component: `src/features/account-management/components/TradePreview/TradePreview.tsx` showing proposed trades and projected allocation
- [X] T084 [US5] Create confirmation dialog: `src/shared/components/ConfirmationDialog/ConfirmationDialog.tsx` for destructive operations
- [X] T085 [US5] Add error handling for Schwab API failures in deployment flow

---

## Phase 8: User Story 6 - Full Rebalance (Priority: P2)

**Story Goal**: User can fully rebalance account to match model allocation by selling overweight and buying underweight positions.

**Independent Test Criteria**:
- ✅ Algorithm calculates all sells and buys to reach target allocation
- ✅ Preview shows all proposed trades with commissions
- ✅ Atomic execution: all trades succeed or all fail (no partial rebalances)
- ✅ Trades recorded in audit log with status
- ✅ Performance: Calculation <2s (SC-006)
- ✅ Insufficient liquidity detected and alternative suggested

**Implementation Strategy**:
1. Create rebalance calculator service
2. Implement atomic trade execution with transaction support
3. Write integration tests with atomicity verification
4. Create UI for rebalance preview and execution
5. Add error handling for partial liquidity cases

### Phase 8 Tasks

- [X] T086 [US6] Create rebalance service: `src/backend/services/rebalance.service.ts` with full rebalance calculator
- [X] T087 [US6] [P] Write unit test: `tests/unit/account/rebalance-calculator.test.ts` for rebalance logic (Red-Green-Refactor)
- [X] T088 [US6] Create API endpoint: `src/pages/api/accounts/[id]/rebalance.ts` that calculates and previews rebalance
- [X] T089 [US6] Create API endpoint: `src/pages/api/accounts/[id]/rebalance/execute.ts` that submits rebalance trades atomically
- [X] T090 [US6] [P] Write integration test: `tests/integration/rebalance-flow.test.ts` for acceptance scenarios 1-5 including SC-006 performance and atomicity
- [X] T091 [US6] Create rebalance hook: `src/features/account-management/hooks/useRebalance.ts` managing rebalance state
- [X] T092 [US6] Create rebalance preview component: `src/features/account-management/components/RebalancePreview/RebalancePreview.tsx` showing all trades
- [X] T093 [US6] Add atomic transaction support: `src/backend/utils/transaction.ts` ensuring all trades succeed/fail together
- [X] T094 [US6] Create error recovery for partial failures: detect and suggest alternative rebalance
- [X] T095 [US6] Add liquidity analysis: `src/backend/services/liquidity-analyzer.service.ts` checking if full rebalance is possible
- [X] T096 [US6] Create insufficient liquidity dialog with partial rebalance suggestion

---

## Phase 9: User Story 7 - Historical Backtesting (Priority: P3)

**Story Goal**: User can analyze historical model portfolio performance over time under different rebalance schedules.

**Independent Test Criteria**:
- ✅ Historical ticker prices retrieved or loaded from cache
- ✅ Backtests run on schedule (monthly, quarterly, annual)
- ✅ Performance metrics calculated: return, volatility, max drawdown, Sharpe ratio
- ✅ Multiple schedule results compared in chart
- ✅ Dividends reinvested according to model allocation
- ✅ Performance: 5-year backtest <5s (SC-008)

**Implementation Strategy**:
1. Create historical data service
2. Create backtest engine with simulation logic
3. Create analysis service for metric calculation
4. Write integration tests with performance assertions
5. Create analysis UI with charts and results

### Phase 9 Tasks

- [ ] T097 [US7] Create historical data service: `src/backend/services/historical-data.service.ts` fetching and caching prices from Schwab
- [ ] T098 [US7] Create backtest engine: `src/backend/services/backtest.service.ts` with Monte Carlo simulation
- [ ] T099 [US7] Create analysis service: `src/backend/services/analysis.service.ts` calculating return, volatility, Sharpe, drawdown
- [ ] T100 [US7] [P] Write unit test: `tests/unit/analysis/backtest-engine.test.ts` for simulation logic
- [ ] T101 [US7] [P] Write unit test: `tests/unit/analysis/metrics-calculator.test.ts` for metric calculations
- [ ] T102 [US7] Create API endpoint: `src/pages/api/analysis/backtest.ts` that runs backtest and stores results
- [ ] T103 [US7] Create API endpoint: `src/pages/api/analysis/results.ts` that retrieves cached backtest results
- [ ] T104 [US7] [P] Write integration test: `tests/integration/backtest.test.ts` for acceptance scenarios 1-5 including SC-008 performance
- [ ] T105 [US7] Create analysis hook: `src/features/analysis/hooks/useBacktest.ts` managing backtest state
- [ ] T106 [US7] Create backtest form: `src/features/analysis/components/BacktestForm/BacktestForm.tsx` for date range and rebalance frequency selection
- [ ] T107 [US7] Create results visualization: `src/features/analysis/components/PerformanceChart/PerformanceChart.tsx` with chart comparison

---

## Phase 10: Polish & Cross-Cutting Concerns

**Goals**:
- ✅ Structured JSON logging across all layers
- ✅ Comprehensive error handling with user-friendly messages
- ✅ Audit logging for all user actions and trades
- ✅ Performance monitoring and metrics
- ✅ Security hardening (HTTPS enforcement, secret management)
- ✅ Documentation and deployment preparation

### Phase 10 Tasks

- [ ] T108 Create logger service: `src/backend/utils/logger.ts` with structured JSON logging
- [ ] T109 [P] Create error handler middleware: `src/backend/middleware/error-handler.ts` translating API errors to user-friendly messages
- [ ] T110 [P] Create audit logger utility: `src/backend/utils/audit-logger.ts` recording all actions to audit_log_entry table
- [ ] T111 Implement request logging middleware: `src/backend/middleware/request-logger.ts` for API observability
- [ ] T112 Add HTTPS enforcement: middleware in `src/backend/middleware/https-redirect.ts` for production
- [ ] T113 Create performance monitoring: `src/backend/utils/performance-monitor.ts` tracking API latencies against success criteria (SC-003 through SC-008)
- [ ] T114 Add rate limiting: `src/backend/middleware/rate-limit.ts` preventing API abuse
- [ ] T115 Create deployment configuration: `vercel.json` and environment setup for production deployment

---

## ✅ Acceptance Checklist

### Setup Phase
- [ ] Project initializes without errors: `npm install && npm run build`
- [ ] Development server starts: `npm run dev`
- [ ] TypeScript compilation passes: `npx tsc --noEmit`

### Database Phase
- [ ] All 9 migrations execute: `npm run db:migrate`
- [ ] Database file created: `data/allocatrix.db`
- [ ] Schema verified: All tables present with correct columns

### Testing Phase
- [ ] All unit tests pass: `npm run test:unit`
- [ ] All integration tests pass: `npm run test:integration`
- [ ] All contract tests pass: `npm run test:contract`
- [ ] Coverage ≥80%: `npm run test:coverage`
- [ ] No linting errors: `npm run lint`

### Feature Completeness
- [ ] User Story 1 (OAuth): Can authenticate via Schwab → account linked
- [ ] User Story 2 (Portfolio): Can create and edit model portfolios
- [ ] User Story 3 (Assignment): Can assign model to account
- [ ] User Story 4 (Positions): Can view positions and drift
- [ ] User Story 5 (Deployment): Can deploy cash into underweights
- [ ] User Story 6 (Rebalance): Can execute full rebalance
- [ ] User Story 7 (Backtest): Can run historical backtests

### Performance Criteria (SCs)
- [ ] SC-001: OAuth <2 min ✓
- [ ] SC-002: Portfolio creation <5 min ✓
- [ ] SC-003: Positions load <30s ✓
- [ ] SC-004: Refresh <3s ✓
- [ ] SC-005: Deployment calc <1s ✓
- [ ] SC-006: Rebalance calc <2s ✓
- [ ] SC-007: <5 clicks for operations ✓
- [ ] SC-008: 5yr backtest <5s ✓

### Security Criteria (SCs)
- [ ] SC-009: 100% valid auth tokens ✓
- [ ] SC-010: 100% audit logging ✓
- [ ] SC-011: 99% API success rate (with retries) ✓
- [ ] SC-012: Locked models not editable ✓
- [ ] SC-013: Weight validation prevents invalid models ✓
- [ ] SC-014: Cash reserve protected ✓
- [ ] SC-015: Rebalance trades atomic ✓

### API Documentation
- [ ] Swagger UI accessible: `http://localhost:3000/api/docs`
- [ ] All endpoints documented in OpenAPI specs
- [ ] Contract tests validate all schemas

### Deployment Ready
- [ ] Environment variables documented in `.env.example`
- [ ] Database migrations support production schema
- [ ] Error handling covers all error cases
- [ ] Logging captures audit trail

---

## 📊 Parallel Execution Examples

### Example 1: Two developers can work independently
**Developer A (Phase 3 & 7)**: Implement OAuth (US1) and Cash Deployment (US5)
- Start: Phase 3 (OAuth) - no dependencies
- Mid: Switch to Phase 7 (Cash Deployment) - depends on Phase 5 (complete as prerequisite)

**Developer B (Phase 4 & 6)**: Implement Portfolio CRUD (US2) and Positions/Drift (US4)
- Start: Phase 4 (Portfolio CRUD) - no dependencies
- Mid: Switch to Phase 6 (Positions) - depends on Phase 5 (complete as prerequisite)

**Merge**: Both merge to main after Phase 5, then Phase 8 (Rebalance) combines learnings

### Example 2: Three developers working in parallel
**Developer A**: Phase 3 (OAuth) → Phase 5 (Assignment) → Phase 8 (Rebalance)
**Developer B**: Phase 4 (Portfolio) → Phase 9 (Backtesting)
**Developer C**: Phase 6 (Positions) → Phase 7 (Deployment) → Phase 10 (Polish)

---

## 📝 Implementation Notes

### TDD Workflow for Each Task
1. **Red**: Write test that fails (feature not implemented)
2. **Green**: Implement minimal code to pass test
3. **Refactor**: Improve code quality while keeping test green
4. **Repeat**: Move to next acceptance scenario

### Database Transaction Safety
- Rebalance trades executed within transaction: all succeed or all fail (SC-015)
- Audit log entries created BEFORE trade submission (pending state)
- Updated to executed/failed after Schwab confirms

### Error Recovery
- Transient API errors: retry with exponential backoff
- Permanent failures: user-friendly message + manual retry option
- Partial failures: detailed results per-trade with audit trail

### Performance Optimization
- Position snapshots cached for 5 minutes (SC-004)
- Historical price data cached to disk (SC-008)
- Lazy-load detailed analytics only when needed
- Optimistic UI updates for better UX

### Security Hardening
- All tokens stored encrypted in DB (never in browser)
- HTTP-only session cookies protect auth state
- HTTPS enforced in production
- Rate limiting prevents API abuse
- Environment variables protect secrets

---

## 🎯 Success Definition

Feature is complete when:
1. ✅ All 115 tasks completed
2. ✅ All 7 user stories have passing integration tests
3. ✅ All acceptance criteria (SC-001 through SC-015) validated
4. ✅ Test coverage ≥80%
5. ✅ Zero linting errors
6. ✅ Deployed to staging environment with all features operational
7. ✅ Documentation complete: API guide, data model, architecture

---

**Next Step**: Begin Phase 1 (Setup) and Phase 2 (Foundational) in parallel. Phase 3 (OAuth) can start once Phase 2 is 80% complete.
