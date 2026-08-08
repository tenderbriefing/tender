# Release Registry

| Version / tag | SHA | Deployed UTC | Workflow | Cloud Run revision | Status |
|---------------|-----|--------------|----------|-------------------|--------|
| `ocds-sync-88dd033` | `88dd0334445ff5af476d341184c8024c264dd2fe` | 2026-08-08T05:58:06Z | [31242228722](https://github.com/tenderbriefing/tender/actions/runs/31242228722) | `tenderbriefing-00105-7p7` (100%) | **Current production** — eTenders OCDS connect-timeout resilience (PR #23); YAW flag off; PI flags false |
| `footer-947b92e` | `947b92ec2b0719f439447b8d45b34d17c5be55f0` | 2026-08-07T16:15:33Z | [31195137719](https://github.com/tenderbriefing/tender/actions/runs/31195137719) | `tenderbriefing-00104-mf4` (100%) | Prior — compact public footer (PR #22); YAW flag off; PI flags false |
| `private-pay-689ea1d` | `689ea1d8326d7c329330289df23b2ebe98f4b80f` | 2026-08-07T12:19:34Z | [31176610573](https://github.com/tenderbriefing/tender/actions/runs/31176610573) | `tenderbriefing-00103-tqr` (100%) | Prior — private RFQ WhatsApp payment links + resume unpaid PayFast (PR #21); YAW flag off; PI flags false |
| `book-agent-537bda4` | `537bda44f041261238c3dacf532659e357584d39` | 2026-08-07T11:13:41Z | [31171963531](https://github.com/tenderbriefing/tender/actions/runs/31171963531) | `tenderbriefing-00102-hkn` (100%) | Prior — shareable SME `/sme/book-agent` funnel (PR #20); YAW flag off; PI flags false |
| `welcome-c1fe68e` | `c1fe68eede7be23d5057278a4a3a4e0fd0988195` | 2026-08-07T07:21:12Z | [31156377338](https://github.com/tenderbriefing/tender/actions/runs/31156377338) | `tenderbriefing-00101-25g` (100%) | Prior — post-registration welcome (PR #19); YAW flag off; PI flags false |
| `notify-ux-7eab86a` | `7eab86a7110f61d465e350b5b17fa081a5bd2005` | 2026-08-07T04:26:02Z | [31146427000](https://github.com/tenderbriefing/tender/actions/runs/31146427000) | `tenderbriefing-00100-zb2` (100%) | Prior — automation budget + founder/ops notify (RFQ/register/attendance) + youth agent registration cleanup; YAW flag off; PI flags false |
| `briefing-tz-2e72c6c` | `2e72c6ca4e001f08843e5511f00062f0b15d01d7` | 2026-08-05T18:02:33Z | [31031359926](https://github.com/tenderbriefing/tender/actions/runs/31031359926) | `tenderbriefing-00099-j82` (100%) | Prior — eTenders briefing times resolved as SA wall clock; YAW flag off; PI flags false |
| `yaw-v1-960441a` | `960441a01c7a782351a7d9bd008b929b9820dd63` | 2026-08-05T15:47:51Z | [31020326730](https://github.com/tenderbriefing/tender/actions/runs/31020326730) | `tenderbriefing-00098-ws7` | Prior — Youth Agent Workspace v1 code shipped; `youth_agent_workspace_v1` globally disabled (fail-closed); PI flags false |
| `briefing-cutoff-4d78d20` | `4d78d20d14ee2e997fe30c1473c5675552fa33a7` | 2026-08-03T18:58Z | [30842478067](https://github.com/tenderbriefing/tender/actions/runs/30842478067) | `tenderbriefing-00097-gd6` | Prior production (briefing-date public cutoff) |
| `pi-pilot-rules-a6d2b92` | `a6d2b922e634efc64e8ebe1b5886f4b46006a087` | 2026-08-03T12:59:28Z | [30814718880](https://github.com/tenderbriefing/tender/actions/runs/30814718880) | `tenderbriefing-00096-h4h` | Prior — PI pilot allow-list (2 UIDs via GSM); flags false; progress read rules fixed |
| `pi-pilot-3c177dd` | `3c177dd73595f3325672626603dbae4e06fd2063` | 2026-08-03T12:23Z | [30812294505](https://github.com/tenderbriefing/tender/actions/runs/30812294505) | (superseded; was `00091`–`00095` during revoke/restore) | Intermediate authenticated pilot image |
| `pi-phase1-91a7871` | `91a787103cef2f76372a47761ee65d944824199f` | 2026-08-02T18:18:39Z | [30760212862](https://github.com/tenderbriefing/tender/actions/runs/30760212862) | `tenderbriefing-00090-tgb` | Prior PI code (flags off, empty list) |
| `enterprise-v1.0.0` | `6e6597264faf4cfcd25c09060d93bc5e406c008b` | 2026-07-31T18:22:44Z | [30653868712](https://github.com/tenderbriefing/tender/actions/runs/30653868712) | `tenderbriefing-00089-zv9` | **Rollback baseline** (do not modify/delete tag) |

## Current production image (eTenders OCDS sync resilience)

| Field | Value |
|-------|--------|
| Image digest | `sha256:5caf7afc044663310e855bce2c7e35659ec4fe76cee5252f2a30b58472761123` |
| Cloud Build ID | `43784198-3ee9-4ec0-857f-dc7a70e2d656` |
| Merges | PR [#23](https://github.com/tenderbriefing/tender/pull/23) → tip `88dd033` |
| Pre-deploy CI | [31241953982](https://github.com/tenderbriefing/tender/actions/runs/31241953982) |
| YAW flag | `youth_agent_workspace_v1` — `YOUTH_AGENT_WORKSPACE_*` env **absent** (defaults false / empty; fail-closed) |
| PI flags | `PROCUREMENT_INTELLIGENCE_ENABLED` / `NEXT_PUBLIC_…` both **false** |
| Shipped | OCDS connect timeout 25s + 3× backoff retries for `ocds-api.etenders.gov.za` (PR #23). |

## Rollback target (enterprise-v1.0.0)

| Field | Value |
|-------|--------|
| Revision | `tenderbriefing-00089-zv9` |
| Image digest | `sha256:ad6eeb8c8afb86c9ae1aa61d1d3100cbb2c4e7cc190a862236828bceecf898b3` |
| Prior deploy | [30653868712](https://github.com/tenderbriefing/tender/actions/runs/30653868712) |
| PI-only kill | Replace GSM pilot secret with non-matching placeholder + `gcloud run services update --update-secrets=…:latest` (flags stay false) |
| YAW-only kill | Keep `YOUTH_AGENT_WORKSPACE_ENABLED` unset/false and leave pilot UIDs empty (already production posture) |
| Immediate prior | `tenderbriefing-00104-mf4` / `footer-947b92e` / digest `sha256:f74f964d6a0c2514c1416be43bf4bc7f7e03795a34bf3f5ba51c6524caf6f673` |
