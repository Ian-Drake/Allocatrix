# Data Model: Model Portfolio Account Manager

**Date**: 2025-11-16  
**Feature**: 001-portfolio-manager  
**Scope**: Database schema, entities, relationships, validation rules, and state machines

---

## Entity Relationship Diagram (Logical)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          MODEL PORTFOLIO (Master)                            │
│  id | name | description | status (Draft|Valid|Locked) | clonedFromModelId  │
│      └──────────────────────────────────────────┬─────────────────────────┘  │
│                                                  │                             │
│  1:N ─────────────────────────────────────────────────┐                      │
│                                                        │                      │
├──────────────────────────────────────────────────┐   ┌────────────────────┐ │
│ MODEL_PORTFOLIO_ASSET_CLASS (Junction)           │   │ ASSET_CLASS        │ │
│ id | modelPortfolioId | assetClassId             │──→│ (Reference)        │ │
│     | targetWeightPct  | createdAt               │   │ id | name         │ │
└──────────────────────────────────────────────────┘   └────────────────────┘ │
         │                                          │
         │ 1:N ◄───────────────────────┤
         │
├────────────────────────────────────────┐
│ TICKER_ALLOCATION                      │
│ id | assetClassId | symbol             │
│    | displayName  | targetWeightPct    │
│    | withinAssetClass                  │
└────────────────────────────────────────┘
         │
         │ N:1 (implicit reference)
         │
└─ Reference only; actual ticker master data from Schwab
```

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ACCOUNT (Schwab Link)                           │
│ id | schwabEncryptedAccountId | nickname | assignedModelPortfolioId        │
│    | lastSyncedAt | createdAt                                               │
└──────────────────────────┬──────────────────────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    1:1  │ (optional)  1:N │                 │
         │                 │                 │
    ┌────────────┐  ┌─────────────────┐  ┌─────────────────────┐
    │SCHWAB      │  │ACCOUNT_SNAPSHOT │  │AUDIT_LOG_ENTRY      │
    │_TOKEN      │  │(Cached Positions)│  │(Trade History)      │
    │id          │  │id               │  │id                   │
    │accessToken │  │accountId        │  │accountId(nullable)  │
    │refreshToken│  │timestamp        │  │timestamp            │
    │expiresAt   │  │positionsJson    │  │action               │
    │refresh...  │  │structuredData   │  │details (JSON)       │
    │ExpiresAt   │  └─────────────────┘  │status(pending|exe...)
    └────────────┘                        │userId (implicit)    │
                                          └─────────────────────┘
```

---

## Entities & Attributes

### 1. Model Portfolio
**Purpose**: Template for target asset allocation. Assigned to multiple accounts (locked when assigned).

| Field | Type | Constraint | Notes |
|-------|------|-----------|-------|
| `id` | TEXT | PK, UUID | Unique identifier |
| `name` | TEXT | NOT NULL, UNIQUE | e.g., "Growth Portfolio", "Balanced Income" |
| `description` | TEXT | Nullable | User-provided details |
| `status` | TEXT | CHECK(Draft\|Valid\|Locked) | State machine: Draft → Valid → Locked |
| `createdAt` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Immutable |
| `updatedAt` | DATETIME | AUTO-UPDATE | Tracks last modification |
| `clonedFromModelId` | TEXT | FK → model_portfolio, Nullable | If cloned, references original |

**State Machine**:
- **Draft**: Editable. Asset classes and tickers can be added/modified. Weights can be any value.
- **Valid**: Weights validated (sum to 100% ±1% tolerance). Editable until assigned to account.
- **Locked**: Assigned to at least one account. Cannot be edited; must be cloned to modify.

**Validation Rules**:
- Draft → Valid: All asset classes must have tickers; total weight = 100% ±1%
- Valid → Draft: User initiates (rare, for manual correction); re-validates
- Valid → Locked: Automatic when first assigned to account
- Locked → Valid: Only allowed if removed from all accounts (not used in Phase 1 MVP)

**Example**:
```json
{
  "id": "pm-001",
  "name": "60/40 Growth",
  "description": "60% equities, 40% bonds",
  "status": "Valid",
  "createdAt": "2025-11-16T10:00:00Z",
  "clonedFromModelId": null
}
```

---

### 2. Asset Class
**Purpose**: Reusable investment category (U.S. Equities, Bonds, International, etc.).

| Field | Type | Constraint | Notes |
|-------|------|-----------|-------|
| `id` | TEXT | PK, UUID | Unique identifier |
| `name` | TEXT | NOT NULL, UNIQUE | e.g., "U.S. Large Cap Equities", "Fixed Income" |
| `description` | TEXT | Nullable | Definition and purpose |
| `createdAt` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Immutable |

**Validation Rules**:
- Cannot be deleted if referenced by ticker allocations or model portfolio assignments
- Name uniqueness prevents duplicates but allows similar names (e.g., "Tech Equities" vs "Tech Growth")

**Example**:
```json
{
  "id": "ac-001",
  "name": "U.S. Large Cap Equities",
  "description": "S&P 500 constituents"
}
```

---

### 3. Model Portfolio Asset Class
**Purpose**: Junction table linking Model Portfolio to Asset Classes with target weights.

| Field | Type | Constraint | Notes |
|-------|------|-----------|-------|
| `id` | TEXT | PK, UUID | Unique identifier |
| `modelPortfolioId` | TEXT | FK → model_portfolio, NOT NULL | Composite key part 1 |
| `assetClassId` | TEXT | FK → asset_class, NOT NULL | Composite key part 2 |
| `targetWeightPct` | DECIMAL(5,2) | CHECK(0-100), NOT NULL | Percentage of portfolio in this class |
| `createdAt` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Immutable |

**Constraints**:
- Composite unique constraint on (modelPortfolioId, assetClassId) - no duplicates
- Sum of all targetWeightPct for a model = 100% ±1%

**Validation Rules**:
- Cannot delete if tickers exist in asset class
- Deletion of asset class removes all associations

**Example**:
```json
{
  "id": "mpac-001",
  "modelPortfolioId": "pm-001",
  "assetClassId": "ac-001",
  "targetWeightPct": 60.00
}
```

---

### 4. Ticker Allocation
**Purpose**: Individual security (ticker symbol) within an Asset Class with target weight.

| Field | Type | Constraint | Notes |
|-------|------|-----------|-------|
| `id` | TEXT | PK, UUID | Unique identifier |
| `assetClassId` | TEXT | FK → asset_class, NOT NULL | Parent asset class |
| `symbol` | TEXT | NOT NULL | e.g., "AAPL", "MSFT", "BRK.B" |
| `displayName` | TEXT | Nullable | e.g., "Apple Inc." for UI display |
| `targetWeightPctWithinAssetClass` | DECIMAL(5,2) | CHECK(0-100), NOT NULL | % within asset class, not portfolio |
| `createdAt` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Immutable |

**Constraints**:
- For each assetClassId, sum of targetWeightPctWithinAssetClass = 100% ±1%
- Composite unique constraint on (assetClassId, symbol) - no duplicate tickers in class

**Validation Rules**:
- Symbol must be valid Schwab ticker (validated via Schwab search API)
- Weight = assetClass weight × ticker weight within class
- Example: AC weight 60%, ticker weight 50% within AC → portfolio weight 30%

**Example**:
```json
{
  "id": "ta-001",
  "assetClassId": "ac-001",
  "symbol": "AAPL",
  "displayName": "Apple Inc.",
  "targetWeightPctWithinAssetClass": 33.33
}
```

---

### 5. Account
**Purpose**: Schwab brokerage account linked via OAuth, with optional model assignment.

| Field | Type | Constraint | Notes |
|-------|------|-----------|-------|
| `id` | TEXT | PK, UUID | Application internal ID |
| `schwabEncryptedAccountId` | TEXT | NOT NULL, UNIQUE | Encrypted Schwab account number (e.g., "X1234567") |
| `nickname` | TEXT | Nullable | User-friendly name (e.g., "IRA - Vanguard") |
| `assignedModelPortfolioId` | TEXT | FK → model_portfolio, Nullable | Model assigned to this account |
| `lastSyncedAt` | DATETIME | Nullable | When positions were last fetched from Schwab |
| `createdAt` | DATETIME | DEFAULT CURRENT_TIMESTAMP | When account was linked |

**State**:
- After OAuth: Account created, token stored, ready for model assignment
- Model assigned: Positions can be fetched, drift calculated, trades executed
- Model reassigned: Previous model remains locked (if no other accounts use it); new model assigned

**Validation Rules**:
- schwabEncryptedAccountId uniqueness prevents duplicate account links
- assignedModelPortfolioId can change but must point to valid model
- Drift calculations only valid if assignedModelPortfolioId is NOT NULL

**Example**:
```json
{
  "id": "acc-001",
  "schwabEncryptedAccountId": "[encrypted:X1234567]",
  "nickname": "Main Brokerage",
  "assignedModelPortfolioId": "pm-001",
  "lastSyncedAt": "2025-11-16T14:30:00Z",
  "createdAt": "2025-11-16T09:00:00Z"
}
```

---

### 6. Schwab Token
**Purpose**: Encrypted OAuth tokens for Schwab API access. Single row (implicit user = application owner).

| Field | Type | Constraint | Notes |
|-------|------|-----------|-------|
| `id` | TEXT | PK, UUID | Unique identifier |
| `encryptedAccessToken` | TEXT | NOT NULL | AES-256 encrypted access token (decrypt when needed) |
| `encryptedRefreshToken` | TEXT | NOT NULL | AES-256 encrypted refresh token |
| `expiresAt` | DATETIME | NOT NULL | Access token expiry (30 min from issue) |
| `refreshTokenExpiresAt` | DATETIME | NOT NULL | Refresh token expiry (7 days from issue) |
| `createdAt` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Token issue timestamp |
| `refreshedAt` | DATETIME | Nullable | Last refresh timestamp (for audit) |

**Lifecycle**:
1. User clicks "Connect Schwab" → redirects to OAuth endpoint
2. User authorizes → callback receives authorization code
3. Backend exchanges code for tokens → encrypted and stored in this table
4. Token manager service checks expiresAt before each Schwab API call
5. If expiry within 5 min → automatic refresh using refreshToken
6. If refreshToken expired → user prompted to re-authenticate

**Validation Rules**:
- Only ONE token record per application (implicit single-user)
- Tokens never exposed to frontend
- HTTP-only session cookie tracks auth state on frontend

**Example** (decrypted values shown for clarity):
```json
{
  "id": "token-001",
  "encryptedAccessToken": "[base64-encrypted]",
  "encryptedRefreshToken": "[base64-encrypted]",
  "expiresAt": "2025-11-16T14:45:00Z",
  "refreshTokenExpiresAt": "2025-11-23T12:00:00Z",
  "createdAt": "2025-11-16T14:15:00Z",
  "refreshedAt": null
}
```

---

### 7. Account Snapshot
**Purpose**: Cached copy of Schwab account positions to reduce API calls and enable fast position display.

| Field | Type | Constraint | Notes |
|-------|------|-----------|-------|
| `id` | TEXT | PK, UUID | Unique identifier |
| `accountId` | TEXT | FK → account, NOT NULL | Which account |
| `timestamp` | DATETIME | NOT NULL | When positions were fetched from Schwab |
| `positionsJson` | TEXT (JSON) | NOT NULL | Full Schwab positions response (normalized) |
| `structuredData` | TEXT (JSON) | NOT NULL | Pre-computed: symbol → {qty, price, value, weight%} |
| `totalAccountValue` | DECIMAL(15,2) | NOT NULL | Total portfolio value for quick reference |
| `availableCash` | DECIMAL(12,2) | NOT NULL | Cash balance (already includes reserves subtracted) |

**Strategy**:
- Fetched from Schwab on-demand or when user clicks "Refresh"
- New snapshot added; old snapshots kept for audit trail (history)
- Queries for current positions use latest snapshot
- If Schwab API fails, fallback to latest snapshot with "stale" indicator

**Validation Rules**:
- totalAccountValue = sum of all position values + availableCash
- availableCash = Schwab cash balance - configured reserve (e.g., $1000)
- structuredData must match positionsJson (pre-computed for UI performance)

**Example**:
```json
{
  "id": "snap-001",
  "accountId": "acc-001",
  "timestamp": "2025-11-16T14:30:00Z",
  "positionsJson": "{ ... full Schwab response ... }",
  "structuredData": {
    "AAPL": { "qty": 10, "price": 234.56, "value": 2345.60, "weight": 5.2 },
    "MSFT": { "qty": 5, "price": 456.78, "value": 2283.90, "weight": 5.1 },
    "BND": { "qty": 20, "price": 89.01, "value": 1780.20, "weight": 3.9 }
  },
  "totalAccountValue": 45234.56,
  "availableCash": 3234.80
}
```

---

### 8. Audit Log Entry
**Purpose**: Immutable record of all user actions (trades, rebalances, deployments, model changes).

| Field | Type | Constraint | Notes |
|-------|------|-----------|-------|
| `id` | TEXT | PK, UUID | Unique identifier |
| `timestamp` | DATETIME | NOT NULL, DEFAULT NOW | When action occurred |
| `action` | TEXT | CHECK(enum), NOT NULL | Type: TRADE_EXECUTED, REBALANCE_PROPOSED, DEPLOYMENT_EXECUTED, MODEL_ASSIGNED, etc. |
| `details` | TEXT (JSON) | NOT NULL | Action-specific data (trades, model ID, account ID, errors) |
| `status` | TEXT | CHECK(pending\|executed\|failed), NOT NULL | Execution outcome |
| `accountId` | TEXT | FK → account, Nullable | If action targets an account |
| `errorMessage` | TEXT | Nullable | If status = failed, reason why |
| `userId` | TEXT | Nullable | Implicit: single user (could be NULL since only one user per app) |

**Action Types** (enumerated):
- `OAUTH_LOGIN`: User authenticated via Schwab
- `OAUTH_REFRESH`: Token refreshed server-side
- `OAUTH_LOGOUT`: User logged out (if implemented)
- `MODEL_CREATED`: Draft portfolio created
- `MODEL_UPDATED`: Draft portfolio modified (weights changed)
- `MODEL_VALIDATED`: Portfolio transitioned to Valid state
- `MODEL_ASSIGNED`: Portfolio assigned to account
- `MODEL_CLONED`: Locked portfolio cloned to new Draft
- `POSITION_REFRESHED`: Schwab positions fetched
- `DEPLOYMENT_PROPOSED`: Cash deployment calculated (preview shown)
- `DEPLOYMENT_EXECUTED`: Cash deployment trades submitted to Schwab
- `REBALANCE_PROPOSED`: Full rebalance calculated (preview shown)
- `REBALANCE_EXECUTED`: Rebalance trades submitted to Schwab
- `BACKTEST_COMPLETED`: Historical backtest finished
- `API_ERROR`: Schwab API call failed (with retry count)

**Validation Rules**:
- Immutable: no updates or deletes after creation
- timestamp auto-set at creation (server time)
- details JSON structure varies by action type (documented separately)
- status = pending → executed/failed after Schwab responds

**Lifecycle Example** (Rebalance):
```
1. User clicks "Rebalance" button
   → Entry created: action=REBALANCE_PROPOSED, status=pending
   
2. System calculates trades, shows preview
   
3. User confirms
   → Trades submitted to Schwab
   
4. Schwab responds (success or error)
   → Entry status updated to executed OR failed
   → If failed, errorMessage populated with Schwab response
```

**Example**:
```json
{
  "id": "audit-001",
  "timestamp": "2025-11-16T14:35:00Z",
  "action": "REBALANCE_EXECUTED",
  "accountId": "acc-001",
  "status": "executed",
  "details": {
    "modelPortfolioId": "pm-001",
    "trades": [
      { "symbol": "AAPL", "quantity": -5, "orderType": "LIMIT", "price": 234.56 },
      { "symbol": "VTI", "quantity": 3, "orderType": "MARKET" }
    ],
    "totalCommission": 0.0,
    "driftBefore": { "AAPL": 8.2, "VTI": -5.1 },
    "driftAfter": { "AAPL": 5.2, "VTI": -2.1 }
  },
  "errorMessage": null,
  "userId": null
}
```

---

### 9. Backtest Result
**Purpose**: Cached output of historical portfolio simulation for performance comparison.

| Field | Type | Constraint | Notes |
|-------|------|-----------|-------|
| `id` | TEXT | PK, UUID | Unique identifier |
| `modelPortfolioId` | TEXT | FK → model_portfolio, NOT NULL | Which model was backtested |
| `startDate` | DATE | NOT NULL | Backtest period start |
| `endDate` | DATE | NOT NULL | Backtest period end |
| `rebalanceFrequency` | TEXT | CHECK(MONTHLY\|QUARTERLY\|ANNUAL), NOT NULL | Rebalance schedule used |
| `totalReturn` | DECIMAL(8,2) | NOT NULL | % return over period |
| `annualizedReturn` | DECIMAL(8,2) | NOT NULL | Annualized % return |
| `volatility` | DECIMAL(8,2) | NOT NULL | Standard deviation (annualized) |
| `sharpeRatio` | DECIMAL(6,2) | NOT NULL | Return / Volatility ratio |
| `maxDrawdown` | DECIMAL(8,2) | NOT NULL | Worst peak-to-trough % decline |
| `resultsJson` | TEXT (JSON) | NOT NULL | Detailed results (monthly returns, drawdown chart, etc.) |
| `createdAt` | DATETIME | DEFAULT CURRENT_TIMESTAMP | When backtest was run |

**Constraints**:
- Composite unique constraint on (modelPortfolioId, startDate, endDate, rebalanceFrequency)
- Prevents duplicate backtests of same parameters
- User can delete old backtests if desired (optional cleanup)

**Validation Rules**:
- endDate > startDate
- rebalanceFrequency must be one of enum values
- All return fields should sum/correlate logically (sanity check)

**Example**:
```json
{
  "id": "backtest-001",
  "modelPortfolioId": "pm-001",
  "startDate": "2020-01-01",
  "endDate": "2025-01-01",
  "rebalanceFrequency": "QUARTERLY",
  "totalReturn": 127.45,
  "annualizedReturn": 17.32,
  "volatility": 12.50,
  "sharpeRatio": 1.38,
  "maxDrawdown": -24.56,
  "resultsJson": "{ ... detailed results ... }",
  "createdAt": "2025-11-16T15:00:00Z"
}
```

---

## Relationships & Cascades

| Relationship | Type | Constraint | On Delete | Notes |
|--------------|------|-----------|-----------|-------|
| Model → AssetClass | N:N (via junction) | FK both sides | SET NULL on model delete; RESTRICT on class delete if used elsewhere | Allow multiple asset classes per model |
| AssetClass → Ticker | 1:N | FK assetClassId | CASCADE | Deleting class removes all tickers |
| Model → Account assignment | 1:N | FK assignedModelPortfolioId | SET NULL | Account loses assignment; no trades affected |
| Account → Tokens | 1:1 | Single token row (implicit) | N/A | Only one auth context |
| Account → Snapshots | 1:N | FK accountId | CASCADE | Position history deleted with account |
| Account/Model → AuditLog | N:N | FK accountId, FK modelPortfolioId | SET NULL | Audit trail remains even if records deleted |
| Model → BacktestResult | 1:N | FK modelPortfolioId | CASCADE | Backtest history deleted with model |

---

## Validation Rules Summary

### Portfolio Weight Validation
- **Portfolio-level**: Sum of all ModelPortfolioAssetClass.targetWeightPct = 100% ±1%
- **Asset-class-level**: Sum of all TickerAllocation.targetWeightPctWithinAssetClass = 100% ±1%
- **Effective weight**: TickerWeight = AssetClassWeight × TickerWeightWithinAssetClass
  - Example: 60% Equities × 50% AAPL = 30% AAPL in portfolio

### Drift Calculation
- **Current allocation** = Current account position value / Total portfolio value
- **Target allocation** = Model weight for that ticker
- **Drift %** = Current % - Target %
- **Overweight threshold**: Drift > +5% → highlight red
- **Underweight threshold**: Drift < -5% → highlight red

### Cash Deployment Constraints
- **Available cash** = Schwab cash balance - reserve (e.g., $1,000 minimum)
- **Deployment amount** ≤ available cash
- **Proportional allocation**: Deploy cash to each underweight ticker proportional to underweight magnitude
- **Round down** to avoid over-deployment; leftover cash held for next deployment

### Rebalance Constraints
- **Sell overweight**: Quantity = floor((Current% - Target%) / Price)
- **Buy underweight**: Quantity = floor((Target% - Current%) / Price)
- **Minimum order size**: Respect Schwab minimums (typically $1 for orders)
- **Fractional shares**: Allowed on most Schwab securities

### Account Linking Constraints
- **One OAuth context per app**: Only one token row (implicit single-user)
- **Multiple accounts per user**: OAuth provides account list; all linked accounts stored in database
- **No duplicate linking**: schwabEncryptedAccountId uniqueness prevents double-linking

### Model Cloning Rules
- **Only locked models can be cloned**: Draft/Valid models can be edited directly
- **Cloned model starts as Draft**: New portfolio inherits structure but clonedFromModelId tracks origin
- **Clone is independent**: Editing clone doesn't affect original

---

## Data Integrity Checks (SQL Constraints)

```sql
-- Model portfolio
ALTER TABLE model_portfolio 
  ADD CONSTRAINT ck_status CHECK(status IN ('Draft', 'Valid', 'Locked'));

-- Asset class weights sum to 100%
ALTER TABLE model_portfolio_asset_class
  ADD CONSTRAINT ck_weight_range CHECK(targetWeightPct >= 0 AND targetWeightPct <= 100);

-- Ticker weights within asset class sum to 100%
ALTER TABLE ticker_allocation
  ADD CONSTRAINT ck_ticker_weight CHECK(targetWeightPctWithinAssetClass >= 0 AND targetWeightPctWithinAssetClass <= 100);

-- Account snapshot totals
ALTER TABLE account_snapshot
  ADD CONSTRAINT ck_cash_positive CHECK(availableCash >= 0);

-- Audit log
ALTER TABLE audit_log_entry
  ADD CONSTRAINT ck_status CHECK(status IN ('pending', 'executed', 'failed'));

-- Backtest results
ALTER TABLE backtest_result
  ADD CONSTRAINT ck_rebalance_freq CHECK(rebalanceFrequency IN ('MONTHLY', 'QUARTERLY', 'ANNUAL'));
```

---

## Example Data Flow

### Scenario: User Creates Portfolio, Assigns to Account, Deploys Cash

1. **Create Model Portfolio**
   - model_portfolio: NEW Draft portfolio ("60/40 Growth")
   - User adds asset classes:
     - model_portfolio_asset_class: NEW "Equities" (60%), "Bonds" (40%)

2. **Add Tickers**
   - ticker_allocation: NEW "AAPL" 50% in Equities, "VTI" 50% in Equities
   - ticker_allocation: NEW "BND" 100% in Bonds
   - Total weight: (50%×60%) + (50%×60%) + (100%×40%) = 100% ✓

3. **Validate & Lock**
   - model_portfolio: status Draft → Valid (weights validated)

4. **Assign to Account**
   - account: assignedModelPortfolioId ← pm-001
   - model_portfolio: status Valid → Locked (now assigned)

5. **Fetch Positions**
   - account: lastSyncedAt ← NOW
   - account_snapshot: NEW snapshot with current holdings

6. **Calculate Drift**
   - Compare current positions vs. model weights
   - Example: Portfolio value $100k
     - AAPL: $3k current (3%), target 30% (30k) → drift -27%
     - VTI: $2k current (2%), target 30% (30k) → drift -28%
     - BND: $45k current (45%), target 40% (40k) → drift +5%
   - AAPL and VTI are underweight; BND is overweight

7. **Deploy Cash ($5k available)**
   - System calculates proportional deployment:
     - Total underweight magnitude: 27% + 28% = 55%
     - AAPL share: 27/55 × $5k = $2.45k → buy ~10.4 shares @ $234.56
     - VTI share: 28/55 × $5k = $2.55k → buy ~10.3 shares @ $247.03
   - Rounding: AAPL 10 shares, VTI 10 shares
   - Leftover: $5k - ($10 × $234.56) - ($10 × $247.03) ≈ $100 → held for next deployment

8. **Submit Trades**
   - Schwab API call: submit orders
   - audit_log_entry: NEW with action=DEPLOYMENT_EXECUTED, status=pending

9. **Schwab Confirms**
   - Orders executed (or filled in phases)
   - audit_log_entry: status → executed, details filled with order confirmation

10. **Next Refresh**
    - account: lastSyncedAt ← NOW
    - account_snapshot: NEW with updated positions showing AAPL +10, VTI +10
    - Drift recalculated with new balances

---

## Migration Strategy

Database migrations run sequentially on application startup (if not already applied):

1. `001-create-model-portfolios.ts` - Core table
2. `002-create-asset-classes.ts` - Reference table
3. `003-create-model-portfolio-asset-classes.ts` - Junction
4. `004-create-ticker-allocations.ts` - Ticker mappings
5. `005-create-accounts.ts` - Schwab accounts
6. `006-create-schwab-tokens.ts` - OAuth tokens (encrypted)
7. `007-create-account-snapshots.ts` - Position caching
8. `008-create-audit-log.ts` - Action history
9. `009-create-backtest-results.ts` - Analysis cache

Each migration is idempotent (safe to run multiple times) and includes rollback if needed.

---

## Phase 1 Complete: Data Model Finalized

All entities, relationships, validation rules, and constraints documented. Ready for Phase 1 API contract generation.
