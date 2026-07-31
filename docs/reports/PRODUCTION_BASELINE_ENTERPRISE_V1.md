# Production Baseline — Tender Briefing Enterprise v1

**Verdict:** PASS WITH CONDITIONS  
**Promoted:** 2026-07-31T18:22:44Z (UTC) / 2026-07-31T20:22:44+02:00 (SAST)

## Exact production SHA

| Field | Value |
|-------|--------|
| Certified & deployed SHA | `6e6597264faf4cfcd25c09060d93bc5e406c008b` |
| Annotated tag | `enterprise-v1.0.0` |
| Pre-deploy CI | [30645423935](https://github.com/tenderbriefing/tender/actions/runs/30645423935) — success |
| Deploy workflow | [30653868712](https://github.com/tenderbriefing/tender/actions/runs/30653868712) — success |
| Deploy event | `workflow_dispatch` on ref `enterprise-v1.0.0` |
| headSha of deploy | `6e6597264faf4cfcd25c09060d93bc5e406c008b` |

## Runtime evidence

| Field | Value |
|-------|--------|
| Cloud Run revision | `tenderbriefing-00089-zv9` |
| Traffic | **100%** on `tenderbriefing-00089-zv9` |
| Image digest | `africa-south1-docker.pkg.dev/tenderbriefing-34679/tenderbriefing/tenderbriefing@sha256:ad6eeb8c8afb86c9ae1aa61d1d3100cbb2c4e7cc190a862236828bceecf898b3` |
| Cloud Build ID (app) | `9584a63f-d07d-4160-a500-19f9eebecec7` (SUCCESS, 2026-07-31T18:10:13Z) |
| Revision ready | 2026-07-31T18:19:46Z |
| Firebase deploy | rules + indexes + storage + hosting — success in deploy job |
| Hosting proxy | europe-west1 rebuild — success |
| Health | `GET /api/health/firestore` → 200 `{status:ok,connected:true}` |
| Domains | www / apex / web.app → 200 |

## Auth / API smoke (automatable)

| Scenario | Result |
|----------|--------|
| `/auth/signin`, `/auth/signup` | 200 |
| `/tenders` desktop + mobile UA | 200 |
| `/sme/requests` | 200 (page; API still auth-gated) |
| `/bookings` | 307 redirect |
| `GET /api/tender-briefings` | 200 public |
| `GET /api/attendance-requests` unauth | 401 |
| `GET /api/admin/dashboard` unauth | 401 |
| `POST /api/bookings` | 404 production-blocked (intentional retirement) |
| Live registration / Google / session / cross-tenant UI | **MANUAL** — no `SMOKE_TEST_*` / `E2E_*_TOKEN` in execution environment |

## Rollback baseline

| Field | Value |
|-------|--------|
| Rollback tag | `enterprise-v1.0.0` → SHA `6e65972` |
| Prior known good (pre-enterprise programme) | `27a5463` |
| Procedure | `docs/runbooks/ROLLBACK.md` |
| Redeploy | Actions → Deploy TenderBriefing → Run workflow on tag `enterprise-v1.0.0` |

## Conditions / residuals

1. **P1:** Full authenticated UI E2E (registration, Google, session, cross-tenant UI) requires protected secrets / interactive IdP — not falsified.
2. Yoco create-checkout without Bearer returns **401** (middleware) rather than 410; authenticated path returns 410 — acceptable fail-closed.

## Certification documents

- `docs/reports/ENTERPRISE_CERTIFICATION_REPORT.md`
- `docs/reports/RELEASE_INTEGRITY_RECOVERY.md`
- `docs/reports/PRODUCTION_BASELINE_ENTERPRISE_V1.md` (this file)
- `docs/releases/REGISTRY.md`
