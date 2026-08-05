# Release Registry

| Version / tag | SHA | Deployed UTC | Workflow | Cloud Run revision | Status |
|---------------|-----|--------------|----------|-------------------|--------|
| `yaw-v1-960441a` | `960441a01c7a782351a7d9bd008b929b9820dd63` | 2026-08-05T15:47:51Z | [31020326730](https://github.com/tenderbriefing/tender/actions/runs/31020326730) | `tenderbriefing-00098-ws7` (100%) | **Current production** — Youth Agent Workspace v1 code shipped; `youth_agent_workspace_v1` globally disabled (fail-closed); PI flags false |
| `briefing-cutoff-4d78d20` | `4d78d20d14ee2e997fe30c1473c5675552fa33a7` | 2026-08-03T18:58Z | [30842478067](https://github.com/tenderbriefing/tender/actions/runs/30842478067) | `tenderbriefing-00097-gd6` | Prior production (briefing-date public cutoff) |
| `pi-pilot-rules-a6d2b92` | `a6d2b922e634efc64e8ebe1b5886f4b46006a087` | 2026-08-03T12:59:28Z | [30814718880](https://github.com/tenderbriefing/tender/actions/runs/30814718880) | `tenderbriefing-00096-h4h` | Prior — PI pilot allow-list (2 UIDs via GSM); flags false; progress read rules fixed |
| `pi-pilot-3c177dd` | `3c177dd73595f3325672626603dbae4e06fd2063` | 2026-08-03T12:23Z | [30812294505](https://github.com/tenderbriefing/tender/actions/runs/30812294505) | (superseded; was `00091`–`00095` during revoke/restore) | Intermediate authenticated pilot image |
| `pi-phase1-91a7871` | `91a787103cef2f76372a47761ee65d944824199f` | 2026-08-02T18:18:39Z | [30760212862](https://github.com/tenderbriefing/tender/actions/runs/30760212862) | `tenderbriefing-00090-tgb` | Prior PI code (flags off, empty list) |
| `enterprise-v1.0.0` | `6e6597264faf4cfcd25c09060d93bc5e406c008b` | 2026-07-31T18:22:44Z | [30653868712](https://github.com/tenderbriefing/tender/actions/runs/30653868712) | `tenderbriefing-00089-zv9` | **Rollback baseline** (do not modify/delete tag) |

## Current production image (Youth Agent Workspace v1 — fail-closed)

| Field | Value |
|-------|--------|
| Image digest | `sha256:0f4a46945d1fabfce184fddaba2d53f0d455430e3909db3524e9ff379690a14f` |
| Cloud Build ID | `19c12724-4044-4f92-8985-cde4c098951d` |
| Merge | PR [#13](https://github.com/tenderbriefing/tender/pull/13) → `960441a` |
| Pre-deploy CI | [31019144977](https://github.com/tenderbriefing/tender/actions/runs/31019144977) |
| YAW flag | `youth_agent_workspace_v1` — `YOUTH_AGENT_WORKSPACE_*` env **absent** (defaults false / empty; fail-closed) |
| PI flags | `PROCUREMENT_INTELLIGENCE_ENABLED` / `NEXT_PUBLIC_…` both **false** |
| Certification | `docs/reports/YOUTH_AGENT_WORKSPACE_V1_CERTIFICATION.md` |

## Rollback target (enterprise-v1.0.0)

| Field | Value |
|-------|--------|
| Revision | `tenderbriefing-00089-zv9` |
| Image digest | `sha256:ad6eeb8c8afb86c9ae1aa61d1d3100cbb2c4e7cc190a862236828bceecf898b3` |
| Prior deploy | [30653868712](https://github.com/tenderbriefing/tender/actions/runs/30653868712) |
| PI-only kill | Replace GSM pilot secret with non-matching placeholder + `gcloud run services update --update-secrets=…:latest` (flags stay false) |
| YAW-only kill | Keep `YOUTH_AGENT_WORKSPACE_ENABLED` unset/false and leave pilot UIDs empty (already production posture) |
