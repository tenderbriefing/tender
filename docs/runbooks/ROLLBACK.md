# Rollback Runbook — Tender Briefing

## Last known good

| Label | SHA |
|-------|-----|
| Pre enterprise programme | `27a5463ea2b10395f9963d16772264c256c22377` |
| Prior certification RC | `816433f42b3eb50448e07ad85e36ea53994597df` |
| Last CI-green release candidate (pre this certify commit) | `5e2811c4f7a73b42a3ce579823a3f7e5052d557a` |

## Trigger conditions

- Sustained 5xx after deploy
- PayFast ITN mass reject after release
- Cross-tenant data exposure confirmed
- Auth outage attributable to release

## Responsible role

Release Manager / on-call SRE with Firebase + Cloud Run access.

## Sequence (no production mutation during dry-run validation)

1. Announce rollback in ops channel.
2. Identify unhealthy Cloud Run revision vs last known good image digest / git SHA.
3. Redeploy last known good SHA via GitHub Actions `Deploy TenderBriefing` workflow_dispatch or `git checkout <sha>` + controlled CI deploy.
4. If `firestore.rules` changed in bad release: `firebase deploy --only firestore:rules` from last-good tree.
5. Do **not** reverse PayFast settlements in code — use merchant dashboard for refunds.
6. Confirm WhatsApp webhook enablement flag matches intended state.
7. Validate health + smoke plan.

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
