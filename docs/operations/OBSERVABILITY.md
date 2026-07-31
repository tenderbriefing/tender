# Observability Guide

## Structured logs

Use `lib/observability/logger.ts` `logEvent()`. Critical events include:

- `itn_received` / `itn_accepted` / `itn_rejected` / `duplicate_itn_ignored`
- `webhook_rejected`
- Auth success/failure (handlers)
- Attendance transitions (domain layer callers)
- PDF download (handlers)

## Recommended dashboards

1. ITN accept vs reject rate
2. Payment pending older than 30m
3. Auth 401/403 spikes
4. Cloud Run latency / error rate
5. Firestore rule denial metrics (if exported)

## Recommended alerts

1. ITN reject rate > threshold
2. `/api/health/firestore` failing
3. Cloud Run 5xx
4. WhatsApp webhook disabled unexpectedly (if enabled in prod)

## Gaps

Central APM/trace product not provisioned in this sprint — Cloud Logging remains source of truth.
