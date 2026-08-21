# Briefing AI Meeting Minutes — Production Release Certification

**Date:** 2026-08-21  
**Product URL:** https://www.tenderbriefing.co.za

---

## Executive Verdict

**PASS WITH CONDITIONS**

| Layer | Status |
|-------|--------|
| CODE VERIFIED | **PASS** (PR #47 CI green; BI suite 61/61) |
| DEPLOYMENT VERIFIED | **PASS** (merge SHA deployed; rules/indexes deployed; flag revisions deployed) |
| REAL PRODUCTION WORKFLOW VERIFIED | **NOT COMPLETE** — no authorised live Youth Agent Whisper+report smoke in this session; OpenAI GSM mount blocked |

**Not** declared `PRODUCTION CERTIFIED` because genuine audio → Whisper → AI report → Founder approve was not executed against production with real credentials/evidence.

---

## Release

| Item | Value |
|------|-------|
| Feature PR | [#47](https://github.com/tenderbriefing/tender/pull/47) |
| Source branch | `feat/briefing-audio-transcription-pipeline` |
| Certified source SHA | `1643434b76e5700af04963c1dc18fde1aea25f3a` |
| Merge SHA (PR #47) | `0d71d9b09e1012c2af9bc4147c1acaa59ff8c004` |
| Merged at | 2026-08-21T10:24:00Z |
| First production deploy (PR #47 code, flags off) | [run 32472467320](https://github.com/tenderbriefing/tender/actions/runs/32472467320) — **success**, headSha `0d71d9b…` |
| Ops PR #48 (transcription flag + OPENAI mount) | Merged `2f51d7f…` — deploy [32474525651](https://github.com/tenderbriefing/tender/actions/runs/32474525651) **FAILED** (Cloud Run update with `OPENAI_API_KEY=openai-api-key:latest`) |
| Ops PR #49 (flags without OPENAI mount) | Merged `c80baef…` — deploy [32476186385](https://github.com/tenderbriefing/tender/actions/runs/32476186385) **success** |
| Ops PR #50 (AI report flag on) | Merged `5c6ea95…` — deploy [32478037350](https://github.com/tenderbriefing/tender/actions/runs/32478037350) **success**, headSha `5c6ea95…` |
| Current production tip (flags) | `5c6ea95d785893cd1b2d885ade4c4bdfff658f13` |
| Production URL | https://www.tenderbriefing.co.za |

---

## Feature Flags (intended production config after ops PRs)

| Flag | Intended state |
|------|----------------|
| `BRIEFING_AUDIO_TRANSCRIPTION_ENABLED` | `true` |
| `BRIEFING_AI_REPORT_GENERATION_ENABLED` | `true` |
| `BRIEFING_REPORT_PROMPT_VERSION` | `v1` |
| `APP_URL` | `https://www.tenderbriefing.co.za` |
| `OPENAI_API_KEY` (GSM mount) | **NOT mounted** — deploy failed when adding `openai-api-key:latest`; binding deferred |

**Implication:** Flags may be on, but Whisper/GPT calls will fail at runtime until Cloud Run runtime service account has `secretmanager.secretAccessor` on GSM secret `openai-api-key` and the secret is remounted via `cloudbuild.yaml`.

Secret values are never recorded here.

---

## Production Health (baseline)

| Check | Result |
|-------|--------|
| Homepage | PASS (200) |
| `/tenders` | PASS (200) |
| Auth sign-in/sign-up | PASS (200) |
| `/api/health/firestore` | PASS (`connected: true`) |
| YA assignments / submit-evidence routes load | PASS (200) |
| Founder briefing-reports page loads | PASS (200) |
| Anonymous minutes/transcript/PDF/report APIs | PASS (401) |

---

## Real Whisper / Attendance / AI Report Smoke

| Check | Result |
|-------|--------|
| Authorised YA login + real assignment upload | **NOT RUN** (no production YA session in this release agent) |
| Audio upload → async transcription job | **NOT RUN** |
| Whisper completion | **NOT RUN** (also blocked without OpenAI mount) |
| Attendance evidence upload/inspect | **NOT RUN** |
| AI minutes + amendments + PDF | **NOT RUN** in production |
| Founder draft → Approve / Regenerate | **NOT RUN** in production |
| Mock report quality (pre-merge) | PASS (2-page branded PDF; structured amendments; no speaker labels) |

---

## Security / RBAC

| Check | Result |
|-------|--------|
| CI Firestore IDOR matrix | PASS |
| Anonymous founder/BI APIs | 401 |
| YA cannot approve AI drafts until founder `approved` (code) | Implemented in PR #47 |
| Draft PDF gated for non-admin until approved/final (code) | Implemented in PR #47 |
| Jobs/transcripts/versions client deny-all (rules) | Deployed with PR #47 Firebase deploy |

---

## Tests

| Gate | Result |
|------|--------|
| PR #47 CI (typecheck, lint, unit, Firestore IDOR, Playwright, production build, Founder V2) | PASS |
| Local BI suite | 61/61 PASS |
| Automated failure/idempotency paths | Covered in unit suite (not live fault-injected in prod) |

---

## Rollback

```bash
# Disable AI minutes/PDF only (evidence + transcripts retained)
BRIEFING_AI_REPORT_GENERATION_ENABLED=false

# Disable Whisper jobs as well (uploads still succeed)
BRIEFING_AUDIO_TRANSCRIPTION_ENABLED=false
```

Apply via `cloudbuild.yaml` + Deploy TenderBriefing (or Cloud Run env update). No deletion of audio, attendance, jobs, transcripts, or report versions.

---

## Remaining Conditions (exact human actions)

1. **Grant** Cloud Run runtime service account `roles/secretmanager.secretAccessor` on GSM secret `openai-api-key` (or confirm secret exists and name matches).  
2. **Remount** `OPENAI_API_KEY=openai-api-key:latest` in `cloudbuild.yaml` and redeploy.  
3. **Run** authorised Youth Agent production smoke: real audio + attendance → transcription job → Whisper → AI draft → Founder Approve.  
4. Only then promote verdict to **PRODUCTION CERTIFIED**.

---

## Exact Next Action

1. Fix OpenAI secret access + remount.  
2. Redeploy.  
3. Complete real YA → Founder end-to-end smoke.  
4. Update this certification to PRODUCTION CERTIFIED if that smoke passes.
