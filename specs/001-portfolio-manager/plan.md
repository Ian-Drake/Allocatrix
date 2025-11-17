# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Model Portfolio Account Manager is a single-user web application for managing multiple Schwab brokerage accounts using reusable model portfolios. The application enables users to define target asset allocations (model portfolios), assign them to Schwab accounts, calculate drift from target allocation, deploy cash to underweight positions, execute full rebalances, and backtest strategies over historical periods. Core technical approach: Next.js full-stack (React frontend + Node.js backend), SQLite persistence, Schwab OAuth 2.0 for secure account linking, server-side token refresh, and comprehensive audit logging for all trades and operations.

## Technical Context

**Language/Version**: Node.js 18+ (backend), React 18+ with TypeScript (frontend) per Constitution  
**Primary Dependencies**: Next.js (full-stack framework), Express.js or API routes (backend), Schwab OAuth 2.0 (authentication), Schwab Trader API (account/position/trading), Vitest + React Testing Library (frontend testing), Jest + Supertest (backend testing)  
**Storage**: SQLite (local persistent database per Constitution Principle III)  
**Testing**: Vitest + React Testing Library (frontend), Jest + Supertest (backend API), contract tests for OpenAPI specs per Constitution Principle IV  
**Target Platform**: Web browser (modern Chrome/Firefox/Safari), HTTP/HTTPS only  
**Project Type**: Web application (frontend + backend following Bulletproof React structure per Constitution Principle I)  
**Performance Goals**: SC-003: positions load in <30s | SC-005: cash deployment calc <1s | SC-006: rebalance calc <2s | SC-008: 5yr backtest <5s  
**Constraints**: SC-009: 100% valid auth tokens | SC-010: 100% trade audit logging | SC-011: 99% Schwab API success rate | SC-012/SC-013/SC-014/SC-015: validation/safety gates  
**Scale/Scope**: Single user, 2-10 Schwab accounts, 3-20 asset classes per portfolio, 500+ tickers (Schwab-supported), 7+ years historical data for backtesting

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Bulletproof React Architecture** | ✅ COMPLIANT | Frontend uses Bulletproof React with feature modules (portfolio-management, account-management, analysis). Services abstract Schwab API calls. Clear separation of concerns: components render, services fetch data. |
| **II. Test-First Development (NON-NEGOTIABLE)** | ✅ COMPLIANT | TDD enforced: tests written before implementation for all acceptance scenarios (User Stories 1-7). Red-Green-Refactor workflow applied to each story. CI/CD pipeline includes all test suites. |
| **III. Database-Driven Backend** | ✅ COMPLIANT | SQLite persistent layer per spec requirements (FR-002: token storage, FR-003: account cache, FR-021: audit logging). All data uses SQLite. Migration scripts support schema versioning. Transactions handle multi-step operations (trades, rebalances). |
| **IV. API Contract Testing** | ✅ COMPLIANT | All Schwab OAuth endpoints and portfolio APIs include OpenAPI specs. Contract tests verify schemas against actual responses. Integration tests validate flows (auth → accounts → positions → trades). Breaking changes require versioning. |
| **V. Security & Authentication** | ✅ COMPLIANT | Schwab OAuth 2.0 server-side token refresh (30-min access, 7-day refresh tokens per Schwab limits). Tokens stored encrypted in SQLite (never exposed to frontend). HTTPS required. Environment variables for secrets. FR-001, FR-002 enforce constraints. |

**GATE EVALUATION**: PASS - All five core principles are satisfied. No violations. Proceeding to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/001-portfolio-manager/
├── spec.md              # Feature specification (user stories, requirements)
├── plan.md              # This file (implementation plan from /speckit.plan)
├── research.md          # Phase 0 output: research findings, decisions, rationale
├── data-model.md        # Phase 1 output: entities, relationships, validation rules
├── quickstart.md        # Phase 1 output: developer getting started guide
├── contracts/           # Phase 1 output: OpenAPI/REST API specifications
│   ├── portfolio-apis.openapi.yaml
│   ├── account-apis.openapi.yaml
│   ├── auth-apis.openapi.yaml
│   └── analysis-apis.openapi.yaml
├── checklists/
│   └── requirements.md  # Acceptance criteria checklist
└── tasks.md             # Phase 2 output: detailed implementation tasks (CREATED BY /speckit.tasks)
```

### Source Code (repository root)

**Selected Structure**: Option 2 - Web application (Next.js full-stack) with Bulletproof React frontend

```text
allocatrix/
├── src/
│   ├── pages/
│   │   ├── api/                        # Backend API routes
│   │   │   ├── auth/
│   │   │   │   ├── oauth-callback.ts
│   │   │   │   └── refresh-token.ts
│   │   │   ├── portfolios/
│   │   │   │   ├── create.ts
│   │   │   │   ├── [id].ts
│   │   │   │   └── validate.ts
│   │   │   ├── accounts/
│   │   │   │   ├── list.ts
│   │   │   │   ├── [id]/
│   │   │   │   │   ├── positions.ts
│   │   │   │   │   ├── drift.ts
│   │   │   │   │   ├── deploy-cash.ts
│   │   │   │   │   └── rebalance.ts
│   │   │   ├── analysis/
│   │   │   │   └── backtest.ts
│   │   │   └── audit-log.ts
│   │   ├── _app.tsx
│   │   ├── _document.tsx
│   │   ├── index.tsx                  # Dashboard page
│   │   ├── login.tsx                  # OAuth login flow
│   │   ├── portfolios/
│   │   │   ├── index.tsx              # List portfolios
│   │   │   └── [id].tsx               # Edit/view portfolio
│   │   ├── accounts/
│   │   │   ├── index.tsx              # List accounts
│   │   │   └── [id].tsx               # Account detail with positions/drift
│   │   └── analysis.tsx               # Backtesting interface
│   │
│   ├── features/
│   │   ├── portfolio-management/      # Bulletproof React feature module
│   │   │   ├── pages/
│   │   │   │   ├── PortfolioListPage.tsx
│   │   │   │   └── PortfolioEditPage.tsx
│   │   │   ├── components/
│   │   │   │   ├── PortfolioForm/
│   │   │   │   ├── AssetClassEditor/
│   │   │   │   ├── TickerAllocator/
│   │   │   │   └── ModelPreview/
│   │   │   ├── hooks/
│   │   │   │   ├── usePortfolioModel.ts
│   │   │   │   └── usePortfolioValidation.ts
│   │   │   ├── services/
│   │   │   │   ├── portfolio.service.ts
│   │   │   │   └── portfolio-api.service.ts
│   │   │   ├── types/
│   │   │   │   └── portfolio.types.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── account-management/
│   │   │   ├── pages/
│   │   │   │   ├── AccountListPage.tsx
│   │   │   │   └── AccountDetailPage.tsx
│   │   │   ├── components/
│   │   │   │   ├── AccountCard/
│   │   │   │   ├── PositionsTable/
│   │   │   │   ├── DriftDisplay/
│   │   │   │   ├── CashDeploymentWidget/
│   │   │   │   └── RebalancePreview/
│   │   │   ├── hooks/
│   │   │   │   ├── useAccountPositions.ts
│   │   │   │   ├── useAccountDrift.ts
│   │   │   │   ├── useCashDeployment.ts
│   │   │   │   └── useRebalance.ts
│   │   │   ├── services/
│   │   │   │   ├── account.service.ts
│   │   │   │   ├── positions.service.ts
│   │   │   │   ├── drift.service.ts
│   │   │   │   └── trades.service.ts
│   │   │   ├── types/
│   │   │   │   └── account.types.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── analysis/
│   │   │   ├── pages/
│   │   │   │   └── AnalysisPage.tsx
│   │   │   ├── components/
│   │   │   │   ├── BacktestForm/
│   │   │   │   ├── PerformanceChart/
│   │   │   │   └── ResultsTable/
│   │   │   ├── hooks/
│   │   │   │   └── useBacktest.ts
│   │   │   ├── services/
│   │   │   │   └── analysis.service.ts
│   │   │   ├── types/
│   │   │   │   └── analysis.types.ts
│   │   │   └── index.ts
│   │   │
│   │   └── auth/
│   │       ├── components/
│   │       │   └── LoginButton/
│   │       ├── hooks/
│   │       │   └── useAuth.ts
│   │       ├── services/
│   │       │   └── auth.service.ts
│   │       ├── types/
│   │       │   └── auth.types.ts
│   │       └── index.ts
│   │
│   ├── shared/
│   │   ├── components/
│   │   │   ├── Layout/
│   │   │   ├── Navigation/
│   │   │   ├── LoadingSpinner/
│   │   │   └── ErrorBoundary/
│   │   ├── hooks/
│   │   │   ├── useAsync.ts
│   │   │   └── useLocalStorage.ts
│   │   ├── services/
│   │   │   ├── api-client.service.ts
│   │   │   └── error-handler.service.ts
│   │   ├── types/
│   │   │   └── common.types.ts
│   │   ├── utils/
│   │   │   ├── format-currency.ts
│   │   │   ├── calculate-percentage.ts
│   │   │   └── validation.ts
│   │   └── constants/
│   │       └── api-endpoints.ts
│   │
│   ├── backend/
│   │   ├── controllers/
│   │   │   ├── portfolio-controller.ts
│   │   │   ├── account-controller.ts
│   │   │   ├── auth-controller.ts
│   │   │   ├── trades-controller.ts
│   │   │   └── analysis-controller.ts
│   │   ├── services/
│   │   │   ├── portfolio.service.ts
│   │   │   ├── account.service.ts
│   │   │   ├── schwab-api.service.ts
│   │   │   ├── token-manager.service.ts
│   │   │   ├── trades.service.ts
│   │   │   └── backtest.service.ts
│   │   ├── models/
│   │   │   ├── Portfolio.ts
│   │   │   ├── Account.ts
│   │   │   └── Trade.ts
│   │   ├── middleware/
│   │   │   ├── auth-guard.ts
│   │   │   ├── error-handler.ts
│   │   │   └── request-logger.ts
│   │   ├── db/
│   │   │   ├── schema.sql
│   │   │   ├── migrations/
│   │   │   │   ├── 001-create-model-portfolios.ts
│   │   │   │   ├── 002-create-asset-classes.ts
│   │   │   │   ├── 003-create-ticker-allocations.ts
│   │   │   │   ├── 004-create-accounts.ts
│   │   │   │   ├── 005-create-schwab-tokens.ts
│   │   │   │   ├── 006-create-account-snapshots.ts
│   │   │   │   └── 007-create-audit-log.ts
│   │   │   ├── database.ts
│   │   │   └── queries.ts
│   │   ├── utils/
│   │   │   ├── encryption.ts
│   │   │   ├── token-refresh.ts
│   │   │   └── trade-execution.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   └── constants/
│   │       └── config.ts
│   │
│   ├── config/
│   │   ├── app-config.ts
│   │   └── schwab-config.ts
│   │
│   └── styles/
│       ├── globals.css
│       └── variables.css
│
├── tests/
│   ├── unit/
│   │   ├── portfolio/
│   │   │   ├── portfolio.service.test.ts
│   │   │   └── portfolio.validation.test.ts
│   │   ├── account/
│   │   │   ├── drift-calculator.test.ts
│   │   │   └── cash-deployment.test.ts
│   │   └── components/
│   │       └── (component unit tests)
│   ├── integration/
│   │   ├── oauth-flow.test.ts
│   │   ├── portfolio-assignment.test.ts
│   │   ├── cash-deployment-flow.test.ts
│   │   ├── rebalance-flow.test.ts
│   │   └── backtest-flow.test.ts
│   ├── contract/
│   │   ├── portfolio-contract.test.ts
│   │   ├── account-contract.test.ts
│   │   ├── auth-contract.test.ts
│   │   └── trades-contract.test.ts
│   └── fixtures/
│       ├── mock-schwab-responses.ts
│       ├── test-portfolios.ts
│       └── test-accounts.ts
│
├── docs/
│   ├── architecture.md
│   ├── database-schema.md
│   ├── api-guide.md
│   └── deployment.md
│
├── data/
│   └── allocatrix.db                  # SQLite database file
│
├── .env.local (gitignored)
├── .env.example
├── .eslintrc.json
├── .prettierrc.json
├── tsconfig.json
├── next.config.js
├── jest.config.js
├── vitest.config.ts
├── package.json
├── package-lock.json
├── README.md
└── CHANGELOG.md
```

**Structure Decision**: Next.js full-stack with Bulletproof React frontend. Features are organized as self-contained modules (portfolio-management, account-management, analysis, auth) with pages, components, hooks, services, and types. Backend uses controllers/services/models/db layers for clean separation. SQLite database stored in `/data/`. Follows Constitution naming conventions (kebab-case folders, PascalCase components, camelCase functions).

## Complexity Tracking

> **No Constitution violations identified. No complexity trade-offs required.**

All five core principles from the Allocatrix Constitution are satisfied by the Phase 1 design:

| Principle | Status | Verification |
|-----------|--------|--------------|
| **I. Bulletproof React Architecture** | ✅ PASS | Features organized as modules: `portfolio-management/`, `account-management/`, `analysis/`, `auth/`. Each has pages/, components/, hooks/, services/, types/ structure. API layer abstraction via services. Clear separation: components render, services fetch data. |
| **II. Test-First Development** | ✅ PASS | TDD workflow established in quickstart.md. Each user story (1-7) maps to integration tests. Red-Green-Refactor examples provided. Contract tests validate OpenAPI schemas. Unit test structure defined. |
| **III. Database-Driven Backend** | ✅ PASS | SQLite selected per research.md rationale. 9 migration scripts defined in data-model.md. Transactions support multi-step ops (rebalance trades). Audit trail: audit_log_entry table tracks all mutations. Connection pooling configured. |
| **IV. API Contract Testing** | ✅ PASS | OpenAPI 3.0 specs generated for 4 API domains (auth, portfolio, account, analysis). Contract tests structure defined (tests/contract/). Validation schemas defined in openapi files. Swagger UI integration planned. |
| **V. Security & Authentication** | ✅ PASS | Schwab OAuth 2.0 with server-side token refresh (30-min access, 7-day refresh per Schwab limits). Tokens encrypted AES-256, stored in SQLite, never exposed to frontend. HTTP-only session cookies. HTTPS-only enforcement. Environment variables for secrets. |

---

## Phase 1 Complete: All Design Artifacts Finalized

**Deliverables**:
- ✅ `plan.md` - Implementation plan with technical context, constitution check, and project structure
- ✅ `research.md` - Phase 0 research with decisions, rationale, and alternatives for 8 key technology areas
- ✅ `data-model.md` - Complete database schema with 9 entities, relationships, validation rules, and migration strategy
- ✅ `contracts/*.openapi.yaml` - 4 OpenAPI 3.0 specification files covering all 20 FR requirements
- ✅ `quickstart.md` - Developer getting started guide with setup, workflows, testing strategy, and debugging
- ✅ Agent context updated for GitHub Copilot with technology stack

**Constitution Re-evaluation**: PASS - No violations. All design decisions comply with five core principles.

**Next Step**: Phase 2 (not created by /speckit.plan) generates detailed task list via `/speckit.tasks` command for implementation execution.
