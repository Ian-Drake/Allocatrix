# Deployment Guide

This guide covers deploying Allocatrix to production.

## Pre-Deployment Checklist

- [ ] All tests passing (`npm run test`)
- [ ] No linting errors (`npm run lint`)
- [ ] Type checking passes (`npm run type-check`)
- [ ] Environment variables documented
- [ ] Database migrations tested
- [ ] Security audit completed
- [ ] Schwab OAuth credentials obtained
- [ ] Production domain configured

## Environment Variables

### Required for Production

```bash
# Schwab OAuth
SCHWAB_CLIENT_ID=your_production_client_id
SCHWAB_CLIENT_SECRET=your_production_client_secret
SCHWAB_REDIRECT_URI=https://yourdomain.com/api/auth/callback

# Encryption (generate with: openssl rand -hex 32)
ENCRYPTION_KEY=your_64_character_hex_key

# Session Security (generate with: openssl rand -base64 32)
SESSION_SECRET=your_random_session_secret

# Database
DATABASE_URL=sqlite:///var/data/allocatrix.db

# Environment
NODE_ENV=production
LOG_LEVEL=info

# API Configuration
API_BASE_URL=https://yourdomain.com
```

### Optional Configuration

```bash
# Rate Limiting (defaults shown)
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100

# Performance Monitoring
PERFORMANCE_MONITORING_ENABLED=true

# Logging
LOG_FORMAT=json  # json or text
```

## Vercel Deployment

### 1. Prepare Repository

```bash
# Ensure main branch is up to date
git checkout main
git pull origin main

# Verify build works
npm run build

# Push to GitHub
git push origin main
```

### 2. Create Vercel Project

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your GitHub repository
4. Configure project:
   - Framework Preset: Next.js
   - Root Directory: `./`
   - Build Command: `npm run build`
   - Output Directory: `.next`

### 3. Configure Environment Variables

In Vercel dashboard, add all required environment variables:

1. Go to Project Settings → Environment Variables
2. Add each variable from the list above
3. Select appropriate environments (Production, Preview, Development)

**Important**: Never commit secrets to git. Always use Vercel's environment variable interface.

### 4. Configure Database

For SQLite in production:

**Option A: Vercel Blob Storage (Recommended)**
```bash
# Install Vercel Blob SDK
npm install @vercel/blob

# Update DATABASE_URL
DATABASE_URL=blob://allocatrix/database.db
```

**Option B: External Database**
Consider using a hosted database service:
- Turso (serverless SQLite)
- PlanetScale (MySQL-compatible)
- Neon (Postgres)

Update `DATABASE_URL` accordingly and modify database adapter if needed.

### 5. Deploy

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

Or use Git integration:
- Push to `main` branch → auto-deploys to production
- Push to any branch → auto-deploys to preview

### 6. Post-Deployment Verification

After deployment:

1. **Check Health**
   - Visit https://yourdomain.com
   - Verify homepage loads

2. **Test OAuth Flow**
   - Click "Connect Schwab Account"
   - Complete OAuth flow
   - Verify redirect works

3. **Check Logs**
   - Vercel dashboard → Functions → Logs
   - Look for any errors
   - Verify structured logging

4. **Monitor Performance**
   - Check latency metrics
   - Verify success criteria (SC-003 through SC-008)
   - Review rate limiting headers

5. **Test Core Workflows**
   - Create model portfolio
   - Assign to account
   - View positions
   - Calculate drift

## Security Hardening

### 1. HTTPS Configuration

The app automatically enforces HTTPS in production via middleware.

Verify:
```bash
curl -I http://yourdomain.com
# Should return 301 redirect to https://
```

### 2. HSTS Headers

Strict-Transport-Security headers are set automatically.

Verify:
```bash
curl -I https://yourdomain.com
# Should include: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

### 3. Rate Limiting

Test rate limits:
```bash
# Should return 429 after exceeding limits
for i in {1..101}; do curl https://yourdomain.com/api/health; done
```

### 4. Audit Logging

Verify audit trail:
```bash
# All trades and actions should be logged
# Check database: SELECT * FROM audit_log_entry ORDER BY timestamp DESC LIMIT 10;
```

### 5. Token Security

- Tokens stored encrypted in database (AES-256-GCM)
- Never exposed to client
- Automatic refresh before expiry
- HTTP-only cookies for sessions

## Monitoring & Observability

### 1. Logging

Logs are structured JSON in production:
```json
{
  "timestamp": "2025-11-17T17:30:00.000Z",
  "level": "info",
  "message": "Request completed",
  "context": {
    "requestId": "req_abc123",
    "method": "GET",
    "path": "/api/accounts",
    "statusCode": 200,
    "duration": 145
  }
}
```

View logs in Vercel dashboard or export to monitoring service.

### 2. Performance Metrics

Performance monitoring tracks:
- Position load time (SC-003: <30s)
- Position refresh (SC-004: <3s)
- Cash deployment calc (SC-005: <1s)
- Rebalance calc (SC-006: <2s)
- Trade execution (SC-007: <5s)
- Backtest 5yr (SC-008: <5s)

Metrics logged as warnings/errors if thresholds exceeded.

### 3. Error Tracking

Integrate with error tracking service:

**Sentry** (recommended):
```bash
npm install @sentry/nextjs

# Add to next.config.js
const { withSentryConfig } = require('@sentry/nextjs');
```

**DataDog** or **New Relic** also supported.

### 4. Uptime Monitoring

Set up external monitoring:
- Pingdom
- UptimeRobot
- StatusCake

Monitor endpoint: `https://yourdomain.com/api/health`

## Backup & Recovery

### Database Backups

**Automated Backups** (recommended):
```bash
# Daily backup cron
0 2 * * * /usr/bin/sqlite3 /var/data/allocatrix.db ".backup /var/backups/allocatrix-$(date +\%Y\%m\%d).db"
```

**Manual Backup**:
```bash
sqlite3 /var/data/allocatrix.db ".backup /path/to/backup.db"
```

**Restore**:
```bash
cp /path/to/backup.db /var/data/allocatrix.db
```

### Audit Log Preservation

Audit logs are immutable. Never delete entries.

Export for archival:
```bash
sqlite3 -header -csv allocatrix.db "SELECT * FROM audit_log_entry;" > audit_export.csv
```

## Rollback Procedure

If deployment fails:

1. **Vercel Instant Rollback**
   - Vercel dashboard → Deployments
   - Find previous working deployment
   - Click "..." → "Promote to Production"

2. **Git Rollback**
   ```bash
   git revert HEAD
   git push origin main
   ```

3. **Database Rollback**
   ```bash
   # Restore from backup
   cp /var/backups/allocatrix-YYYYMMDD.db /var/data/allocatrix.db
   ```

## Troubleshooting

### OAuth Redirect Fails

**Problem**: Schwab OAuth redirects to wrong URL

**Solution**:
1. Verify `SCHWAB_REDIRECT_URI` matches production domain
2. Update Schwab app configuration with correct redirect URI
3. Ensure HTTPS is used (required by Schwab)

### Database Connection Errors

**Problem**: Cannot connect to database

**Solution**:
1. Check `DATABASE_URL` is correct
2. Verify database file exists and is writable
3. Check file permissions on Vercel Blob or filesystem

### Performance Degradation

**Problem**: API responses slow

**Solution**:
1. Check performance monitoring logs for bottlenecks
2. Review Schwab API response times
3. Consider database indexing (migrations already include indexes)
4. Check Vercel function execution time limits

### Rate Limit Issues

**Problem**: Users getting 429 errors

**Solution**:
1. Review rate limit configuration
2. Adjust limits if legitimate traffic
3. Check for bot traffic or abuse
4. Consider per-account limits instead of per-IP

## Maintenance Windows

Schedule maintenance for:
- Database migrations
- Schwab API credential rotation
- Security updates
- Schema changes

**Process**:
1. Announce maintenance window (if multi-user in future)
2. Set application to read-only mode
3. Take database backup
4. Apply changes
5. Verify functionality
6. Re-enable writes
7. Monitor for issues

## Support Contacts

- **Schwab API Support**: [developer.schwab.com](https://developer.schwab.com)
- **Vercel Support**: [vercel.com/support](https://vercel.com/support)
- **Security Issues**: security@yourdomain.com

## Compliance

### Audit Requirements

- All trades logged (SC-010: 100% coverage)
- Logs retained for 7 years (regulatory requirement)
- Never delete audit entries
- Regular audit log reviews

### Data Privacy

- Single-user application (no multi-tenant concerns)
- Tokens encrypted at rest
- No PII stored beyond account identifiers
- Schwab data cached temporarily

### API Rate Limits (Schwab)

- OAuth: Follows Schwab limits
- Market Data: 120 requests/minute
- Trading: 60 requests/minute

Monitor API usage to stay within limits.
