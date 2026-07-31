# Rollback Runbook — Tender Briefing

## Last known good

| Label | SHA / tag |
|-------|-----------|
| **Current production baseline** | tag `enterprise-v1.0.0` → `6e6597264faf4cfcd25c09060d93bc5e406c008b` |
| Cloud Run revision (Enterprise v1) | `tenderbriefing-00089-zv9` @ 100% |
| Image digest | `sha256:ad6eeb8c8afb86c9ae1aa61d1d3100cbb2c4e7cc190a862236828bceecf898b3` |
| Pre enterprise programme | `27a5463ea2b10395f9963d16772264c256c22377` |
| Prior certification RC | `816433f42b3eb50448e07ad85e36ea53994597df` |

## Trigger conditions

- Sustained 5xx after deploy
- PayFast ITN mass reject after release
- Cross-tenant data exposure confirmed
- Auth outage attributable to release

## Responsible role

Release Manager / on-call SRE with Firebase + Cloud Run access.

## Sequence

1. Announce rollback in ops channel.
2. Redeploy via Actions → **Deploy TenderBriefing** → Run workflow → ref **`enterprise-v1.0.0`** (preferred) or last-good SHA.
3. If `firestore.rules` changed in bad release: deploy rules from last-good tree.
4. Do **not** reverse PayFast settlements in code — use merchant dashboard for refunds.
5. Confirm WhatsApp webhook enablement flag matches intended state.
6. Validate `/api/health/firestore` + smoke plan.
7. Record incident in `docs/releases/REGISTRY.md`.

## Compatibility notes (27a5463 ↔ current)

- No destructive Firestore migrations between `27a5463` and current RC.
- New fields (`lastTransition*`, rate limit buckets) are additive — safe to roll forward/back.
- Client cannot write privileged attendance fields after rules update — rolling rules back re-opens that risk (avoid unless necessary).

## Validation after rollback

1. `/api/health/firestore` → ok  
2. SME sign-in  
3. `/api/bookings` still intentional retirement behaviour for that SHA  
4. Create attendance request in sandbox  
5. ITN path healthy  

## Communication

Notify founders + support with SHA rolled back from/to and customer impact summary.
