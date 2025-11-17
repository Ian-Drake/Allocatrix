# Research: Model Portfolio Account Manager

**Date**: 2025-11-16  
**Feature**: 001-portfolio-manager  
**Scope**: Clarify technical choices, best practices, and key architectural decisions

## 1. Technology Stack Selection

### Decision: Next.js 14+ (Full-Stack) with Bulletproof React

**Rationale**:
- Allocatrix Constitution mandates React 18+ with Bulletproof React structure for all frontends
- Next.js provides integrated backend (API routes) eliminating need for separate server deployment
- SSR/SSG capabilities improve performance for dashboard and analysis pages
- Built-in TypeScript support aligns with Constitution requirements
- Same framework handles both frontend and backend, reducing cognitive load

**Alternatives Considered**:
- Separate Frontend (CRA) + Backend (Express) - Rejected: More complex deployment, higher ops burden, duplicates routing logic
- Remix.run - Rejected: Less mature ecosystem, smaller community than Next.js for this use case
- Pure Express backend - Rejected: Violates Constitution mandate for React frontend with Bulletproof structure

**Implementation Reference**: Use Next.js 14 (LTS), Pages Router (vs App Router) for API routes familiarity, TypeScript strict mode

---

### Decision: Schwab OAuth 2.0 with Server-Side Token Refresh

**Rationale**:
- Spec mandates Schwab OAuth 2.0 authorization_code flow (FR-001)
- 30-minute access tokens + 7-day refresh tokens are Schwab's limits
- Server-side token refresh prevents tokens from ever reaching frontend (security best practice, Constitution Principle V)
- Session-based architecture (HTTP-only cookies) further protects credentials
- Automatic refresh before expiry prevents mid-operation token failures

**Alternatives Considered**:
- Frontend-handled refresh - Rejected: Violates FR-002 (tokens never exposed to frontend), increases XSS attack surface
- Client credentials flow - Rejected: Requires user API keys, incompatible with Schwab consumer OAuth
- PKCE flow without backend refresh - Rejected: Exposes access tokens to browser storage, violates security requirement

**Implementation Reference**: 
- Backend creates HTTP-only session cookie after OAuth callback
- Token manager service refreshes 5 minutes before expiry
- Middleware validates token on every API call
- Refresh token expiry triggers user re-authentication

---

### Decision: SQLite (Local File Database)

**Rationale**:
- Constitution Principle III mandates SQLite for persistence
- Single-user application does not require distributed/networked database
- SQLite supports transactions, migrations, and connection pooling
- File-based simplifies deployment: no separate database service needed
- Encrypt/decrypt at application layer for sensitive data (tokens, account IDs)

**Alternatives Considered**:
- PostgreSQL - Rejected: Overkill for single-user app, violates Constitution requirement
- MongoDB - Rejected: Violates Constitution requirement (SQL-based databases mandated)
- In-memory store - Rejected: No persistence across application restarts

**Implementation Reference**:
- Database file: `/data/allocatrix.db`
- Migration scripts: `/src/backend/db/migrations/` with sequential numbering
- Encryption: AES-256 for sensitive columns (tokens, account IDs)
- Connection pooling: sqlite3 with connection pool limits to prevent resource exhaustion

---

### Decision: Vitest + React Testing Library (Frontend) + Jest + Supertest (Backend API)

**Rationale**:
- Constitution Principle II mandates test-first development (TDD non-negotiable)
- Vitest is faster than Jest for unit tests (ESM-first), integrates with Vite
- React Testing Library encourages testing user interactions (not implementation details)
- Jest remains standard for backend API testing with excellent matchers and mocking
- Supertest simplifies HTTP assertion testing for API endpoints

**Alternatives Considered**:
- Playwright/Cypress for E2E - Not rejected, but Phase 1 focuses on unit/integration; E2E added later
- Mocha + Chai - Rejected: Jest/Vitest have superior ecosystem and debugging tools
- Manual testing - Rejected: Non-negotiable per Constitution

**Implementation Reference**:
- Frontend test setup: `vitest.config.ts` with React/TypeScript support
- Backend test setup: `jest.config.js` with Node environment
- Coverage threshold: 80% minimum for new modules
- Tests co-located with source: `[name].test.tsx` pattern

---

### Decision: OpenAPI 3.0 + Swagger for API Contracts

**Rationale**:
- Constitution Principle IV requires API contract tests
- OpenAPI 3.0 is industry standard for REST API specification
- Swagger UI enables interactive API documentation
- Contract tests validate schemas against actual responses
- Automated contract generation from code maintains single source of truth

**Alternatives Considered**:
- GraphQL schema - Rejected: REST is simpler for this feature's use cases, spec requires REST patterns
- Protocol Buffers - Rejected: Overkill for HTTP-based API, not idiomatic for Node.js
- Hand-written contracts - Rejected: Drift from implementation, hard to maintain

**Implementation Reference**:
- Contract files: `/specs/001-portfolio-manager/contracts/*.openapi.yaml`
- Generated from `@apidevtools/swagger-parser` + JSDoc annotations
- Contract tests: `tests/contract/*.test.ts` using `openapi-backend` library
- Swagger UI served at `/api/docs`

---

### Decision: Zustand for State Management (Frontend)

**Rationale**:
- Bulletproof React recommends lightweight state management
- Zustand is minimal (2KB), TypeScript-first, Redux DevTools compatible
- Redux would be overkill for this feature's state complexity (portfolios, accounts, UI state)
- Context API + Zustand hybrid: Context for auth (rarely changes), Zustand for portfolio/account data (frequent updates)
- Easy to reason about: stores are plain functions, reducers unnecessary

**Alternatives Considered**:
- Redux - Rejected: Excessive boilerplate for feature's complexity level
- Context API only - Rejected: Performance issues with frequent re-renders from portfolio/position updates
- MobX - Rejected: Less mainstream in React community, less debugging tooling

**Implementation Reference**:
- Store files: `src/features/[feature]/services/[feature].store.ts`
- Actions are async thunks integrated with services
- DevTools integration for debugging

---

## 2. API & Integration Patterns

### Decision: Schwab Trader API Integration with Request Retry & Circuit Breaker

**Rationale**:
- Spec requires 99% API success rate (SC-011) with graceful error handling (FR-022)
- Schwab APIs have rate limits and occasional transient failures
- Circuit breaker pattern prevents cascading failures (if Schwab is down, don't hammer it)
- Exponential backoff reduces load during outages
- Cached responses enable read-only operations if API is temporarily unavailable (edge case handling)

**Alternatives Considered**:
- Naive retry loop - Rejected: No backoff, can overwhelm rate limits
- Fail-fast without retry - Rejected: Cannot meet 99% success requirement
- Local mock data always - Rejected: Data becomes stale, defeats purpose

**Implementation Reference**:
- `SchwabApiService` with built-in retry logic
- Exponential backoff: [100ms, 200ms, 400ms, 800ms, 1600ms] with jitter
- Circuit breaker: 5 consecutive failures → reject new requests for 60s
- Cache strategy: Positions cached for 5min, account list cached for 1h

---

### Decision: Audit Logging for All Trade Operations

**Rationale**:
- Spec mandates audit trail (FR-021) with timestamp and context
- All user actions (cash deployment, rebalance) submitted to Schwab must be logged
- Enables debugging and compliance verification
- Tracks which trades succeeded vs. failed for user accountability

**Alternatives Considered**:
- Application logs only - Rejected: Hard to query, no structured data
- Database table only - Rejected: No log aggregation, hard to debug
- External service (CloudWatch/Datadog) - Not rejected but Phase 1 uses database, can add later

**Implementation Reference**:
- Table: `audit_log_entry` with columns: id, timestamp, action, details (JSON), status, user_id (implicit single-user)
- Entry created BEFORE trade submission (pending state)
- Updated to executed/failed after Schwab response
- Queryable by date range and action type

---

## 3. Security Considerations

### Decision: AES-256 Encryption for Sensitive Database Columns

**Rationale**:
- Schwab tokens must never be stored in plaintext (FR-002)
- Encrypted account IDs prevent casual database inspection
- Encryption key stored in environment variable (never committed to repo)
- Decrypt only when needed (e.g., making Schwab API call)

**Alternatives Considered**:
- Plaintext storage - Rejected: Violates Constitution Principle V (security), violates FR-002
- Database-level encryption (SQLite pragma) - Rejected: Key management same problem, no field-level granularity
- Hashing (one-way) - Rejected: Tokens need to be decrypted to use

**Implementation Reference**:
- Encryption utility: `src/backend/utils/encryption.ts` using `crypto` module
- Key: `ENCRYPTION_KEY` environment variable (32 bytes for AES-256)
- Encrypt on write: token/account ID before SQL INSERT
- Decrypt on read: when constructing Schwab API requests

---

### Decision: HTTPS-Only API Communication + Environment Variables for Secrets

**Rationale**:
- All API calls to Schwab MUST use HTTPS (Constitution Principle V)
- Secrets (client ID, secret, encryption key) in environment variables, never hardcoded
- `.env.local` gitignored to prevent accidental commit
- `.env.example` provided with placeholder values

**Alternatives Considered**:
- Hardcoded secrets - Rejected: Security nightmare, violates all best practices
- Secrets in code comments - Rejected: Same problem
- AWS Secrets Manager - Not rejected but overkill for single-user local app

**Implementation Reference**:
- Enforce HTTPS in Next.js: middleware redirects HTTP → HTTPS
- Environment loading: `next/config` or `dotenv` for local dev
- Deployment: environment variables set via hosting platform (Vercel, Railway, etc.)

---

## 4. Database Design Patterns

### Decision: Normalized Schema with Audit Trail + Snapshot Caching

**Rationale**:
- Functional requirements specify multiple entities (portfolios, accounts, tickers, trades)
- Normalized schema (separate tables) enables referential integrity
- Audit log tracks all mutations (who did what, when)
- Account snapshot table caches Schwab position data to reduce API calls
- Atomic transaction support for multi-step operations (e.g., rebalance)

**Alternatives Considered**:
- Denormalized schema (one big table) - Rejected: Painful for portfolio/account updates, violates normalization principles
- Event sourcing - Rejected: Overkill for feature's complexity, harder to query current state
- No audit trail - Rejected: Violates FR-021

**Implementation Reference**:
- Migration files create tables incrementally (7 migrations total)
- Foreign key constraints enabled
- Indexes on frequently-queried columns (account_id, portfolio_id, timestamp)
- Transactions used for batch operations (all trades succeed or all rollback)

---

### Decision: Portfolio State Machine (Draft → Valid → Locked)

**Rationale**:
- Spec requirements define three portfolio states with specific transitions (FR-004 to FR-008)
- Database enforces valid state transitions via triggers/checks
- Prevents accidental modification of locked portfolios
- Clear audit trail of state changes

**Alternatives Considered**:
- No state tracking - Rejected: Hard to enforce "can't edit when locked"
- Soft delete + archiving - Rejected: State machine more explicit and enforceable
- Application-level checks only - Rejected: Database-level checks provide safety

**Implementation Reference**:
- Table column: `status TEXT CHECK(status IN ('Draft', 'Valid', 'Locked'))`
- Application validates state transitions before UPDATE
- Trigger prevents modification of non-Draft portfolios
- State transition only valid after weight validation passes

---

## 5. Performance & Scalability

### Decision: Position Caching + Lazy Loading for Account Details

**Rationale**:
- Spec requires positions to load in <30s (SC-003), refresh in <3s (SC-004)
- Schwab API calls are slowest bottleneck (~1-2s per call)
- Cache Schwab positions for 5 minutes reduces API load
- Lazy-load detailed analytics only when user navigates to that section
- Optimistic UI updates (show pending trades immediately, confirm later)

**Alternatives Considered**:
- Real-time streaming - Rejected: Schwab API doesn't support WebSocket, would require polling
- No caching - Rejected: Cannot meet SC-003/SC-004 requirements
- Cache everything forever - Rejected: Stale data, unacceptable drift calculations

**Implementation Reference**:
- Account snapshot table stores positions JSON + timestamp
- Service checks cache before hitting Schwab API
- Cache invalidation: manual refresh button OR auto-refresh after 5min
- UI shows "last updated: X seconds ago" indicator

---

### Decision: Backtest Computation with Historical Data Cache

**Rationale**:
- Spec requires 5-year backtest to complete in <5s (SC-008)
- Historical ticker prices are expensive to fetch repeatedly
- Cache daily OHLC data to disk after first fetch
- Backtest algorithm runs entirely on cached data (fast)
- Lazy-load historical data on-demand (user doesn't wait for full dataset upfront)

**Alternatives Considered**:
- Always fetch historical data from Schwab - Rejected: Too slow, violates SC-008
- Pre-compute all backtests - Rejected: Impossible to pre-compute all model/date/frequency combinations
- Hardcode historical data - Rejected: Becomes stale, not maintainable

**Implementation Reference**:
- Cache file: `/data/historical-prices-cache.json` (keyed by symbol + date range)
- Fetch strategy: Lazy-load ticker prices as user adds them to portfolio
- Backtest service loads entire date range into memory, runs monte carlo/rebalance simulation
- Results cached in database (table: `backtest_result`)

---

## 6. Error Handling & User Experience

### Decision: Graceful Degradation for Schwab API Failures

**Rationale**:
- FR-022 requires handling Schwab API errors gracefully
- Edge cases: timeouts, rate limits, network errors, account not found
- User sees clear error message + retry/fallback option
- Application continues functioning with cached data (read-only mode)

**Alternatives Considered**:
- Show generic "error occurred" - Rejected: Not helpful to user
- Crash application - Rejected: Poor UX, violates Constitution spirit
- Ignore errors - Rejected: Users won't know if their action succeeded

**Implementation Reference**:
- Error handler middleware translates Schwab API errors to user-friendly messages
- Retry button offered for transient errors
- Cached data shown with "stale" indicator if API unavailable
- Trade operations queued + retried if network recovers

---

### Decision: Confirmation Dialogs for Destructive Operations

**Rationale**:
- Rebalance and cash deployment are expensive operations (real trades submitted to Schwab)
- Spec requires preview before execution (FR-016)
- Confirmation prevents accidental trades (good UX, reduces support burden)

**Alternatives Considered**:
- No confirmation - Rejected: User might fat-finger rebalance
- Confirmation only - Rejected: Spec explicitly requires preview (FR-016)

**Implementation Reference**:
- Preview modal shows all proposed trades (symbol, quantity, order type, commission)
- Projected allocation after trades shown side-by-side with current allocation
- User must click "Confirm" button to proceed
- Trade submitted only after confirmation

---

## 7. Testing Strategy

### Decision: TDD with Red-Green-Refactor for All User Stories

**Rationale**:
- Constitution Principle II mandates TDD (non-negotiable)
- Each user story has acceptance scenarios that become tests
- Test failures clarify requirements before implementation
- Refactoring improves code quality while tests stay green

**Alternatives Considered**:
- BDD (Behavior-Driven Development) - Not rejected but TDD sufficient; BDD added later for stakeholder acceptance tests
- Manual testing then tests - Rejected: Violates Constitution mandate
- No tests - Rejected: Non-negotiable per Constitution

**Implementation Reference**:
- User stories 1-7 each have 5+ acceptance scenarios → 5+ tests each
- Tests written in Vitest (frontend components) and Jest (backend services)
- Red phase: test fails with "not implemented" error
- Green phase: minimal implementation to pass test
- Refactor phase: improve code quality, ensure all tests pass

---

### Decision: Contract Tests for OpenAPI Schemas + Integration Tests for User Flows

**Rationale**:
- Constitution Principle IV requires contract tests
- Contract tests validate API responses match OpenAPI spec
- Integration tests verify multi-step flows (OAuth → accounts → positions → trades)
- Both catch breaking changes early

**Alternatives Considered**:
- Unit tests only - Rejected: Doesn't catch integration issues, violates Constitution
- E2E tests only - Rejected: Slow, fragile; unit/integration tests faster feedback

**Implementation Reference**:
- Contract tests: `tests/contract/*.test.ts` using `openapi-backend` validation
- Integration tests: `tests/integration/*.test.ts` using Supertest for API flows
- Example: `oauth-flow.test.ts` tests full auth flow (callback → token storage → account fetch)

---

## 8. Deployment & Operations

### Decision: Next.js Deployed to Vercel (or Railway/Railway with SQLite File)

**Rationale**:
- Next.js is deployed most easily to Vercel (creator/maintainer)
- SQLite file can be persisted using Vercel KV or mounted volume on Railway/Railway
- Single-user application doesn't require complex infrastructure
- Easy CI/CD integration with GitHub

**Alternatives Considered**:
- Docker + Kubernetes - Rejected: Overkill complexity for single-user app
- Lambda + API Gateway - Rejected: SQLite doesn't work well (ephemeral filesystem)
- Self-hosted VPS - Rejected: More operational burden

**Implementation Reference**:
- `vercel.json` configuration file
- SQLite file stored in `/data/` persisted via volume mount
- Environment variables configured in platform
- GitHub → Vercel auto-deploy on push to main

---

## Summary: All Clarifications Resolved

| Item | Status | Decision |
|------|--------|----------|
| Frontend framework | ✅ RESOLVED | React 18+ with Next.js 14 (Bulletproof React structure) |
| Backend framework | ✅ RESOLVED | Next.js API routes + Express-style services |
| Authentication | ✅ RESOLVED | Schwab OAuth 2.0 with server-side token refresh |
| Database | ✅ RESOLVED | SQLite with AES-256 encryption for sensitive data |
| State management | ✅ RESOLVED | Zustand + Context API (auth) |
| Testing | ✅ RESOLVED | Vitest + React Testing Library (frontend), Jest + Supertest (backend) |
| API contracts | ✅ RESOLVED | OpenAPI 3.0 with Swagger UI + contract tests |
| Error handling | ✅ RESOLVED | Graceful degradation with retry logic and user-friendly messages |
| Performance | ✅ RESOLVED | Caching (positions 5min, backtest results), lazy loading, preview-then-confirm |
| Security | ✅ RESOLVED | HTTPS-only, environment variables, AES-256 encryption, HTTP-only cookies |
| Deployment | ✅ RESOLVED | Vercel (or Railway) with persistent SQLite volume |

**Phase 0 Complete**: All NEEDS CLARIFICATION items resolved. Ready for Phase 1 design.
