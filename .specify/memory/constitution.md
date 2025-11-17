````markdown
<!--
SYNC IMPACT REPORT
Version: 1.2.0 → 1.3.0 (MINOR: Added UI Design Guidelines principle)
Modified Principles: None (all existing principles unchanged)
Added Sections: VI. UI Design Guidelines (design inspiration, principles, components, layout, micro-interactions, typography, accessibility)
Removed Sections: None
Templates Updated: 
  - ✅ spec-template.md (no changes required—guidelines apply during feature implementation)
  - ✅ plan-template.md (no changes required—design principle incorporated during Phase 1)
  - ✅ tasks-template.md (no changes required—UI review tasks can reference Principle VI)
Follow-up TODOs: None
-->

# Allocatrix Constitution

## Core Principles

### I. Bulletproof React Architecture
Allocatrix MUST follow the Bulletproof React structure for all frontend code. This means:
- Project organization by feature modules, each self-contained with pages, components, hooks, types, and services
- Consistent file naming, imports, and folder hierarchy as per Bulletproof React conventions
- API layer abstraction through services to isolate business logic from UI components
- Strict separation of concerns: components handle rendering, services handle data operations

### II. Test-First Development (NON-NEGOTIABLE)
TDD is mandatory for all features. MUST follow Red-Green-Refactor:
- Write failing tests before implementation
- User approves acceptance scenarios
- Tests remain failing until implementation complete
- Refactor to improve code quality while tests pass
- All tests MUST be automated and part of CI/CD pipeline

### III. Database-Driven Backend
All persistent data MUST use SQLite as the single source of truth. Requirements:
- SQLite database file stored in project root or configurable data directory
- MUST support migration/schema versioning
- MUST implement transaction support for multi-step operations (e.g., order placement)
- MUST include connection pooling for concurrent requests
- MUST provide audit trail for critical operations (trades, allocations)

### IV. API Contract Testing
New API endpoints MUST include contract tests verifying request/response schemas. Requirements:
- Contract tests validate OpenAPI/Swagger specifications against actual responses
- Integration tests validate end-to-end flows (e.g., auth → fetch accounts → place order)
- Breaking API changes require major version bump and migration documentation
- Shared schemas between frontend and backend MUST be versioned together

### V. Security & Authentication
Schwab OAuth 2 integration MUST enforce secure credential handling:
- Access tokens valid for 30 minutes; refresh tokens valid for 7 days (per Schwab limits)
- MUST never store user credentials; only tokens in secure storage
- Backend token refresh MUST happen server-side to prevent token leakage
- HTTPS required for all API calls and OAuth redirects
- Environment variables for secrets; no hardcoded credentials

### VI. UI Design Guidelines
The Allocatrix UI MUST follow a professional, modern trading-platform aesthetic with minimalist principles and data-forward design.

**Design Inspiration**: A blend of Robinhood-level simplicity and Fidelity-level data clarity—modern, clean, and trustworthy without copying either platform directly.

**Core Design Principles**:

- **Minimalist**: Clean whitespace, few borders, subtle dividers or spacing to avoid visual clutter
- **Data-Centric**: Information-dense where appropriate; prioritize typography and alignment; charts and tables should feel professional finance-grade
- **Calm Color Palette**: 
  - Neutral gray backgrounds (#F7F8FA, #ECEDEF)
  - Dark navy text (#0A1A2F)
  - Green for gains (#16A34A)
  - Red for losses (#DC2626)
  - Accent blue for primary CTAs (#2563EB)

**Component Requirements**:

- **Cards**: Slight shadow, rounded corners (6–10px), title + body layout; used for accounts, model portfolios, summary metrics
- **Tables**: Compact high-density, clear column alignment, row hover highlight, sticky header on scroll (preferred)
- **Charts**: Clean minimal axes, no gaudy gradients; prefer line charts for performance, bar charts for allocations
- **Forms**: Single-column layouts, floating labels or clear titles, inline validation messages

**Layout Structure**:

- **Left sidebar nav**: Dashboard, Accounts, Models, Analysis, Settings
- **Top header bar**: Account selector, user icon, sync status
- **Main content**: Responsive grid for data cards
- **Right informational panel** (optional): Performance, drift summary, alerts

**Micro-Interactions**:

- Smooth fade/slide transitions when switching portfolios
- Tooltips on metric explanations
- Hover states for cards and table rows
- Click-to-expand detail panels
- Animated chart transitions on load

**Typography & Accessibility**:

- Use clean, modern sans-serif font (e.g., Inter, Roboto, SF Pro)
- Line height 1.4–1.6
- Body text ~14–15px
- Headings ~18–28px with medium weight
- High contrast ratios for readability
- Semantic HTML for screen reader support
- Responsive design for mobile, tablet, and desktop

**AI Implementation Note**: AI agents should reference this principle when designing new screens, components, or interactions. The specific colors, typography, and spacing values provide concrete guidance for consistent, professional output.

## Technology Stack Requirements

**Frontend**:
- React 18+ with TypeScript
- Bulletproof React project structure
- Vite or Create React App for build tooling
- Vitest + React Testing Library for unit/integration tests
- Zustand or Context API for state management

**Backend**:
- Node.js 18+ with Express.js or similar lightweight framework
- SQLite for persistence
- TypeScript for type safety
- Jest + Supertest for API testing
- Auth0 or similar for OAuth 2 token management

**Shared**:
- OpenAPI 3.0+ for API specifications
- Git for version control
- Semantic versioning (MAJOR.MINOR.PATCH)

## Naming Conventions

All code MUST follow strict naming conventions to ensure consistency, readability, and maintainability across frontend, backend, and database layers.

### File & Folder Naming

**General Rules**:
- All file and folder names MUST be lowercase with hyphens separating words (kebab-case)
- No underscores, spaces, or mixed case in filenames
- MUST use descriptive, singular nouns for files; plural for directories containing collections

**Frontend (Bulletproof React Structure)**:
- Feature modules: `features/[feature-name]/` (e.g., `features/portfolio-management/`)
- Pages: `pages/[PageName].tsx` (PascalCase, e.g., `pages/DashboardPage.tsx`)
- Components: `components/[ComponentName]/[ComponentName].tsx` (PascalCase)
- Hooks: `hooks/use[HookName].ts` (camelCase with `use` prefix, e.g., `hooks/usePortfolioModel.ts`)
- Types: `types/[entity].types.ts` (lowercase entity name, e.g., `types/portfolio.types.ts`)
- Services: `services/[serviceName].service.ts` (camelCase with `.service` suffix)
- Tests: `[name].test.tsx` or `[name].test.ts` (co-located with source, same name with `.test` before extension)
- Config: `config/[configName].ts` (camelCase, e.g., `config/apiEndpoints.ts`)
- Utilities: `utils/[utilityName].ts` (camelCase, e.g., `utils/formatCurrency.ts`)

**Backend (Next.js API Routes)**:
- API routes: `pages/api/[resource]/[action].ts` (lowercase, e.g., `pages/api/portfolios/create.ts`)
- Controllers: `controllers/[ResourceController].ts` (PascalCase, e.g., `controllers/PortfolioController.ts`)
- Services: `services/[ServiceName].service.ts` (PascalCase with `.service` suffix)
- Models: `models/[ModelName].ts` (PascalCase, e.g., `models/Portfolio.ts`)
- Middleware: `middleware/[middlewareName].ts` (camelCase, e.g., `middleware/authGuard.ts`)
- Database: `db/[dbOperationType].ts` (camelCase, e.g., `db/queries.ts`, `db/migrations.ts`)
- Migrations: `db/migrations/[timestamp]-[description].ts` (e.g., `db/migrations/001-create-portfolios.ts`)

**Database**:
- Migration files: `[sequence]-[description].ts` (leading zeros, lowercase with hyphens)
  - Example: `001-create-model-portfolios.ts`, `002-create-asset-classes.ts`, `003-add-audit-log.ts`

### TypeScript Variable & Function Naming

**Variables** (camelCase):
```typescript
// Scalars
const portfolioName = "Growth Portfolio";
const targetWeightPct = 0.65;
const isLocked = false;
const lastSyncedAt: Date = new Date();

// Collections
const portfolios: Portfolio[] = [];
const assetClassMap = new Map<string, AssetClass>();

// Booleans (prefix with is/has/can/should)
const isValid = true;
const hasError = false;
const canDelete = false;
const shouldRetry = true;
```

**Functions** (camelCase, verb-noun pattern):
```typescript
// Services/utilities
export function calculateDrift(current: number, target: number): number {}
export async function fetchAccountPositions(accountId: string): Promise<Position[]> {}
export function formatPortfolioName(name: string): string {}
export function validateModelWeights(model: ModelPortfolio): ValidationResult {}

// Event handlers (prefix with handle)
function handleDeployClick() {}
function handleModelChange(model: ModelPortfolio) {}
function handleError(error: Error) {}

// React components (PascalCase, noun-based)
export function DashboardPage() {}
export function PortfolioCard({ portfolio }: Props) {}
export function AccountSelector({ onSelect }: Props) {}

// Hooks (prefix with use)
export function usePortfolioModel(id: string) {}
export function useAccountPositions(accountId: string) {}
export function useCashDeploymentCalculator(account: Account) {}
```

**Constants** (UPPER_SNAKE_CASE for true constants, camelCase for config objects):
```typescript
// True constants
export const MAX_ASSET_CLASSES = 20;
export const ACCESS_TOKEN_EXPIRY_MINUTES = 30;
export const REFRESH_TOKEN_EXPIRY_DAYS = 7;
export const PORTFOLIO_WEIGHT_TOLERANCE = 0.01; // 1%

// Config objects (camelCase)
export const apiConfig = {
  baseUrl: "https://api.example.com",
  timeout: 30000,
  retryAttempts: 3,
};

export const schwabConfig = {
  clientId: process.env.SCHWAB_CLIENT_ID,
  redirectUri: process.env.SCHWAB_REDIRECT_URI,
};
```

**Type Names** (PascalCase, singular nouns):
```typescript
export type Portfolio = {
  id: string;
  name: string;
  status: "Draft" | "Valid" | "Locked";
  createdAt: Date;
};

export interface AssetClass {
  id: string;
  name: string;
}

export enum AccountStatus {
  Active = "ACTIVE",
  Suspended = "SUSPENDED",
  Closed = "CLOSED",
}
```

**Generic Type Variables** (PascalCase, single letter or descriptive):
```typescript
// Single letter for simple generics
function identity<T>(value: T): T { return value; }

// Descriptive for complex cases
function mapCollection<TItem, TResult>(
  items: TItem[],
  mapper: (item: TItem) => TResult
): TResult[] { }

type ApiResponse<TData> = {
  data: TData;
  status: number;
};
```

### Database Naming

**Table Names** (snake_case, singular nouns):
```sql
CREATE TABLE model_portfolio (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE asset_class (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE ticker_allocation (
  id TEXT PRIMARY KEY,
  asset_class_id TEXT NOT NULL,
  symbol TEXT NOT NULL
);

CREATE TABLE account (
  id TEXT PRIMARY KEY,
  schwab_encrypted_account_id TEXT NOT NULL,
  nickname TEXT
);

CREATE TABLE audit_log_entry (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  details TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Column Names** (snake_case, descriptive nouns with implied type suffix):
```sql
-- Identifiers (always id)
id TEXT PRIMARY KEY

-- Foreign keys (entity_id)
portfolio_id TEXT NOT NULL
account_id TEXT NOT NULL
asset_class_id TEXT NOT NULL

-- Booleans (is_*, has_*)
is_locked BOOLEAN DEFAULT FALSE
has_error BOOLEAN DEFAULT FALSE

-- Timestamps (* _at for point in time)
created_at DATETIME DEFAULT CURRENT_TIMESTAMP
updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
last_synced_at DATETIME
expires_at DATETIME

-- Percentages/Weights (suffix with _pct or _percent)
target_weight_pct DECIMAL(5,2)
current_weight_pct DECIMAL(5,2)

-- Amounts/Currency (prefix with context)
available_cash DECIMAL(12,2)
total_value DECIMAL(12,2)
commission_amount DECIMAL(10,2)

-- Counts (count_*)
trade_count INTEGER

-- Status/Type fields (no suffix, enum values in UPPER_CASE)
status TEXT CHECK(status IN ('Draft', 'Valid', 'Locked'))
action TEXT CHECK(action IN ('TRADE_EXECUTED', 'REBALANCE_PROPOSED', 'ERROR_OCCURRED'))

-- Enum-like selectors (keep descriptive)
rebalance_frequency TEXT CHECK(rebalance_frequency IN ('MONTHLY', 'QUARTERLY', 'ANNUAL'))

-- Encrypted/sensitive data (prefix with encrypted_)
encrypted_account_id TEXT
encrypted_access_token TEXT
encrypted_refresh_token TEXT
```

**Index Names** (idx_[table]_[column(s)]):
```sql
CREATE INDEX idx_account_schwab_encrypted_account_id ON account(schwab_encrypted_account_id);
CREATE INDEX idx_ticker_allocation_asset_class_id ON ticker_allocation(asset_class_id);
CREATE INDEX idx_audit_log_entry_timestamp ON audit_log_entry(timestamp);
CREATE INDEX idx_audit_log_entry_action ON audit_log_entry(action);
```

### Branch & Commit Naming

**Branch Names** (feature branch format):
- Format: `[FEATURE-NUMBER]-[short-name]` (e.g., `001-portfolio-manager`)
- Hotfix branches: `hotfix/[issue-description]` (e.g., `hotfix/token-refresh-bug`)
- Bugfix branches: `bug/[issue-description]` (e.g., `bug/drift-calculation-error`)

**Commit Messages**:
- Format: `type(scope): subject`
- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
- Scopes (optional): feature name or module (e.g., `feat(portfolio-manager): add cash deployment`)
- Subject: lowercase, imperative, no period at end (e.g., `add portfolio weight validation`)

Example commits:
```
feat(portfolio-manager): add model portfolio creation
fix(oauth): handle token refresh race condition
test(cash-deployment): add integration tests for rounding
docs(architecture): add database schema diagram
chore: update dependencies
```

### API Endpoint Naming

**REST Endpoints** (lowercase, resource-based, plural nouns):
```
GET    /api/portfolios              # List all portfolios
POST   /api/portfolios              # Create portfolio
GET    /api/portfolios/:id          # Get portfolio detail
PUT    /api/portfolios/:id          # Update portfolio
DELETE /api/portfolios/:id          # Delete portfolio

GET    /api/accounts/:id/positions  # Get account positions
POST   /api/accounts/:id/deploy-cash        # Deploy cash
POST   /api/accounts/:id/rebalance  # Execute rebalance
GET    /api/accounts/:id/drift      # Calculate drift

GET    /api/analysis/backtest       # Backtest results
POST   /api/analysis/backtest       # Run backtest

GET    /api/auth/status             # Auth status
POST   /api/auth/refresh            # Refresh token
```

**Query Parameters** (camelCase):
```
GET /api/portfolios?status=Valid&createdAfter=2025-01-01&limit=20&offset=0
GET /api/accounts?accountId=123&includePositions=true
GET /api/analysis/backtest?startDate=2020-01-01&endDate=2025-01-01&rebalanceFrequency=QUARTERLY
```

### Environment Variable Naming

**Format** (UPPER_SNAKE_CASE):
```bash
# Schwab OAuth
SCHWAB_CLIENT_ID=abc123
SCHWAB_CLIENT_SECRET=xyz789
SCHWAB_REDIRECT_URI=https://app.example.com/auth/callback

# Database
DATABASE_URL=file:./data/allocatrix.db
DATABASE_TIMEOUT_MS=30000

# API
API_BASE_URL=https://api.schwabapi.com
API_TIMEOUT_MS=30000
API_RETRY_ATTEMPTS=3

# Feature flags
ENABLE_BACKTESTING=true
ENABLE_FRACTIONAL_SHARES=true

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
```

### Summary Table

| Category | Pattern | Example |
|----------|---------|---------|
| Frontend folders | kebab-case | `features/portfolio-management/` |
| Frontend components | PascalCase | `DashboardPage.tsx` |
| Frontend functions | camelCase | `calculateDrift()` |
| Frontend hooks | use + PascalCase | `usePortfolioModel()` |
| TypeScript types | PascalCase | `type Portfolio = {}` |
| TypeScript constants | UPPER_SNAKE_CASE | `MAX_ASSET_CLASSES` |
| Database tables | snake_case singular | `model_portfolio` |
| Database columns | snake_case | `target_weight_pct` |
| API endpoints | /lowercase/plural | `GET /api/portfolios` |
| Query parameters | camelCase | `?startDate=...` |
| Environment variables | UPPER_SNAKE_CASE | `SCHWAB_CLIENT_ID` |
| Git branches | kebab-case with number | `001-portfolio-manager` |
| Commit types | lowercase | `feat`, `fix`, `docs` |

## Project File Structure

All Allocatrix projects MUST follow this generic directory structure template. Specific files and subdirectories are created as features are developed, but the organizational hierarchy and naming patterns MUST remain consistent.

```
allocatrix/
├── .github/                          # GitHub configuration
│   ├── prompts/                      # Agent prompt files
│   └── workflows/                    # CI/CD workflow definitions
│
├── .specify/                         # Specification framework
│   ├── memory/                       # Project governance
│   ├── scripts/                      # Generation scripts
│   └── templates/                    # Spec templates
│
├── .vscode/                          # VS Code configuration
│
├── specs/                            # Feature specifications directory
│   └── [FEATURE-NUMBER]-[name]/      # Individual feature specs
│       ├── spec.md
│       ├── plan.md
│       ├── research.md
│       ├── data-model.md
│       ├── tasks.md
│       ├── checklists/
│       └── contracts/
│
├── src/                              # Application source code
│   ├── pages/                        # Next.js pages and API routes
│   │   ├── api/                      # Backend API routes
│   │   │   ├── [resource]/
│   │   │   └── [resource]/[action].ts
│   │   └── [PageName].tsx            # Frontend pages
│   │
│   ├── features/                     # Feature modules (Bulletproof React)
│   │   └── [feature-name]/           # Each feature is self-contained
│   │       ├── pages/
│   │       ├── components/
│   │       ├── hooks/
│   │       ├── services/
│   │       ├── types/
│   │       └── index.ts
│   │
│   ├── shared/                       # Reusable across features
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── types/
│   │   ├── utils/
│   │   └── constants/
│   │
│   ├── backend/                      # Backend business logic
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── models/
│   │   ├── middleware/
│   │   ├── db/
│   │   │   ├── migrations/
│   │   │   └── queries.ts
│   │   ├── utils/
│   │   ├── types/
│   │   └── constants/
│   │
│   ├── config/                       # Application configuration
│   └── styles/                       # Global styles
│
├── tests/                            # Test suites
│   ├── unit/
│   ├── integration/
│   ├── contract/
│   └── fixtures/
│
├── docs/                             # Technical documentation
│
├── data/                             # SQLite database file location
│
├── .env.local                        # Local environment (gitignored)
├── .env.example                      # Environment template
├── .gitignore
├── .eslintrc.json
├── .prettierrc.json
├── tsconfig.json
├── next.config.js
├── package.json
├── package-lock.json
├── README.md
└── CHANGELOG.md
```

### Generic Structure Rules

**Directory Organization Principles**:
- Root level contains project configuration files only
- Source code organized in `src/` with clear separation of concerns
- Features are independent modules in `src/features/` following Bulletproof React patterns
- Shared code lives in `src/shared/` and is imported by features
- Backend logic isolated in `src/backend/` with clear layer separation
- Tests are either co-located with source (`.test` suffix) or in parallel `tests/` directory
- Specifications stored in `specs/` with numbered feature directories

**Directory Ownership**:
- `/specs/` - All specification outputs (feature specs, plans, research, data models, tasks)
- `/src/pages/` - Next.js routing and API endpoint definitions
- `/src/features/[name]/` - Feature-specific UI and services (self-contained)
- `/src/shared/` - Reusable components, hooks, utilities, constants
- `/src/backend/` - Business logic, database access, external integrations
- `/tests/` - Test suites organized by type (unit, integration, contract)
- `/docs/` - Architecture guides, API documentation, deployment procedures
- `/.github/` - Automated workflows and agent prompts
- `/.specify/` - Specification framework and governance

**Consistency Requirements**:
- All new directories MUST follow naming conventions (kebab-case for folders, PascalCase for component folders)
- Feature modules MUST have identical internal structure (pages, components, hooks, services, types)
- No files should exist outside their designated directories
- Shared utilities should be in `shared/`, not duplicated in features
- Backend business logic should not leak into frontend components (use services)

### File Structure Validation

**Linting & PR Checks**:
- ESLint MUST verify imports follow correct path patterns
- PR reviews MUST check for files in wrong directories
- CI/CD MUST fail if new code violates structure rules
- Architecture decisions MUST be documented in `/docs/`

## Development Workflow

### Feature Implementation
1. Create feature branch from main: `git checkout -b FEATURE-[number]-description`
2. Add feature spec in `/specs/[number]-feature-name/spec.md` with user stories
3. Create implementation plan in `/specs/[number]-feature-name/plan.md`
4. Generate task list in `/specs/[number]-feature-name/tasks.md`
5. Implement in priority order (P1 → P2 → P3) with tests written first
6. Create pull request with reference to spec and passing tests

### Code Quality Gates
- MUST pass linting (ESLint) and formatting (Prettier)
- MUST have ≥80% code coverage for new modules
- MUST have passing contract tests for all API changes
- MUST pass integration tests for cross-module features
- Security review required for auth/token handling changes

### Database Migrations
- MUST use migration scripts in `backend/migrations/` with sequential numbering
- MUST include rollback capability
- MUST be idempotent (safe to run multiple times)
- MUST document schema changes in migration file comments

## Governance

### Constitution Authority
This constitution supersedes all other development practices and guidelines in Allocatrix. Exceptions MUST be documented in the complexity tracking section of the plan with explicit justification.

### Amendment Process
1. Proposed amendment submitted as PR to `.specify/memory/constitution.md`
2. Change MUST be backwards compatible (PATCH) or clearly marked as breaking (MAJOR)
3. All five core principles are non-negotiable; removal requires unanimous team consensus
4. Version number MUST increment per semantic versioning rules
5. Ratification recorded with date in constitution footer

### Compliance Verification
- All PRs MUST reference their spec and confirm Constitution compliance
- Sprint reviews MUST verify that completed features follow all five principles
- Quarterly architecture reviews MUST audit adherence to Bulletproof React structure and test coverage
- Use `.specify/templates/plan-template.md` to validate Constitution gates before Phase 0

**Version**: 1.3.0 | **Ratified**: 2025-01-16 | **Last Amended**: 2025-11-16
