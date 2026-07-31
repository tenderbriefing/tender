# Rate Limiting

## Architecture

| Layer | Mechanism | Scope |
|-------|-----------|--------|
| Edge | Cloud Armor (provisioning steps below) | Volumetric / IP |
| Middleware | In-memory `lib/security/rateLimit.ts` | Best-effort per instance |
| API handlers | Firestore `rateLimitBuckets` via `distributedRateLimit` | Cross-instance |

## Policies

See `backend/services/security/distributedRateLimit.js` `POLICIES`.

PayFast ITN uses a high ceiling (600/min) so provider retries are not blocked.

## Cloud Armor provisioning (ops)

1. Attach Cloud Armor policy to HTTPS load balancer / Cloud Run frontend if used.
2. Baseline: 100 req/s/IP with ban on spike.
3. Exempt health check paths `/api/health/firestore`.
4. Alert on deny count.

Until Armor is attached, Firestore distributed limiter + middleware remain active application controls.
