# Release Registry

| Version / tag | SHA | Deployed UTC | Workflow | Cloud Run revision | Status |
|---------------|-----|--------------|----------|-------------------|--------|
| `pi-pilot-rules-a6d2b92` | `a6d2b922e634efc64e8ebe1b5886f4b46006a087` | 2026-08-03T12:59:28Z | [30814718880](https://github.com/tenderbriefing/tender/actions/runs/30814718880) | `tenderbriefing-00096-h4h` (100%) | **Current production** — PI pilot allow-list (2 UIDs via GSM); flags false; progress read rules fixed |
| `pi-pilot-3c177dd` | `3c177dd73595f3325672626603dbae4e06fd2063` | 2026-08-03T12:23Z | [30812294505](https://github.com/tenderbriefing/tender/actions/runs/30812294505) | (superseded; was `00091`–`00095` during revoke/restore) | Intermediate authenticated pilot image |
| `pi-phase1-91a7871` | `91a787103cef2f76372a47761ee65d944824199f` | 2026-08-02T18:18:39Z | [30760212862](https://github.com/tenderbriefing/tender/actions/runs/30760212862) | `tenderbriefing-00090-tgb` | Prior PI code (flags off, empty list) |
| `enterprise-v1.0.0` | `6e6597264faf4cfcd25c09060d93bc5e406c008b` | 2026-07-31T18:22:44Z | [30653868712](https://github.com/tenderbriefing/tender/actions/runs/30653868712) | `tenderbriefing-00089-zv9` | **Rollback baseline** (do not modify/delete tag) |

## Current production image (authenticated pilot)

| Field | Value |
|-------|--------|
| Image digest | `sha256:853b9d5e003f60c7a6f02295a520b031132254032c43ebd4b19642c24e1954d5` |
| Cloud Build ID | `04107842-040e-4bc0-980f-fdd1bc2d4d04` |
| Pilot secret | `procurement-intelligence-pilot-uids` (count **2**) |
| Flags | both **false** |
| Results | `docs/reports/PROCUREMENT_INTELLIGENCE_PILOT_RESULTS.md` |
| Baseline sheet | `docs/reports/PRODUCTION_BASELINE_PI_PILOT_A6D2B92.md` |
| Certification | `docs/reports/PROCUREMENT_INTELLIGENCE_PHASE1_PILOT_CERTIFICATION.md` |

## Rollback target (enterprise-v1.0.0)

| Field | Value |
|-------|--------|
| Revision | `tenderbriefing-00089-zv9` |
| Image digest | `sha256:ad6eeb8c8afb86c9ae1aa61d1d3100cbb2c4e7cc190a862236828bceecf898b3` |
| Prior deploy | [30653868712](https://github.com/tenderbriefing/tender/actions/runs/30653868712) |
| PI-only kill | Replace GSM pilot secret with non-matching placeholder + `gcloud run services update --update-secrets=…:latest` (flags stay false) |
