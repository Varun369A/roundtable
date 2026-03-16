# Sabha — Pre-Launch Security Audit Checklist

**Target: Zero known vulnerabilities before public launch**

---

## 1. Authentication & Session Management

- [x] Passwords hashed with bcrypt, 12 rounds
- [x] Constant-time login response (prevents timing-based user enumeration)
- [x] JWT access tokens expire in 15 minutes
- [x] Refresh token rotation — old token invalidated on use
- [x] Refresh token reuse detection (reuse → revoke all tokens for user)
- [x] Logout blacklists access token in Redis
- [x] `isRevoked` flag on refresh tokens in Postgres
- [ ] **TODO**: Add login attempt rate limiting per email (not just per IP)
- [ ] **TODO**: Account lockout after N failed attempts (e.g., 10 in 15 min)
- [ ] **TODO**: Email verification before full account access
- [ ] **TODO**: 2FA/TOTP option for admin accounts

## 2. Authorization

- [x] All task/billing routes behind `requireAuth` middleware
- [x] Task ownership verified before SSE stream access
- [x] Admin routes require `x-admin-secret` OR JWT + `isAdmin: true`
- [x] Plan limits enforced before task creation
- [x] Row-level ownership check: `{ userId }` filter on all Prisma queries
- [ ] **TODO**: Audit every admin route to ensure no privilege escalation path
- [ ] **TODO**: Verify Razorpay webhook signature on every webhook call
- [ ] **TODO**: Ensure `isAdmin` cannot be set via API by non-admins

## 3. Input Validation & Sanitization

- [x] Zod schemas on all request bodies
- [x] Task goal sanitized: null bytes, control chars, `<script>` tags stripped
- [x] Max goal length enforced (4000 chars)
- [x] Request body size limit: 1MB (Fastify `bodyLimit`)
- [x] Env vars validated with Zod on startup (crash fast if misconfigured)
- [ ] **TODO**: Validate file upload types and sizes in storage.ts
- [ ] **TODO**: Sanitize all user-generated content rendered in admin dashboard
- [ ] **TODO**: Ensure `originalGoal` is never executed as code anywhere

## 4. Transport Security

- [x] Helmet plugin — standard security headers
- [x] Content Security Policy configured
- [x] `X-Content-Type-Options: nosniff`
- [x] `X-Frame-Options: DENY`
- [x] `Referrer-Policy: strict-origin-when-cross-origin`
- [x] `Permissions-Policy` — restricts camera/mic/geolocation
- [x] CORS locked to specific origins via `CORS_ORIGINS` env var
- [ ] **TODO**: Enforce HTTPS-only (HSTS header) in production
- [ ] **TODO**: Set `Secure; HttpOnly; SameSite=Strict` on any future cookies
- [ ] **TODO**: Configure TLS 1.2+ minimum on load balancer / reverse proxy

## 5. Rate Limiting

- [x] Global rate limit: 200 req/min per IP
- [x] SSE endpoint: 10 connections/min per IP
- [x] Razorpay webhook: no rate limit needed (Razorpay controls)
- [ ] **TODO**: Tighter limit on POST /auth/login (e.g., 5/min per IP)
- [ ] **TODO**: Tighter limit on POST /auth/signup (e.g., 3/min per IP)
- [ ] **TODO**: Per-user authenticated rate limit (prevent token-farming abuse)

## 6. Secrets Management

- [x] All secrets via env vars (never in code)
- [x] `.gitignore` covers `.env` files
- [x] `ADMIN_SECRET` separate from JWT secret
- [ ] **TODO**: Rotate all API keys before launch
- [ ] **TODO**: Use a secrets manager (AWS Secrets Manager / Doppler) in prod
- [ ] **TODO**: Audit git history for any accidentally committed secrets (`git log -p | grep -i api_key`)
- [ ] **TODO**: Ensure `.env.example` contains NO real values — only placeholders

## 7. Dependency Security

Run these commands before launch:

```bash
# Check for known vulnerabilities
npm audit --audit-level=high

# Check for outdated packages with CVEs
npx depcheck

# Full transitive tree scan
npx better-npm-audit audit
```

- [ ] **TODO**: Run `npm audit` — fix all HIGH/CRITICAL
- [ ] **TODO**: Update BullMQ, Prisma, Fastify to latest stable
- [ ] **TODO**: Remove unused dependencies (reduces attack surface)

## 8. Database Security

- [x] Prisma ORM — parameterized queries by default (no SQL injection)
- [x] Raw SQL only used in admin analytics (read-only, no user input)
- [x] Cascade deletes configured correctly (no orphan data)
- [x] Composite indexes for performance (prevents DoS via slow queries)
- [ ] **TODO**: Postgres user should have LEAST PRIVILEGE (no superuser)
- [ ] **TODO**: Enable connection SSL in `DATABASE_URL` for production
- [ ] **TODO**: Set up Postgres connection pooling (PgBouncer) for scale
- [ ] **TODO**: Regular automated backups with point-in-time recovery

## 9. Infrastructure

- [ ] **TODO**: Run API behind a reverse proxy (Nginx/Caddy) — never expose Node directly
- [ ] **TODO**: Firewall: Redis and Postgres ports NOT exposed to internet
- [ ] **TODO**: Enable Cloudflare WAF in front of API
- [ ] **TODO**: DDoS protection via Cloudflare (plan: Pro or Business)
- [ ] **TODO**: Set up intrusion detection alerts (unusual spike in 4xx/5xx)
- [ ] **TODO**: Log aggregation — ship logs to Grafana / Loki / Datadog

## 10. Monitoring & Incident Response

- [x] `/metrics` endpoint (Prometheus-compatible) — protected by admin secret
- [x] `/health`, `/health/live`, `/health/ready` endpoints for load balancers
- [x] Circuit breakers on all AI connectors (fail fast, not cascade)
- [x] Graceful shutdown (SIGTERM) — drains in-flight requests before exit
- [x] BullMQ dead letter queue — failed jobs preserved for inspection
- [ ] **TODO**: Set up Grafana dashboard scraping `/metrics`
- [ ] **TODO**: Alert on `sabha_tasks_failed_total` spike > 10/min
- [ ] **TODO**: Alert on `sabha_ai_circuit_open` == 1 for critical models
- [ ] **TODO**: Alert on `http_req_failed rate > 5%` over 5 minutes
- [ ] **TODO**: PagerDuty or on-call rotation for critical alerts

## 11. AI-Specific Risks

- [x] User input translated to English before AI processing (controls blast radius)
- [x] AI outputs truncated to 2000 chars in SSE events (prevents oversized payloads)
- [x] No user-controlled prompt injection into system prompts
- [ ] **TODO**: Add output filtering for obviously harmful/illegal content
- [ ] **TODO**: Rate limit per user on AI-heavy endpoints (prevent bill farming)
- [ ] **TODO**: Budget alert: notify if daily AI spend exceeds $X

## 12. Compliance (India-specific)

- [ ] **TODO**: Privacy Policy in place before public launch
- [ ] **TODO**: Terms of Service covering AI-generated content
- [ ] **TODO**: Data residency consideration: where is PII stored?
- [ ] **TODO**: DPDP Act (India) compliance review for user data handling
- [ ] **TODO**: Razorpay KYC requirements for payment processing

---

## Quick-Run Security Commands

```bash
# 1. Dependency audit
cd sabha && npm audit --audit-level=high

# 2. Secrets scan (install truffleHog first)
trufflehog filesystem . --exclude-paths .gitignore

# 3. Check for open ports
nmap -sV localhost

# 4. Test rate limiting (should get 429 after 200 requests)
for i in {1..210}; do curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/health; done

# 5. Test auth brute force protection
for i in {1..10}; do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3001/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrongpass"}'
done

# 6. Verify CSP headers
curl -I http://localhost:3001/health | grep -i "content-security-policy"

# 7. Test that admin endpoint rejects unauthenticated requests
curl -s http://localhost:3001/api/v1/admin/analytics/overview
# Expected: 401 or 403

# 8. Test that metrics endpoint requires auth
curl -s http://localhost:3001/metrics
# Expected: 403 Forbidden (without x-admin-secret)
```

---

**Sign-off required from:** Engineering Lead, Security Review
**Target completion:** Before Month 10 soft beta launch
