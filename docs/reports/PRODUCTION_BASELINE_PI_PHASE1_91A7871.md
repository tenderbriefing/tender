# Production baseline — Procurement Intelligence Phase 1 (code present, disabled)

| Field | Value |
|-------|--------|
| Git SHA | `91a787103cef2f76372a47761ee65d944824199f` |
| Annotated deploy tag | `pi-phase1-91a7871` |
| Prior baseline (rollback) | `enterprise-v1.0.0` / `6e6597264faf4cfcd25c09060d93bc5e406c008b` |
| Deploy event | `workflow_dispatch` on ref `pi-phase1-91a7871` |
| Workflow run | [30760212862](https://github.com/tenderbriefing/tender/actions/runs/30760212862) |
| Cloud Build ID | `44c4a235-fac9-4d1c-82b0-5513686161ef` |
| Cloud Run revision | `tenderbriefing-00090-tgb` (100% traffic) |
| Image | `africa-south1-docker.pkg.dev/tenderbriefing-34679/tenderbriefing/tenderbriefing@sha256:529cb09dedaf730cb1da0a81b0551d33929d23c0f12949d30d11eac3a1287e3b` |
| Firestore rules | Released in Firebase deploy job (success) |
| Firestore indexes | Deployed from `firestore.indexes.json` (success) |
| Feature flags | PI global **false**; pilot UIDs **empty** |
| Health | `/api/health/firestore` → 200 ok/connected |
| Deploy completed UTC | 2026-08-02T18:18:39Z |

See also: `docs/reports/PROCUREMENT_INTELLIGENCE_PHASE1_PILOT_CERTIFICATION.md`, `docs/releases/REGISTRY.md`, `docs/runbooks/ROLLBACK.md`.
