# Release Registry

| Version / tag | SHA | Deployed UTC | Workflow | Cloud Run revision | Status |
|---------------|-----|--------------|----------|-------------------|--------|
| `pi-pilot-3c177dd` | `3c177dd73595f3325672626603dbae4e06fd2063` | 2026-08-03T12:23:05Z (app) / 12:30:26Z (post revoke-restore) | [30812294505](https://github.com/tenderbriefing/tender/actions/runs/30812294505) | `tenderbriefing-00095-g97` (100%) | **Current production** — PI pilot allow-list active (2 UIDs via GSM); **both global flags false** |
| `pi-phase1-91a7871` | `91a787103cef2f76372a47761ee65d944824199f` | 2026-08-02T18:18:39Z | [30760212862](https://github.com/tenderbriefing/tender/actions/runs/30760212862) | `tenderbriefing-00090-tgb` | Prior PI code deploy (flags off, empty list) |
| `enterprise-v1.0.0` | `6e6597264faf4cfcd25c09060d93bc5e406c008b` | 2026-07-31T18:22:44Z | [30653868712](https://github.com/tenderbriefing/tender/actions/runs/30653868712) | `tenderbriefing-00089-zv9` | **Rollback baseline** (do not modify/delete tag) |

## Current production image (authenticated pilot)

| Field | Value |
|-------|--------|
| Image digest | `sha256:fd66ab379a202aec3f182a0479f3eae96b073c8bcef21d7f29532a079627b866` |
| Cloud Build ID | `9625b2fd-aefc-474e-bdbc-007117841557` |
| Post-merge CI | [30812281032](https://github.com/tenderbriefing/tender/actions/runs/30812281032) SUCCESS |
| Pilot secret | `procurement-intelligence-pilot-uids` (count **2**) |
| Results | `docs/reports/PROCUREMENT_INTELLIGENCE_PILOT_RESULTS.md` |
| Baseline sheet | `docs/reports/PRODUCTION_BASELINE_PI_PILOT_3C177DD.md` |

## Rollback target (enterprise-v1.0.0)

| Field | Value |
|-------|--------|
| Revision | `tenderbriefing-00089-zv9` |
| Image digest | `sha256:ad6eeb8c8afb86c9ae1aa61d1d3100cbb2c4e7cc190a862236828bceecf898b3` |
| Prior deploy | [30653868712](https://github.com/tenderbriefing/tender/actions/runs/30653868712) |
| PI-only kill | Replace GSM pilot secret with non-matching placeholder + `gcloud run services update --update-secrets=…:latest` (flags stay false) |
