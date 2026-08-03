# Rollback Runbook — Tender Briefing

## Last known good

| Label | SHA / tag |
|-------|-----------|
| **Current production** | tag `pi-pilot-rules-a6d2b92` → `a6d2b922e634efc64e8ebe1b5886f4b46006a087` |
| Cloud Run revision (current) | `tenderbriefing-00096-h4h` @ 100% |
| Image digest (current) | `sha256:853b9d5e003f60c7a6f02295a520b031132254032c43ebd4b19642c24e1954d5` |
| Prior authenticated pilot app | `pi-pilot-3c177dd` / `tenderbriefing-00095-g97` |
| **Rollback baseline** | tag `enterprise-v1.0.0` → `6e6597264faf4cfcd25c09060d93bc5e406c008b` |
| Cloud Run revision (Enterprise v1) | `tenderbriefing-00089-zv9` |
| Image digest (Enterprise v1) | `sha256:ad6eeb8c8afb86c9ae1aa61d1d3100cbb2c4e7cc190a862236828bceecf898b3` |
| Prior deploy (Enterprise v1) | [30653868712](https://github.com/tenderbriefing/tender/actions/runs/30653868712) |
| Pre enterprise programme | `27a5463ea2b10395f9963d16772264c256c22377` |
| Prior certification RC | `816433f42b3eb50448e07ad85e36ea53994597df` |

**Do not modify or delete tag `enterprise-v1.0.0`.**

## Trigger conditions

- Sustained 5xx after deploy
- PayFast ITN mass reject after release
- Cross-tenant data exposure confirmed
- Auth outage attributable to release
- Unintended PI global enable / data leakage via intelligence APIs

## Responsible role

Release Manager / on-call SRE with Firebase + Cloud Run access.

## Sequence

1. Announce rollback in ops channel.
2. **PI-only incident (preferred first):** keep both global flags `false`; write non-matching placeholder UID to GSM `procurement-intelligence-pilot-uids` (empty payloads rejected) and `gcloud run services update --update-secrets=PROCUREMENT_INTELLIGENCE_PILOT_UIDS=procurement-intelligence-pilot-uids:latest` — see `docs/runbooks/PROCUREMENT_INTELLIGENCE_FLAGS.md`.
3. **Full app rollback:** Redeploy via Actions → **Deploy TenderBriefing** → Run workflow → ref **`enterprise-v1.0.0`** (preferred) or SHA `6e6597264faf4cfcd25c09060d93bc5e406c008b`.
4. Optional: shift Cloud Run traffic to revision `tenderbriefing-00089-zv9` if that revision is still retained and image matches digest above.
5. If `firestore.rules` changed in bad release: deploy rules from last-good tree.
6. Do **not** reverse PayFast settlements in code — use merchant dashboard for refunds.
7. Confirm WhatsApp webhook enablement flag matches intended state.
8. Validate `/api/health/firestore` + smoke plan.
9. Record incident in `docs/releases/REGISTRY.md`.

## Compatibility notes (27a5463 ↔ current)

- No destructive Firestore migrations between `27a5463` and current RC.
- New fields (`lastTransition*`, rate limit buckets, `smeTenderIntelligence`) are additive — safe to roll forward/back for app code; rolling rules back may re-open privileges (avoid unless necessary).
- Client cannot write privileged attendance fields after rules update — rolling rules back re-opens that risk (avoid unless necessary).

## Validation after rollback

1. `/api/health/firestore` → ok  
2. SME sign-in  
3. `/api/bookings` still intentional retirement behaviour for that SHA  
4. Create attendance request in sandbox  
5. ITN path healthy  
6. If PI was the trigger: unauth `/api/procurement/intelligence/*` remains fail-closed  

## Communication

Notify founders + support with SHA rolled back from/to and customer impact summary.
