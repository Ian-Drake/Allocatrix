# Quickstart: Model Portfolio Account Manager

**Date**: 2025-11-16  
**Version**: 1.0.0  
**Audience**: Developers implementing feature `001-portfolio-manager`

---

## 📦 Prerequisites

- **Node.js**: 18.x or higher
- **npm**: 9.x or higher
- **Git**: For version control and branch management
- **Schwab Developer Account**: OAuth credentials (Client ID, Client Secret)
- **Text Editor**: VS Code or similar

---

## 🚀 Project Setup

### 1. Clone Repository & Create Feature Branch

```bash
git clone https://github.com/IanDrake/Allocatrix.git
cd Allocatrix
git checkout -b 001-portfolio-manager
```

### 2. Install Dependencies

```bash
npm install
```

Required packages (auto-installed):
- **Frontend**: react@18, next@14, zustand, @hookform/react, recharts
- **Backend**: express, sqlite3, node-sqlite3-wasm, dotenv
- **Testing**: vitest, jest, @testing-library/react, supertest
- **API**: openapi-backend, swagger-ui-express
- **Utilities**: zod (validation), date-fns (dates), crypto (encryption)

### 3. Environment Configuration

Create `.env.local` file in project root:

```bash
# Schwab OAuth Configuration
SCHWAB_CLIENT_ID=your_client_id_here
SCHWAB_CLIENT_SECRET=your_client_secret_here
SCHWAB_REDIRECT_URI=http://localhost:3000/api/auth/oauth-callback
SCHWAB_API_BASE_URL=https://api.schwabapi.com

# Database
DATABASE_URL=file:./data/allocatrix.db
DATABASE_TIMEOUT_MS=30000

# Encryption
ENCRYPTION_KEY=your-32-byte-hex-key-here

# Server
NODE_ENV=development
PORT=3000
API_BASE_URL=http://localhost:3000/api

# Feature Flags
ENABLE_BACKTESTING=true
ENABLE_FRACTIONAL_SHARES=true

# Logging
LOG_LEVEL=debug
LOG_FORMAT=json
```

**Generate 32-byte encryption key**:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Database Initialization

```bash
npm run db:migrate
```

This runs all migrations in sequence:
- `001-create-model-portfolios.ts`
- `002-create-asset-classes.ts`
- `003-create-model-portfolio-asset-classes.ts`
- `004-create-ticker-allocations.ts`
- `005-create-accounts.ts`
- `006-create-schwab-tokens.ts`
- `007-create-account-snapshots.ts`
- `008-create-audit-log.ts`
- `009-create-backtest-results.ts`

**Verify database**:
```bash
sqlite3 data/allocatrix.db ".tables"
```

---

## 🔨 Development Workflow

### Start Development Server

```bash
npm run dev
```

- Frontend available at: `http://localhost:3000`
- API available at: `http://localhost:3000/api`
- Swagger UI available at: `http://localhost:3000/api/docs`

### Run Tests

```bash
# Unit tests (watch mode)
npm run test:watch

# Integration tests
npm test -- --run tests/integration

# Contract tests (validate OpenAPI specs)
npm test -- --run tests/contract

# All tests with coverage
npm run test:coverage
```

### Linting & Formatting

```bash
# Check linting issues
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Format code
npm run format

# Format and commit
npm run format:staged
```

---

## 🏗️ Project Structure

```
src/
├── pages/
│   ├── api/                    # Backend API routes (Next.js)
│   │   ├── auth/               # OAuth endpoints
│   │   ├── portfolios/         # Portfolio management
│   │   ├── accounts/           # Account management
│   │   └── analysis/           # Backtesting
│   └── [frontend pages]        # React pages
│
├── features/
│   ├── portfolio-management/   # Portfolio CRUD + validation
│   ├── account-management/     # Accounts, positions, drift
│   ├── analysis/               # Backtesting UI
│   └── auth/                   # OAuth flow
│
├── shared/
│   ├── components/             # Reusable UI components
│   ├── hooks/                  # Custom React hooks
│   ├── services/               # API client, utilities
│   └── types/                  # TypeScript types
│
├── backend/
│   ├── services/               # Business logic
│   ├── controllers/            # API route handlers
│   ├── models/                 # Data models
│   ├── db/                     # Database + migrations
│   └── middleware/             # Auth, error handling
│
└── config/                     # Application config

tests/
├── unit/                       # Component & service tests
├── integration/                # End-to-end API flows
└── contract/                   # OpenAPI validation
```

---

## 📋 Core Workflows

### Workflow 1: User Creates Model Portfolio (User Story 2)

**Frontend Flow**:
```
1. User clicks "Create New Portfolio" → DashboardPage
2. PortfolioForm component mounts → usePortfolioModel hook initializes
3. User enters name "60/40 Growth" + saves
4. POST /api/portfolios → creates Draft portfolio
5. Portfolio list updated in Zustand store
```

**Tests to Write**:
```typescript
// tests/unit/portfolio-management/portfolio-form.test.tsx
describe('PortfolioForm', () => {
  it('creates new Draft portfolio on submit', async () => {
    const { getByRole, getByDisplayValue } = render(<PortfolioForm />);
    await userEvent.type(getByDisplayValue(''), '60/40 Growth');
    await userEvent.click(getByRole('button', { name: /create/i }));
    // Assert API called, Zustand store updated
  });
});

// tests/integration/portfolio-creation.test.ts
describe('Portfolio Creation Flow', () => {
  it('completes User Story 2 acceptance scenarios', async () => {
    // Scenario 1: Given user on Models page, When clicks Create, Then Draft created
    // Scenario 2: Given Draft portfolio, When adds Asset Class, Then stored
    // etc.
  });
});
```

### Workflow 2: User Authenticates via Schwab OAuth (User Story 1)

**Backend Flow**:
```
1. GET /api/auth/oauth-start → generates OAuth URL → redirects to Schwab
2. User authorizes on Schwab consent screen
3. Schwab redirects to GET /api/auth/oauth-callback?code=... 
4. Backend exchanges code for tokens → encrypts → stores in DB
5. Sets HTTP-only session cookie → redirects to dashboard
```

**Tests to Write**:
```typescript
// tests/integration/oauth-flow.test.ts
describe('OAuth Flow (User Story 1)', () => {
  it('exchanges authorization code for tokens', async () => {
    const response = await request(app)
      .get('/api/auth/oauth-callback')
      .query({ code: 'mock-auth-code', state: 'mock-state' });
    
    expect(response.status).toBe(302); // Redirect
    expect(response.headers['set-cookie']).toBeDefined(); // Session cookie
  });
});
```

### Workflow 3: User Assigns Model to Account & Deploys Cash (User Stories 3 & 5)

**Flow**:
```
1. User navigates to Accounts page → lists linked Schwab accounts
2. User selects account → sees current positions from snapshot
3. Calculates drift vs. model (if assigned)
4. User clicks "Deploy Cash" → POST /api/accounts/{id}/deploy-cash
5. System returns preview with proposed trades
6. User confirms → POST /api/accounts/{id}/deploy-cash/execute
7. Trades submitted to Schwab, audit log created
```

**Tests to Write**:
```typescript
// tests/integration/cash-deployment.test.ts
describe('Cash Deployment (User Story 5)', () => {
  it('calculates proportional deployment across underweight tickers', async () => {
    // Given: $5k cash, AAPL -30% drift, VTI -28% drift, BND +5% drift
    // When: proposeCashDeployment called
    // Then: AAPL gets ~$2.45k, VTI gets ~$2.55k (proportional to underweight)
  });
});
```

### Workflow 4: Backtest Analysis (User Story 7)

**Flow**:
```
1. User navigates to Analysis page → selects model + date range
2. POST /api/analysis/backtest → runs historical simulation
3. System:
   - Fetches or loads cached historical ticker prices
   - Simulates portfolio performance with rebalance frequency
   - Calculates metrics (return, volatility, Sharpe, max drawdown)
   - Stores results in backtest_result table
4. UI displays chart + metrics
```

**Tests to Write**:
```typescript
// tests/integration/backtest.test.ts
describe('Backtesting (User Story 7)', () => {
  it('completes 5-year backtest in under 5 seconds (SC-008)', async () => {
    const start = Date.now();
    await request(app)
      .post('/api/analysis/backtest')
      .send({ modelId: 'pm-001', startDate: '2020-01-01', ... });
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(5000);
  });
});
```

---

## 🧪 Testing Strategy (TDD - Write Tests First!)

### Test File Organization

```
tests/
├── unit/
│   ├── portfolio/
│   │   ├── portfolio.validation.test.ts     ← Test weight calculations
│   │   └── portfolio.service.test.ts        ← Test CRUD operations
│   ├── account/
│   │   ├── drift-calculator.test.ts         ← Test drift % calculation
│   │   └── cash-deployment.test.ts          ← Test proportional allocation
│   └── components/
│       ├── portfolio-form.test.tsx          ← Test form submission
│       └── drift-display.test.tsx           ← Test UI rendering
│
├── integration/
│   ├── oauth-flow.test.ts                   ← User Story 1
│   ├── portfolio-creation.test.ts           ← User Story 2
│   ├── portfolio-assignment.test.ts         ← User Story 3
│   ├── positions-display.test.ts            ← User Story 4
│   ├── cash-deployment.test.ts              ← User Story 5
│   ├── rebalance-flow.test.ts               ← User Story 6
│   └── backtest.test.ts                     ← User Story 7
│
└── contract/
    ├── auth-contract.test.ts                ← Validate /auth/* endpoints
    ├── portfolio-contract.test.ts           ← Validate /portfolios/* endpoints
    ├── account-contract.test.ts             ← Validate /accounts/* endpoints
    └── analysis-contract.test.ts            ← Validate /analysis/* endpoints
```

### Example Unit Test (TDD Red-Green-Refactor)

**Red Phase** (test fails, feature not implemented):
```typescript
// tests/unit/portfolio/portfolio.validation.test.ts
import { validatePortfolioWeights } from '@/backend/services/portfolio.service';

describe('Portfolio Weight Validation', () => {
  it('fails if asset class weights do not sum to 100% ±1%', () => {
    const portfolio = {
      assetClasses: [
        { name: 'Equities', weight: 60 },
        { name: 'Bonds', weight: 35 }, // Total = 95%, invalid
      ],
    };
    const result = validatePortfolioWeights(portfolio);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Weight sum 95% outside tolerance 100% ±1%');
  });
});
```

**Green Phase** (implement minimal logic to pass):
```typescript
// src/backend/services/portfolio.service.ts
export function validatePortfolioWeights(portfolio) {
  const sum = portfolio.assetClasses.reduce((acc, ac) => acc + ac.weight, 0);
  if (sum < 99 || sum > 101) {
    return { valid: false, errors: [`Weight sum ${sum}% outside tolerance...`] };
  }
  return { valid: true, errors: [] };
}
```

**Refactor Phase** (improve code quality while test stays green):
```typescript
const WEIGHT_TOLERANCE = 0.01; // 1%
const TARGET_WEIGHT = 1.0; // 100%

export function validatePortfolioWeights(portfolio: Portfolio): ValidationResult {
  const sum = portfolio.assetClasses.reduce(
    (acc, ac) => acc + ac.targetWeightPct / 100,
    0
  );
  const withinTolerance = Math.abs(sum - TARGET_WEIGHT) <= WEIGHT_TOLERANCE;
  
  if (!withinTolerance) {
    return {
      valid: false,
      errors: [
        `Total weight ${(sum * 100).toFixed(1)}% outside target ${TARGET_WEIGHT * 100}% ±${WEIGHT_TOLERANCE * 100}%`,
      ],
    };
  }
  return { valid: true, errors: [] };
}
```

### Example Integration Test

```typescript
// tests/integration/cash-deployment.test.ts
import request from 'supertest';
import { app } from '@/pages/api/_app'; // Express app
import { seedTestData } from '../fixtures/test-portfolios';

describe('Cash Deployment Flow (User Story 5)', () => {
  let accountId: string;
  
  beforeEach(async () => {
    const { account } = await seedTestData();
    accountId = account.id;
  });
  
  it('proposes cash deployment with drift-weighted allocation (SC-005: <1s)', async () => {
    // Scenario 5: Insufficient cash for full deployment → proportional allocation
    const start = Date.now();
    
    const response = await request(app)
      .post(`/api/accounts/${accountId}/deploy-cash`)
      .set('Cookie', 'auth_session=test-session');
    
    expect(response.status).toBe(200);
    expect(response.body.trades).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          symbol: expect.any(String),
          quantity: expect.any(Number),
        }),
      ])
    );
    expect(Date.now() - start).toBeLessThan(1000); // SC-005
  });
});
```

---

## 🔐 Schwab OAuth Integration

### Set Up OAuth Credentials

1. Go to [Schwab Developer Center](https://developer.charles schwab.com/)
2. Create OAuth application
3. Configure redirect URI: `http://localhost:3000/api/auth/oauth-callback`
4. Copy Client ID and Client Secret → `.env.local`

### OAuth Flow Implementation

**Backend Service** (`src/backend/services/token-manager.service.ts`):
```typescript
export class TokenManagerService {
  async exchangeCodeForTokens(code: string, state: string) {
    // Validate state (CSRF protection)
    // Exchange code for tokens via Schwab API
    // Encrypt tokens
    // Store in DB
    // Return encrypted tokens
  }
  
  async refreshTokenIfExpiring() {
    // Check if access token expires within 5 min
    // If yes, use refresh token to get new access token
    // Update DB
  }
}
```

**API Middleware** (`src/backend/middleware/auth-guard.ts`):
```typescript
export async function authGuard(req, res, next) {
  // Check session cookie
  // Ensure tokens not expired (refresh if needed)
  // Attach user context to req
  next();
}
```

---

## 📊 Database Queries Reference

### Common Patterns

**Get Account with Latest Positions**:
```typescript
const account = db.exec(`
  SELECT a.*, ap.positionsJson
  FROM account a
  LEFT JOIN account_snapshot ap ON a.id = ap.accountId
  WHERE a.id = ?
  ORDER BY ap.timestamp DESC LIMIT 1
`);
```

**Calculate Portfolio Drift**:
```typescript
const drift = db.exec(`
  SELECT ta.symbol, 
         SUM(ta.targetWeightPctWithinAssetClass * mpac.targetWeightPct) / 100 as targetWeight,
         -- Current weight from positions (joins omitted for brevity)
         (currentValue / totalAccountValue * 100) as currentWeight,
         ((currentValue / totalAccountValue * 100) - 
          (SUM(ta.targetWeightPctWithinAssetClass * mpac.targetWeightPct) / 100)) as driftPct
  FROM ticker_allocation ta
  JOIN model_portfolio_asset_class mpac ON ta.assetClassId = mpac.assetClassId
  WHERE mpac.modelPortfolioId = ?
  GROUP BY ta.symbol
`);
```

**Audit Log Entry for Trade**:
```typescript
db.exec(`
  INSERT INTO audit_log_entry (id, timestamp, action, accountId, details, status)
  VALUES (?, ?, 'DEPLOYMENT_EXECUTED', ?, ?, 'pending')
`, [uuidv4(), new Date(), accountId, JSON.stringify({ trades: [...] })]);
```

---

## 🚢 Deployment

### Build Production Bundle

```bash
npm run build
```

### Deploy to Vercel

```bash
npm install -g vercel
vercel --prod
```

Environment variables configured in Vercel dashboard:
- `SCHWAB_CLIENT_ID`
- `SCHWAB_CLIENT_SECRET`
- `ENCRYPTION_KEY`
- Database URL (persisted via volume mount)

---

## 📚 Key Files Reference

| File | Purpose |
|------|---------|
| `specs/001-portfolio-manager/spec.md` | Feature specification with user stories |
| `specs/001-portfolio-manager/data-model.md` | Database schema and entity relationships |
| `specs/001-portfolio-manager/contracts/*.openapi.yaml` | API endpoint specifications |
| `src/backend/db/migrations/*.ts` | Database schema creation |
| `src/features/portfolio-management/` | Portfolio CRUD feature module |
| `src/features/account-management/` | Account & trading feature module |
| `tests/integration/*.test.ts` | End-to-end flow tests |

---

## 🐛 Debugging

### Enable Debug Logging

```bash
# Frontend
DEBUG=allocatrix:* npm run dev

# Backend
LOG_LEVEL=debug npm run dev
```

### SQLite Inspection

```bash
sqlite3 data/allocatrix.db
sqlite> SELECT * FROM model_portfolio;
sqlite> .schema account
sqlite> SELECT * FROM audit_log_entry WHERE action = 'DEPLOYMENT_EXECUTED';
```

### Swagger UI (API Exploration)

Navigate to `http://localhost:3000/api/docs` to interactively test API endpoints:
1. Click "Authorize" → enter session token (if needed)
2. Expand endpoint → click "Try it out"
3. Fill parameters → click "Execute"
4. Review response

---

## 📞 Support & Resources

- **Schwab API Docs**: https://developer.schwab.com/docs/trade/trader-api/
- **OpenAPI Spec**: See `/specs/001-portfolio-manager/contracts/`
- **Architecture Decisions**: See `/specs/001-portfolio-manager/research.md`
- **Data Model**: See `/specs/001-portfolio-manager/data-model.md`

---

## ✅ Acceptance Checklist (Before Marking Complete)

- [ ] All migrations run without errors
- [ ] Development server starts: `npm run dev`
- [ ] Swagger UI accessible: `http://localhost:3000/api/docs`
- [ ] All tests pass: `npm test`
- [ ] Coverage ≥80%: `npm run test:coverage`
- [ ] Linting passes: `npm run lint`
- [ ] At least one of each user story 1-7 has integration test
- [ ] OAuth credentials configured in `.env.local`
- [ ] Database file created: `data/allocatrix.db`

---

**Next Steps**: Start implementing User Story 1 (Schwab OAuth). Write integration test first (red), implement backend (green), add UI (refactor).
