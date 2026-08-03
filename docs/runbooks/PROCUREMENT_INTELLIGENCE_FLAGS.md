# Procurement Intelligence — Feature flags & pilot runbook

## Current production posture (certified 2026-08-03)

| Variable | Live value on `tenderbriefing-00090-tgb` |
|----------|------------------------------------------|
| `PROCUREMENT_INTELLIGENCE_ENABLED` | `false` |
| `NEXT_PUBLIC_PROCUREMENT_INTELLIGENCE_ENABLED` | `false` |
| `PROCUREMENT_INTELLIGENCE_PILOT_UIDS` | empty → **deny-all** for SMEs |

Approved pilot UID count = **0**. Do not invent UIDs for testing.

## Where to add pilot UIDs later

1. **Cloud Run env** (service `tenderbriefing`, region `africa-south1`): set `PROCUREMENT_INTELLIGENCE_PILOT_UIDS` to a comma-separated list of **real** Firebase Auth UIDs.
2. Prefer **Secret Manager** mount for the allow-list if the list must not appear in plain `gcloud run services describe` output; keep the same variable name.
3. Also update `cloudbuild.yaml` `--set-env-vars` only when intentionally baking the list into the next deploy — otherwise a redeploy from current cloudbuild will **clear** the list back to empty.

## Safe enable sequence (controlled pilot)

1. Confirm UIDs with founders / ops (written approval).
2. Set `PROCUREMENT_INTELLIGENCE_PILOT_UIDS=<uid1>,<uid2>` on Cloud Run (or Secret Manager).
3. Set `PROCUREMENT_INTELLIGENCE_ENABLED=true` on Cloud Run.
4. Set `NEXT_PUBLIC_PROCUREMENT_INTELLIGENCE_ENABLED=true` only if the SME UI panel should render (requires rebuild/redeploy for Next public env baked at build time).
5. Smoke as an allow-listed SME: `GET /api/procurement/intelligence/{tenderId}` with Bearer token → 200.
6. Confirm non-allow-listed SME → 403; disabled → 503; unauth → 401 (middleware).

## Kill switch

Set `PROCUREMENT_INTELLIGENCE_ENABLED=false` (and public flag false on next build). Empty the pilot list for deny-all. No percentage rollout knob exists — do not invent one.

## Never

- Global enable without explicit product decision  
- Invented / guessed pilot UIDs  
- Live PayFast as part of PI flag changes  
- Deleting tag `enterprise-v1.0.0`

## Related

- Architecture: `docs/architecture/PROCUREMENT_INTELLIGENCE_PHASE1.md`
- Certification: `docs/reports/PROCUREMENT_INTELLIGENCE_PHASE1_PILOT_CERTIFICATION.md`
- Rollback: `docs/runbooks/ROLLBACK.md`
