# RicozViz Platform Operator Application (`apps/ricozviz-admin`)

Enterprise platform administration portal for RicozViz operators, built on Next.js 15, React 19, and Tailwind CSS v4.

## Port & Environments
- **Port**: `3002`
- **Environment**: Platform Operations Portal (`[ADMIN]`)
- **Theme**: Obsidian (`#141414`) + Coral (`#ff6b35`)

## Architectural Guarantees & Security

1. **Zero-localStorage Session Architecture**:
   - Access tokens reside **strictly in-memory** (in React Context and client closures).
   - The rotating 7-day refresh token is managed exclusively via the `httpOnly`, `SameSite=Lax`, `Path=/` cookie named `rv_admin_session` proxied through Next.js BFF route handlers (`/api/auth/*`).
   - Automated 401 handling queues concurrent requests and invokes `/api/auth/refresh` without session drops.

2. **Cryptographic Edge Middleware**:
   - Edge middleware validates HMAC SHA-256 JWT signatures directly using Web Crypto `crypto.subtle`.
   - Validates audience (`aud: 'admin'`), token type (`type: 'refresh'`), and expiration before granting access.
   - Cross-boundary rejection: Customer sessions (`rv_customer_session`) cannot access admin routes.

3. **Mandatory RFC 6238 TOTP 2FA**:
   - Platform admins must authenticate with a 6-digit TOTP code or single-use 8-character emergency backup code.
   - Self-service enrollment view (`/enroll-2fa`) renders native SVG QR code with confirmation checkpoint.

4. **Safety & Destructive Operation Guards**:
   - Tenant suspension requires typing the exact organization name into `<ConfirmDialog />` and entering an audit justification.
   - Read-only impersonation carries an unmistakable red hazard banner with a one-click termination trigger.

5. **Management Views (100% Real Backend Endpoints)**:
   - `/overview`: Infrastructure telemetry, active tenant and user counts, distributed worker daemon health.
   - `/tenants` & `/tenants/[id]`: Organization registry, subscription tier updates, suspension cascade.
   - `/users` & `/users/[id]`: Global user governance, 2FA status, force logout (token revocation), read-only impersonation.
   - `/workers`: Distributed cron engine, MongoDB lease locks, manual trigger dispatch, historical run telemetry.
   - `/audit`: WORM audit ledger, multi-parameter search, client-side streaming CSV export, SHA-256 chain verification.
   - `/system`: Fastify & MongoDB health probes, AI token consumption breakdown (Recharts), runtime feature flags.
   - `/settings`: Master password rotation (`POST /admin/auth/change-password`), 2FA re-enrollment, global session revocation.

## Scripts

```bash
# Run locally on port 3002
pnpm dev

# Unit tests
pnpm test:unit

# Playwright E2E test suite
pnpm test:e2e

# Production build
pnpm build
```
