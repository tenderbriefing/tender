# Release Registry

| Version / tag | SHA | Deployed UTC | Workflow | Cloud Run revision | Status |
|---------------|-----|--------------|----------|-------------------|--------|
| `pi-phase1-91a7871` | `91a787103cef2f76372a47761ee65d944824199f` | 2026-08-02T18:18:39Z | [30760212862](https://github.com/tenderbriefing/tender/actions/runs/30760212862) | `tenderbriefing-00090-tgb` (100%) | **Current production** — PI Phase 1 code live; feature flags **disabled**; pilot UIDs empty |
| `enterprise-v1.0.0` | `6e6597264faf4cfcd25c09060d93bc5e406c008b` | 2026-07-31T18:22:44Z | [30653868712](https://github.com/tenderbriefing/tender/actions/runs/30653868712) | `tenderbriefing-00089-zv9` | Rollback baseline (tag retained; do not modify/delete) |

## PI Phase 1 production image (2026-08-02)

| Field | Value |
|-------|--------|
| Image tag | `africa-south1-docker.pkg.dev/tenderbriefing-34679/tenderbriefing/tenderbriefing:44c4a235-fac9-4d1c-82b0-5513686161ef` |
| Image digest | `sha256:529cb09dedaf730cb1da0a81b0551d33929d23c0f12949d30d11eac3a1287e3b` |
| Cloud Build ID | `44c4a235-fac9-4d1c-82b0-5513686161ef` |
| Post-merge CI | [30759869282](https://github.com/tenderbriefing/tender/actions/runs/30759869282) SUCCESS |
| Certification | `docs/reports/PROCUREMENT_INTELLIGENCE_PHASE1_PILOT_CERTIFICATION.md` |

## Rollback target (enterprise-v1.0.0)

| Field | Value |
|-------|--------|
| Revision | `tenderbriefing-00089-zv9` |
| Image digest | `sha256:ad6eeb8c8afb86c9ae1aa61d1d3100cbb2c4e7cc190a862236828bceecf898b3` |
| Prior deploy | [30653868712](https://github.com/tenderbriefing/tender/actions/runs/30653868712) |
