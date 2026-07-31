# Phase 0 — Baseline & Change Control

**Captured:** 2026-07-31  
**Starting SHA (pre-programme):** `27a5463ea2b10395f9963d16772264c256c22377`  
**Batch 0 SHA (prior audit refactor committed):** `d228dc663d4e958407f1e545f9ca8af6fd895848`

## Git integrity

| Field | Value |
|-------|--------|
| Branch | `master` |
| Upstream | `origin/master` (was in sync at baseline; Batch 0 ahead by 1) |
| Node | v26.5.0 local / Node 20 CI & Docker |
| npm | 11.17.0 |
| Package | `tenderbriefing@0.1.0` |
| Next.js | 14.0.4 |
| React | 18 |
| Firebase client | ^9.23.0 |
| Firebase Admin | ^12.7.0 |

## Working-tree classification (pre Batch 0)

All uncommitted changes from the prior security audit were classified **intended** and committed as Batch 0:

- PDF ownership, calendar admin gates, bookings 410, dead UI deletion, booking copy, smoke password requirement, README/package alignment.

No unrelated, generated, or unknown dirty files remained after Batch 0.

## Framework & deploy

- Next.js App Router, `output: 'standalone'`, Cloud Run (`africa-south1`) + Firebase Hosting proxy (`europe-west1`)
- Production: https://www.tenderbriefing.co.za / https://tenderbriefing.co.za / https://tenderbriefing-34679.web.app/
- Workflows: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`
- Secrets: Google Secret Manager mounted in Cloud Build

## Verification at baseline

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | Pass |
| `npm run lint` | No ESLint config (interactive prompt) |
| Unit/integration suite | Absent (QA scripts only) |
| CI | `qa:firestore-rules` + `qa:google-auth` only |

## Highest-risk gaps (pre-programme)

1. **P0** — SME client Firestore updates can touch privileged attendance fields (payment/assignment/status)
2. **P0** — No automated PayFast / IDOR / lifecycle unit tests
3. **P0** — Firebase web config hardcoded fallback; production should fail closed without env
4. **P1** — WhatsApp POST webhook unsigned
5. **P1** — CI missing typecheck/lint/build/tests
6. **P1** — Next 14.0.4 / Firebase 9 advisories
7. **P1** — In-memory rate limiter only (best-effort on multi-instance Cloud Run)
8. **P2** — Dual runtime (typed App Router + `require()` backend JS)
9. **P2** — Legacy Yoco/booking/matching surfaces still in tree

## Production URL / env inventory

Environment variable **names only** documented in `docs/operations/ENVIRONMENT_VARIABLES.md` (created in Batch 1/6). Never commit values.
