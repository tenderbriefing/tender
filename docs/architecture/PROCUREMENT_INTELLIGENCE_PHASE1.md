# Procurement Intelligence Phase 1

## Purpose

Transform tender listings into explainable SME decision support: what the tender is, eligibility signals, opportunity fit, compliance checklist, and next actions.

**Not** award probability. **Never** definitive eligibility claims.

## Feature flags (fail-closed)

| Variable | Role |
|----------|------|
| `PROCUREMENT_INTELLIGENCE_ENABLED` | Server API gate |
| `NEXT_PUBLIC_PROCUREMENT_INTELLIGENCE_ENABLED` | Client UI visibility |
| `PROCUREMENT_INTELLIGENCE_PILOT_UIDS` | Optional SME allow-list |

Default: **disabled**. Enable for pilot only.

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
3. Production baseline remains `enterprise-v1.0.0` / `6e65972`.

## Scoring

`Opportunity Fit` 0–100 — factors listed in response. Rules version: `opportunity-fit-1.0.0`.
