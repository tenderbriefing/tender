# Release Registry

| Version / tag | SHA | Deployed UTC | Workflow | Cloud Run revision | Status |
|---------------|-----|--------------|----------|-------------------|--------|
| `pi-pilot-rules-a6d2b92` | `a6d2b922e634efc64e8ebe1b5886f4b46006a087` | 2026-08-03T12:59:28Z | [30814718880](https://github.com/tenderbriefing/tender/actions/runs/30814718880) | `tenderbriefing-00096-h4h` (100%) | **Current production** — PI pilot (2 GSM UIDs); flags **false**; SME progress read rules fixed |
| `pi-pilot-3c177dd` | `3c177dd73595f3325672626603dbae4e06fd2063` | 2026-08-03T12:23:05Z | [30812294505](https://github.com/tenderbriefing/tender/actions/runs/30812294505) | `tenderbriefing-00095-g97` (post revoke/restore) | Prior authenticated-pilot app image |
| `pi-phase1-91a7871` | `91a787103cef2f76372a47761ee65d944824199f` | 2026-08-02T18:18:39Z | [30760212862](https://github.com/tenderbriefing/tender/actions/runs/30760212862) | `tenderbriefing-00090-tgb` | Prior PI code (empty allow-list) |
| `enterprise-v1.0.0` | `6e6597264faf4cfcd25c09060d93bc5e406c008b` | 2026-07-31T18:22:44Z | [30653868712](https://github.com/tenderbriefing/tender/actions/runs/30653868712) | `tenderbriefing-00089-zv9` | **Rollback baseline** (do not modify/delete) |

## Current production image

| Field | Value |
|-------|--------|
| Image digest | `sha256:853b9d5e003f60c7a6f02295a520b031132254032c43ebd4b19642c24e1954d5` |
| Cloud Build ID | `04107842-040e-4bc0-980f-fdd1bc2d4d04` |
| CI on tip | [30814049322](https://github.com/tenderbriefing/tender/actions/runs/30814049322) (PR #11) |
| Pilot secret | `procurement-intelligence-pilot-uids` (**2** UIDs) |
| Results | `docs/reports/PROCUREMENT_INTELLIGENCE_PILOT_RESULTS.md` |

## Rollback

| Target | Value |
|--------|--------|
| Tag / SHA | `enterprise-v1.0.0` / `6e65972` |
| Revision / digest | `tenderbriefing-00089-zv9` / `sha256:ad6eeb8c8afb86c9ae1aa61d1d3100cbb2c4e7cc190a862236828bceecf898b3` |
| PI-only kill | GSM placeholder UID + bump secret mount; keep flags false |
