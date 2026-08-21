# Briefing AI Meeting Minutes — Production Release Certification

**Date:** 2026-08-21  
**Product URL:** https://www.tenderbriefing.co.za  
**Updated:** OpenAI GSM binding fix in progress / see Release table

---

## Executive Verdict

**PASS WITH CONDITIONS**

| Layer | Status |
|-------|--------|
| CODE VERIFIED | **PASS** (PR #47 CI green; BI suite 61/61) |
| DEPLOYMENT VERIFIED | **PASS** for app + flags; OpenAI secret remount pending merge of binding fix |
| OPENAI SECRET BINDING | **FIXED IN CONFIG** (`OPENAI_API_KEY` ← `Open_ai_Secret_Key:latest`); IAM confirmed; awaiting deploy verification |
| REAL PRODUCTION WORKFLOW VERIFIED | **NOT COMPLETE** — awaiting authorised live Youth Agent Whisper+report smoke |

**Not** declared `PRODUCTION CERTIFIED` until genuine audio → Whisper → AI report → Founder approve succeeds in production.

---

## Release

| Item | Value |
|------|-------|
| Feature PR | [#47](https://github.com/tenderbriefing/tender/pull/47) |
| Certified source SHA (feature) | `1643434b76e5700af04963c1dc18fde1aea25f3a` |
| Merge SHA (PR #47) | `0d71d9b09e1012c2af9bc4147c1acaa59ff8c004` |
| First production deploy (PR #47) | [32472467320](https://github.com/tenderbriefing/tender/actions/runs/32472467320) |
| Ops flags (without OpenAI) | PR #49 / #50 → tip `5c6ea95…` deploy [32478037350](https://github.com/tenderbriefing/tender/actions/runs/32478037350) |
| OpenAI binding fix | Branch `fix/openai-production-secret-binding` — mounts `OPENAI_API_KEY=Open_ai_Secret_Key:latest` |
| Prior failed mount | PR #48 attempted wrong name `openai-api-key:latest` |
| Production URL | https://www.tenderbriefing.co.za |

---

## Secret Manager (no secret values)

| Item | Status |
|------|--------|
| Secret id | `Open_ai_Secret_Key` |
| Version | `1` **enabled** (`latest` resolves) |
| Wrong name | `openai-api-key` does **not** apply to production |
| Runtime env | `OPENAI_API_KEY` |
| Cloud Run SA | `9058655644-compute@developer.gserviceaccount.com` |
| IAM | `roles/secretmanager.secretAccessor` on secret (compute + Cloud Build SA) |
| Mount | `OPENAI_API_KEY=Open_ai_Secret_Key:latest` via `cloudbuild.yaml` `--set-secrets` |

---

## Feature Flags

| Flag | State |
|------|-------|
| `BRIEFING_AUDIO_TRANSCRIPTION_ENABLED` | `true` |
| `BRIEFING_AI_REPORT_GENERATION_ENABLED` | `true` |
| `BRIEFING_REPORT_PROMPT_VERSION` | `v1` |

---

## Production Health (baseline)

| Check | Result |
|-------|--------|
| Homepage / tenders / auth | PASS |
| `/api/health/firestore` | PASS |
| YA / Founder routes load | PASS |
| Anonymous BI APIs | PASS (401) |

---

## Real Whisper / Attendance / AI Report / Founder

| Check | Result |
|-------|--------|
| Authorised YA live smoke | **NOT RUN** — AWAITING AUTHORISED REAL YOUTH AGENT SMOKE |
| Whisper / attendance / AI / Founder approve | **NOT RUN** |

---

## Security / RBAC

| Check | Result |
|-------|--------|
| CI Firestore IDOR | PASS |
| Anonymous APIs | 401 |
| Founder-gated approve / draft PDF (code) | PASS |

---

## Rollback

```
BRIEFING_AI_REPORT_GENERATION_ENABLED=false
BRIEFING_AUDIO_TRANSCRIPTION_ENABLED=false
```

Does not delete evidence, transcripts, jobs, or report versions. Or remove `OPENAI_API_KEY` secret mount and redeploy.

---

## Remaining Conditions

1. Merge + deploy OpenAI binding fix; verify Cloud Run revision mounts `Open_ai_Secret_Key`.  
2. Authorised Youth Agent production E2E: audio + attendance → Whisper → AI draft → Founder Approve.  
3. Promote to **PRODUCTION CERTIFIED** only after step 2 passes.

---

## Exact Next Action

Deploy OpenAI binding fix, verify revision secret mount, then run authorised YA production smoke.
