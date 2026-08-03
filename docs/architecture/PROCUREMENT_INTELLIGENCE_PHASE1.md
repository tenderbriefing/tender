# Procurement Intelligence Phase 1

## Purpose

Transform tender listings into explainable SME decision support: what the tender is, eligibility signals, opportunity fit, compliance checklist, and next actions.

**Not** award probability. **Never** definitive eligibility claims.

## Feature flags (fail-closed)

| Variable | Role |
|----------|------|
| `PROCUREMENT_INTELLIGENCE_ENABLED` | Global enablement (`false` = not globally on) |
| `NEXT_PUBLIC_PROCUREMENT_INTELLIGENCE_ENABLED` | Advisory client mirror only — must not authorize |
| `PROCUREMENT_INTELLIGENCE_PILOT_UIDS` | Comma-separated approved Firebase Auth UIDs; **pilot path works while ENABLED=false**; empty = deny-all |

Default: **disabled** globally. Empty pilot list is fail-closed (deny everyone when flag false).
To activate authenticated pilots **without** global enable: keep both flags `false`, set `PROCUREMENT_INTELLIGENCE_PILOT_UIDS` via Secret Manager (`procurement-intelligence-pilot-uids`) to approved Firebase Auth UIDs — never invent UIDs. SME panel appears when the authenticated API returns 200 for that user.

## Architecture

1. Listing fields → `extractStructuredFacts`
2. SME profile (`users`) → `assessEligibility`
3. Deterministic `computeOpportunityFit` (versioned rules)
4. Checklist + missing docs + recommended actions
5. `GET /api/procurement/intelligence/[tenderId]` (SME/admin Bearer)
6. UI: `SmeProcurementIntelligencePanel` on tender detail

Trust: server authz; pilot check; no client role trust. Tender documents treated as untrusted input (Phase 1 uses structured listing fields, not free-form LLM override of system rules).

## Data

- Source truth: `tenderBriefings` (immutable from this feature)
- Optional user progress: `smeTenderIntelligence/{smeId}/tenders/{tenderId}` (rules: owner SME/admin only)

## Rollback

1. Set flags to `false` (kill switch).
2. Redeploy previous revision if needed.
3. Platform rollback target for the PI Phase 1 production deploy: tag `enterprise-v1.0.0` / SHA `6e65972` / historical revision `tenderbriefing-00089-zv9` (see `docs/runbooks/ROLLBACK.md`).
4. Current production (code present, flags off): tag `pi-phase1-91a7871` / SHA `91a7871` / revision `tenderbriefing-00090-tgb`.

## Scoring

`Opportunity Fit` 0–100 — factors listed in response. Rules version: `opportunity-fit-1.0.0`.
