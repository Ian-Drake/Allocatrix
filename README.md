# Allocatrix - Model Portfolio Account Manager

A single-user web application for managing multiple Schwab brokerage accounts using reusable model portfolios.

## Features

- **Portfolio Management**: Create and manage model portfolios with target asset allocations
- **Account Integration**: Link Schwab brokerage accounts via OAuth 2.0
- **Position Tracking**: Monitor current positions and drift from target allocations
- **Cash Deployment**: Deploy available cash proportionally to underweight positions
- **Rebalancing**: Execute full portfolio rebalances to align with target allocations
- **Backtesting**: Analyze historical performance of portfolio strategies
- **Audit Logging**: Complete audit trail of all trades and user actions

## Tech Stack

- **Frontend**: React 18 with Next.js 14, TypeScript
- **Backend**: Node.js 18+ with Express, Next.js API routes
- **Database**: SQLite (local persistent storage)
- **Authentication**: Schwab OAuth 2.0 with server-side token refresh
- **Testing**: Vitest, React Testing Library, Jest, Supertest
- **Architecture**: Bulletproof React pattern with feature modules

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- Schwab brokerage account with API credentials

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd Allocatrix
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Edit `.env.local` and configure:
- `SCHWAB_CLIENT_ID`: Your Schwab OAuth client ID
- `SCHWAB_CLIENT_SECRET`: Your Schwab OAuth client secret
- `ENCRYPTION_KEY`: 32-byte hex encryption key (generate with `openssl rand -hex 32`)
- `SESSION_SECRET`: Random session secret for cookie encryption

4. Initialize the database:
```bash
npm run db:migrate
```

5. Start the development server:
```bash
npm run dev
```

The application will be available at http://localhost:3000

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors
- `npm run format` - Format code with Prettier
- `npm run type-check` - Run TypeScript type checking
- `npm run test` - Run all tests
- `npm run test:unit` - Run unit tests
- `npm run test:integration` - Run integration tests
- `npm run test:contract` - Run API contract tests
- `npm run test:coverage` - Generate test coverage report
- `npm run db:migrate` - Run database migrations
- `npm run db:reset` - Reset database and re-run migrations

### Project Structure

```
allocatrix/
├── src/
│   ├── pages/           # Next.js pages and API routes
│   ├── features/        # Feature modules (Bulletproof React)
│   ├── shared/          # Shared components and utilities
│   └── backend/         # Backend services and utilities
│       ├── db/          # Database migrations and queries
│       ├── services/    # Business logic services
│       ├── middleware/  # Express middleware
│       └── utils/       # Utility functions
├── specs/               # Feature specifications and documentation
├── tests/               # Test suites
├── data/                # SQLite database (gitignored)
└── public/              # Static assets
```

## Deployment

### Vercel Deployment

1. Push your code to GitHub

2. Import the project in Vercel

3. Configure environment variables in Vercel dashboard:
   - `SCHWAB_CLIENT_ID`
   - `SCHWAB_CLIENT_SECRET`
   - `SCHWAB_REDIRECT_URI` (set to your Vercel domain)
   - `ENCRYPTION_KEY`
   - `SESSION_SECRET`
   - `DATABASE_URL` (use Vercel's SQLite integration or external database)
   - `NODE_ENV=production`
   - `LOG_LEVEL=info`

4. Deploy!

### Production Considerations

- **HTTPS**: Enforced automatically in production via middleware
- **Rate Limiting**: Built-in rate limiting prevents API abuse
- **Logging**: Structured JSON logging for production monitoring
- **Performance**: Metrics tracked against success criteria (see specs)
- **Security**: Encrypted token storage, HTTPS enforcement, HSTS headers
- **Audit Trail**: All trades and actions logged to database

## Architecture

### Phase 10: Polish & Cross-Cutting Concerns

This phase implements:

1. **Structured Logging** (`logger.ts`)
   - JSON logging in production
   - Human-readable logs in development
   - Configurable log levels
   - Context enrichment

2. **Error Handling** (`error-handler.ts`)
   - User-friendly error messages
   - Schwab API error translation
   - Database error handling
   - Standardized error responses

3. **Audit Logging** (`audit-logger.ts`)
   - Complete trade audit trail
   - User action logging
   - Immutable audit records
   - Action type enumeration

4. **Request Logging** (`request-logger.ts`)
   - Request/response logging
   - Request ID correlation
   - Response time tracking
   - User context enrichment

5. **HTTPS Enforcement** (`https-redirect.ts`)
   - Production HTTPS redirect
   - HSTS headers
   - Proxy-aware detection

6. **Performance Monitoring** (`performance-monitor.ts`)
   - Success criteria tracking (SC-003 through SC-008)
   - Latency warnings/alerts
   - Metric aggregation
   - Threshold enforcement

7. **Rate Limiting** (`rate-limit.ts`)
   - Per-IP rate limiting
   - Per-account trade limits
   - Auth endpoint protection
   - Standard rate limit headers

8. **Deployment Config** (`vercel.json`)
   - Vercel-optimized configuration
   - Environment setup
   - Build optimization

## Success Criteria

- SC-003: Position loading <30s
- SC-004: Position refresh <3s
- SC-005: Cash deployment calculation <1s
- SC-006: Rebalance calculation <2s
- SC-007: Trade execution <5s
- SC-008: 5-year backtest <5s
- SC-009: 100% valid auth tokens
- SC-010: 100% trade audit logging
- SC-011: 99% Schwab API success rate

## Security

- OAuth 2.0 authentication with Schwab
- Server-side token refresh (30-min access, 7-day refresh)
- Encrypted token storage using AES-256-GCM
- HTTP-only session cookies
- HTTPS enforcement in production
- Rate limiting on sensitive endpoints
- No client-side token exposure

## Testing

Run the full test suite:
```bash
npm run test
```

Generate coverage report:
```bash
npm run test:coverage
```

Tests include:
- Unit tests for all services and utilities
- Integration tests for API endpoints
- Contract tests for Schwab API integration
- Component tests for React UI

Target coverage: ≥80%

## License

Private - All rights reserved

## Support

For issues or questions, refer to the feature specifications in `specs/001-portfolio-manager/`.
