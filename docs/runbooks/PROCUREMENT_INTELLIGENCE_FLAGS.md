# Procurement Intelligence — Feature flags & pilot runbook

## Semantics (certified pilot-with-flags-false)

| Variable | Meaning |
|----------|---------|
| `PROCUREMENT_INTELLIGENCE_ENABLED` | **Global** enablement. Keep `false` for pilot-only. |
| `NEXT_PUBLIC_PROCUREMENT_INTELLIGENCE_ENABLED` | Advisory UI mirror only. Keep `false` for pilot-only. Panel also appears when authenticated API returns **200**. |
| `PROCUREMENT_INTELLIGENCE_PILOT_UIDS` | Exact Firebase Auth UIDs. Non-empty list grants those UIDs access **even when both flags are false**. Empty + flags false = deny-all. |

Production mounts UIDs from Secret Manager: `procurement-intelligence-pilot-uids` → env `PROCUREMENT_INTELLIGENCE_PILOT_UIDS` (see `cloudbuild.yaml`).

## Safe activate sequence (authenticated pilot, flags stay false)

1. Confirm identities are internal/ops-smoke/synthetic test accounts (not ordinary customers without approval).
2. Write comma-separated UIDs to GSM secret `procurement-intelligence-pilot-uids` (never commit UIDs).
3. Keep `PROCUREMENT_INTELLIGENCE_ENABLED=false` and `NEXT_PUBLIC_…=false`.
4. Deploy (or restart revision) so Cloud Run picks up the secret.
5. Smoke: allow-listed user → `GET /api/procurement/intelligence/{tenderId}` Bearer → **200**.
6. Non-allow-listed authenticated SME → **403**; unauth → **401**; empty secret + flags false → **503**.

## Kill switch

1. Clear / empty the GSM secret version (or add an empty version) and redeploy/restart, **or**
2. Temporarily remove the secret binding and set empty env (prefer secret empty).
3. Confirm former pilots get 403/503. Flags may remain `false`.

## Redeploy note

`cloudbuild.yaml` binds the secret by name — redeploys do **not** wipe the allow-list as long as the secret retains approved UIDs. Do not put real UIDs in git.

## Never

- Global enable without explicit product decision  
- Invented / guessed pilot UIDs  
- Ordinary customers as pilots without documented approval  
- Live PayFast as part of PI flag changes  
- Deleting tag `enterprise-v1.0.0`

## Related

- Architecture: `docs/architecture/PROCUREMENT_INTELLIGENCE_PHASE1.md`
- Certification: `docs/reports/PROCUREMENT_INTELLIGENCE_PHASE1_PILOT_CERTIFICATION.md`
- Rollback: `docs/runbooks/ROLLBACK.md`
