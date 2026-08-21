# Briefing Intelligence — E2E Hardening Assessment

**Date:** 2026-08-21  
**Branch:** `hardening/briefing-intelligence-production-e2e`  
**Starting SHA:** `b76c4c9d23f9fc971614a1cd578778107bab4b14`  
**Production tip (pre-hardening):** `1214dd8…` / revision `tenderbriefing-00125-sfx`  
**Scope:** Technical hardening only — **not** PRODUCTION CERTIFIED until authorised YA smoke.

---

## Current architecture

```
YA submit-evidence
  → POST /api/briefing-intelligence/evidence
  → briefingIntelligenceReports (evidence_uploaded)
  → [BRIEFING_AUDIO_TRANSCRIPTION_ENABLED]
       briefingTranscriptionJobs → transcription/worker → Whisper
       → briefingTranscripts (+ GCS raw)
  → [BRIEFING_AI_REPORT_GENERATION_ENABLED]
       briefingReportJobs → report/worker
       → BriefingSummaryService (+ tender metadata/PDF compare)
       → meetingMinutesPdf → briefingReportVersions (vN)
       → draft_report / reportGenerationStatus=draft_ready
  → Founder /founder/briefing-reports/[id]/minutes
       Approve | Regenerate
  → YA finalize gated until founder approved
```

**Correlation today:** deterministic `reportId` (`TB-BR-…`) plus `requestId`, `tenderId`, job ids (`tj-`, `rj-`, `bt-`, `brv-…-vN`). No separate `briefingRunId`.

**Single pipeline:** one architecture (extended from PR #47). No parallel BI stack.

---

## Existing strengths

- Fail-closed independent feature flags
- Async Whisper (upload HTTP does not wait)
- Evidence preserved on AI failure
- Official tender metadata wins for cover/closing
- Speaker labels stripped / rejected for client minutes
- Founder-gated AI approval; draft PDF gated for non-admin
- Deterministic report + job ids; job claim transactions
- BI suite 61/61 + production OpenAI GSM mount verified

---

## Production risks / gaps vs hardening prompt

| Gap | Risk | Plan |
|-----|------|------|
| No explicit `briefingRunId` alias in logs | Harder ops tracing | Use `reportId` as `briefingRunId`; structured stage logs |
| Weak pipeline stage / failure diagnostics on Founder UI | Slow recovery | Persist + expose `pipelineDiagnostics` |
| Approve not strongly idempotent | Double-approve races | Atomic approve; skip if already approved same version |
| Limited pre-draft quality gate | Polished junk drafts | Transcript quality + report structure gate |
| Hallucinated closing/tender number | Already mostly blocked | Strengthen discrepancy flags + tests |
| Irrelevant chatter | Prompt-only | Regression tests + quality checks |
| Bad/short/empty audio | May still attempt report | Fail quality gate → Founder-visible |
| Observability incomplete | Stage/retry unclear | Diagnostics payload on minutes GET |
| Automated full simulation | Gaps | New E2E simulation test (mock provider) |
| Real YA smoke | Human gate | Runbook only |

---

## Planned changes (this branch)

1. `pipelineTrace` + `briefingRunId` (= `reportId`) safe structured logs  
2. Transcript quality + report quality gates before `draft_ready`  
3. Error category classification (no secret/raw dumps)  
4. Atomic / idempotent Founder approve  
5. Founder minutes diagnostics (stage, retries, evidence/transcript intact)  
6. YA submit UX clarity (formats, sizes, async ack)  
7. Automated E2E simulation + expanded unit tests  
8. Production smoke runbook + pre-smoke technical certification  

**Out of scope:** merge/deploy without Founder approval; claiming PRODUCTION CERTIFIED; facial recognition; speaker diarisation; redesign YA flow.
