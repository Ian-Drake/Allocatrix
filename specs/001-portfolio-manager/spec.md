# Feature Specification: Model Portfolio Account Manager

**Feature Branch**: `001-portfolio-manager`  
**Created**: 2025-11-16  
**Status**: Draft  
**Input**: User description: "Model Portfolio Account Manager - Single-user web application for managing multiple Schwab brokerage accounts using model portfolios with cash deployment and rebalancing features"

## Clarifications

### Session 2025-11-16

- Q: How should deleted entities (portfolios, asset classes) be handled when referenced by active accounts? → A: Soft delete with audit trail (`deleted_at` timestamp). Maintains complete audit history, enables account history recovery, prevents orphaned trades in audit log.
- Q: What are the scalability limits for a single user managing multiple portfolios/accounts? → A: Hard limits: 50 portfolios, 1000 tickers total, 20 accounts. Return HTTP 429 when exceeded, requiring user cleanup before adding more.
- Q: What observability/logging strategy should be implemented? → A: Structured JSON logs (INFO level default), immutable audit log DB table, selective metrics (API latency, error count, token refresh frequency). No distributed tracing.
- Q: How should partial trade failures in batch operations be handled? → A: Partial success allowed. Each trade submitted independently to Schwab, audit log entries created per-trade with status. User sees mixed success list (e.g., "4 succeeded, 1 failed").
- Q: Which data source should provide historical prices for backtesting? → A: Schwab API historical prices. Integrated with existing OAuth, covers all Schwab-tradable securities, no third-party costs, aligns with current tech stack.

---

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
  
  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - Schwab OAuth Account Linking (Priority: P1)

User needs to securely connect their Schwab brokerage account to the application via OAuth 2.0 to begin portfolio management. This is the entry point for all subsequent features.

**Why this priority**: Without account linking, no other features can operate. This is the critical blocking prerequisite for MVP.

**Independent Test**: Can be fully tested by authenticating via Schwab OAuth, verifying token storage, and confirming account list retrieval without requiring any model portfolio or rebalancing logic.

**Acceptance Scenarios**:

1. **Given** user is on the login page, **When** user clicks "Connect Schwab Account", **Then** user is redirected to Schwab's OAuth consent screen and prompted to authorize access
2. **Given** user completes OAuth consent, **When** OAuth callback redirects to the app with authorization code, **Then** app exchanges code for access and refresh tokens securely
3. **Given** tokens are obtained, **When** app calls Schwab account list endpoint, **Then** app retrieves and stores encrypted account list in SQLite
4. **Given** tokens are stored, **When** 25+ minutes pass, **Then** app automatically refreshes the access token server-side before it expires
5. **Given** refresh token expires after 7 days, **When** user attempts any action, **Then** app prompts user to re-authenticate via OAuth

---

### User Story 2 - Model Portfolio Creation & Editing (Priority: P1)

User needs to create and edit model portfolios that define target asset allocations. This enables users to design their investment strategy before applying it to accounts.

**Why this priority**: Model portfolios are the core template for account management. Users must be able to define these before linking them to accounts.

**Independent Test**: Can be fully tested by creating a portfolio, adding asset classes with tickers, validating weight constraints, and viewing saved data—without requiring account linking or Schwab API calls.

**Acceptance Scenarios**:

1. **Given** user is on the Models page, **When** user clicks "Create New Portfolio", **Then** a new Draft portfolio is created with empty asset classes list
2. **Given** user has a Draft portfolio open, **When** user adds an Asset Class (e.g., "US Large Cap Equities"), **Then** Asset Class is added and available for ticker allocation
3. **Given** user has an Asset Class, **When** user adds tickers with percentages (e.g., "AAPL 50%, MSFT 50%"), **Then** tickers are stored and within-class percentages are validated to sum to 100%
4. **Given** user has tickers across multiple Asset Classes, **When** system validates the model, **Then** Asset Class weights are checked to sum to 100%—if valid, model transitions to Valid state
5. **Given** user has a Valid portfolio, **When** user tries to edit it, **Then** portfolio remains editable as long as no account is assigned
6. **Given** user modifies a locked model, **When** user clicks "Clone", **Then** a new Draft portfolio is created with the same structure, and original remains locked

---

### User Story 3 - Account Model Assignment (Priority: P1)

User needs to assign a valid model portfolio to a Schwab account to establish the target allocation for that account.

**Why this priority**: This connects accounts to portfolios and enables drift calculation and rebalancing workflows. Essential for MVP.

**Independent Test**: Can be fully tested by selecting an account, choosing a valid model, and verifying assignment in the database—no actual trades or rebalancing required.

**Acceptance Scenarios**:

1. **Given** user has linked Schwab accounts and created a valid model, **When** user navigates to account detail, **Then** available valid models are shown in dropdown
2. **Given** user selects a model from dropdown, **When** user clicks "Assign Model", **Then** model is assigned to account and model becomes locked
3. **Given** an account has an assigned model, **When** user navigates to account detail, **Then** current assignment is displayed
4. **Given** an account has an assigned model, **When** user selects a different valid model, **Then** reassignment is allowed and previous model remains locked
5. **Given** a model is locked due to account assignment, **When** user attempts to edit that model, **Then** edit is blocked and user is prompted to clone instead

---

### User Story 4 - Account Positions & Drift Display (Priority: P2)

User needs to view current account positions fetched from Schwab and see how they drift from the assigned model's target allocation.

**Why this priority**: Enables users to understand misalignment before taking action. P2 because it's informational; P1 features establish the foundation.

**Independent Test**: Can be fully tested with mock Schwab position data and calculated drift percentages without requiring actual trades or cash deployment.

**Acceptance Scenarios**:

1. **Given** user is viewing an account with assigned model, **When** page loads, **Then** current positions from Schwab are fetched and displayed in a table (symbol, quantity, price, total value)
2. **Given** positions are displayed, **When** assigned model is compared to holdings, **Then** target allocation and current allocation are shown side-by-side with drift percentage
3. **Given** drift is calculated, **When** drift exceeds 5% from target, **Then** ticker is highlighted as "overweight" or "underweight"
4. **Given** account has cash or reserve currency, **When** page displays cash section, **Then** available cash (post-reserves) and reserved amount are shown separately
5. **Given** user is viewing account, **When** user clicks "Refresh Positions", **Then** latest data is fetched from Schwab and drift is recalculated

---

### User Story 5 - Cash Deployment (Priority: P2)

User needs to deploy available cash into underweight tickers according to model allocation to gradually build positions toward target allocation.

**Why this priority**: Enables hands-off cash investing aligned with the model. P2 because cash may not always be available; P1 features enable account setup first.

**Independent Test**: Can be fully tested with provided account cash, calculated underweights, and produced trade recommendations—without requiring execution permission from Schwab.

**Acceptance Scenarios**:

1. **Given** account has available cash and assigned model, **When** user navigates to "Deploy Cash" section, **Then** app calculates target dollar amounts for underweight tickers
2. **Given** underweights and cash are calculated, **When** user reviews trade list, **Then** recommended trades are displayed (symbol, shares to buy, order type) with estimated commission
3. **Given** user reviews recommendations, **When** user clicks "Preview", **Then** projected allocation after trades is shown alongside current allocation
4. **Given** user approves trades, **When** user clicks "Deploy", **Then** trades are submitted to Schwab and recorded in audit log with timestamp
5. **Given** insufficient cash for full deployment, **When** algorithm runs, **Then** cash is allocated proportionally across underweight tickers up to available balance

---

### User Story 6 - Full Rebalance (Priority: P2)

User needs to fully rebalance account positions to match model allocation by selling overweight tickers and buying underweight ones.

**Why this priority**: Rebalancing maintains alignment with model. P2 because it's an advanced action; basic portfolio usage can proceed with P1 features.

**Independent Test**: Can be fully tested with provided positions and model, calculating required sells/buys and producing trade list—without requiring execution.

**Acceptance Scenarios**:

1. **Given** account has assigned model and drifted positions, **When** user clicks "Rebalance", **Then** app calculates sales of overweight tickers and purchases of underweight tickers
2. **Given** rebalance calculations are complete, **When** user reviews trade list preview, **Then** all proposed sells and buys are displayed with quantities and estimated commissions
3. **Given** user approves preview, **When** user clicks "Execute Rebalance", **Then** all trades are submitted to Schwab in a single batch and recorded in audit log
4. **Given** rebalance is executed, **When** user refreshes account positions, **Then** positions converge toward model allocation (subject to Schwab settlement times)
5. **Given** account has insufficient liquidity for rebalance, **When** user attempts rebalance, **Then** system identifies problematic tickers and suggests partial rebalance alternative

---

### User Story 7 - Historical Backtesting (Priority: P3)

User needs to analyze historical model portfolio performance over time under different rebalance schedules to evaluate strategy effectiveness.

**Why this priority**: Backtesting is analytical/optional. P3 because it doesn't affect core portfolio management; core features can be deployed without it.

**Independent Test**: Can be fully tested with historical market data and rebalance algorithms, producing performance metrics without requiring account data.

**Acceptance Scenarios**:

1. **Given** user is on Analysis page, **When** user selects a model and date range, **Then** historical ticker prices are retrieved or loaded from cache
2. **Given** user selects rebalance schedule (monthly, quarterly, annual), **When** system runs backtest, **Then** rebalances occur on schedule and returns are calculated
3. **Given** backtest completes, **When** results are displayed, **Then** total return, annualized return, volatility, max drawdown are shown
4. **Given** multiple rebalance schedules are tested, **When** user compares results, **Then** performance difference between schedules is visualized in chart
5. **Given** backtest includes dividends, **When** system calculates returns, **Then** dividends are reinvested according to model allocation

---

### Edge Cases

- What happens when Schwab API is unavailable? (System displays cached data; operations are queued for retry)
- How does system handle a model with 0% allocation to a particular asset class? (Allowed; positions in that class gradually decline as deployed cash and trades are executed)
- What happens if user attempts to deploy cash but Schwab rejects a trade order? (Order is marked failed in audit log; user is notified; cash remains available for retry)
- How does system handle fractional shares? (Uses Schwab's fractional share capability where available; rounds to whole shares for non-fractional tickers)
- What happens when refresh token expires? (User is redirected to OAuth re-authentication; previously stored account data remains accessible read-only until re-auth)
- What if a ticker in the model is delisted or no longer tradable? (System detects via Schwab API error; user is alerted and can remove ticker or substitute alternative)
- How does cash deployment handle rounding differences? (Remaining cash after rounding is allocated to largest underweight or held for next deployment)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support Schwab OAuth 2.0 authorization_code flow with server-side token refresh (30-minute access tokens, 7-day refresh tokens)
- **FR-002**: System MUST encrypt and securely store Schwab access and refresh tokens in SQLite, never exposing them to the frontend
- **FR-003**: System MUST retrieve and cache list of linked Schwab accounts with encrypted account identifiers
- **FR-004**: System MUST allow user to create Draft model portfolios with Asset Classes and Ticker Allocations
- **FR-005**: System MUST validate model portfolio weights (Asset Class weights and Ticker weights within each class) sum to 100% before transitioning to Valid state
- **FR-006**: System MUST prevent modification of Valid/Locked model portfolios; allow cloning of locked portfolios into new Draft copies
- **FR-007**: System MUST automatically lock a model portfolio when it is assigned to any account
- **FR-008**: System MUST support assignment of any Valid model to any account (reassignments allowed; previous models remain locked)
- **FR-009**: System MUST fetch current positions from Schwab Trader API for any account with assigned model
- **FR-010**: System MUST calculate drift (current allocation vs. target allocation) for each ticker in assigned model
- **FR-011**: System MUST calculate available cash by fetching cash balance from Schwab and subtracting configurable reserve amount
- **FR-012**: System MUST produce cash deployment trade recommendations allocating available cash proportionally to underweight tickers
- **FR-013**: System MUST round cash deployment quantities according to Schwab's fractional share rules and minimize leftover cash
- **FR-014**: System MUST submit cash deployment trades to Schwab via Trader API and record each trade in audit log with status
- **FR-015**: System MUST calculate full rebalance trades (sells of overweight, buys of underweight tickers) to reach model allocation
- **FR-016**: System MUST display rebalance preview before execution showing all proposed trades with estimated commissions
- **FR-017**: System MUST submit rebalance trades to Schwab and atomically record all trades in audit log
- **FR-018**: System MUST support backtesting a model portfolio over historical date range with configurable rebalance frequency
- **FR-019**: System MUST calculate backtest performance metrics (return, volatility, max drawdown, Sharpe ratio) and display results
- **FR-020**: System MUST provide UI navigation with Dashboard, Accounts, Models, Analysis, and Settings sections
- **FR-021**: System MUST log all trades, API calls, and user actions with timestamp and context for auditability
- **FR-022**: System MUST handle Schwab API errors gracefully (timeout, rate limit, network errors) with user-friendly messages and retry options

### Key Entities

- **User**: Single application user (implicit; not stored—OAuth represents user identity)
- **Model Portfolio**: Defines target asset allocation (fields: id, name, description, status={Draft|Valid|Locked}, createdAt, clonedFromModelId)
- **Asset Class**: Reusable investment category (fields: id, name, description)
- **Model Portfolio Asset Class**: Links Asset Class to Model with target weight (fields: id, modelPortfolioId, assetClassId, targetWeightPct)
- **Ticker Allocation**: Individual security within an Asset Class (fields: id, assetClassId, symbol, displayName, targetWeightPctWithinAssetClass)
- **Account**: Schwab brokerage account (fields: id, schwabEncryptedAccountId, nickname, assignedModelPortfolioId, lastSyncedAt)
- **Schwab Token**: Encrypted OAuth tokens (fields: id, accessToken, refreshToken, expiresAt, refreshTokenExpiresAt)
- **Account Snapshot**: Cached account positions for quick display (fields: id, accountId, timestamp, positionsJson)
- **Audit Log Entry**: Record of all trades and actions (fields: id, timestamp, action, details, status={pending|executed|failed})
- **Backtest Result**: Cached backtest results (fields: id, modelPortfolioId, startDate, endDate, rebalanceFrequency, returns, volatility, maxDrawdown)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: User can complete Schwab OAuth authentication and account linking in under 2 minutes from login page to first account connected
- **SC-002**: User can create a valid model portfolio (add 3+ asset classes with 3+ tickers each) in under 5 minutes
- **SC-003**: User can assign a model to an account and view current positions with drift calculations within 30 seconds of page load
- **SC-004**: System retrieves current positions from Schwab and refreshes display within 3 seconds of user request
- **SC-005**: Cash deployment algorithm produces executable trade list for $10k deployment in under 1 second
- **SC-006**: Full rebalance trade list is generated and displayed within 2 seconds
- **SC-007**: User can preview and execute a cash deployment or rebalance with fewer than 5 clicks
- **SC-008**: Backtest for 5-year historical period on a model with 20 tickers completes within 5 seconds
- **SC-009**: 100% of Schwab API calls requiring authentication include valid, non-expired access token (refreshed server-side)
- **SC-010**: 100% of trades submitted have corresponding audit log entries with status and timestamp
- **SC-011**: 99% of API calls to Schwab succeed on first attempt or are retried automatically with exponential backoff
- **SC-012**: Locked models cannot be edited; editing is blocked with user-facing message directing to clone option
- **SC-013**: All model portfolio weight validations prevent invalid models (weights < 99% or > 101%) from transitioning to Valid state
- **SC-014**: Cash deployment respects reserve amount and never deploys cash below configured threshold
- **SC-015**: Rebalance trades are submitted atomically (all succeeds or all fails within a single logical transaction for audit purposes)
