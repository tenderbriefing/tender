# Briefing Intelligence — Pre-Smoke Technical Certification

**Date:** 2026-08-21  
**Verdict:** **PASS — READY FOR AUTHORISED REAL YA SMOKE**

This is **not** PRODUCTION CERTIFIED. Real authorised Youth Agent production smoke remains the human gate.

---

## 1. Executive Verdict

**PASS — READY FOR AUTHORISED REAL YA SMOKE**

Code/deployment-ready technical hardening is complete on branch `hardening/briefing-intelligence-production-e2e`. Automated BI suite **72/72** PASS. Remaining gate is human production workflow only.

---

## 2. Branch

`hardening/briefing-intelligence-production-e2e`

---

## 3. Starting SHA

`b76c4c9d23f9fc971614a1cd578778107bab4b14` (`origin/master` at branch creation)

---

## 4. Final SHA

`9df48a8afbfe6f853e4bec3cbb4c737bc2e3469c`

---

## 5. Architecture Verified

Single pipeline (no parallel BI stack):

YA submit-evidence → evidence API → Whisper job → transcript → AI minutes + PDF → Founder Approve/Regenerate.

Correlation: **`briefingRunId` = `reportId` (`TB-BR-…`)**.

---

## 6. Production Configuration

| Item | State |
|------|-------|
| `BRIEFING_AUDIO_TRANSCRIPTION_ENABLED` | `true` (prod) |
| `BRIEFING_AI_REPORT_GENERATION_ENABLED` | `true` (prod) |
| `BRIEFING_REPORT_PROMPT_VERSION` | `v1` |
| `OPENAI_API_KEY` | Mounted from `Open_ai_Secret_Key:latest` (revision `tenderbriefing-00125-sfx`) |
| Production tip before this PR | `1214dd8…` |

This hardening branch is **not yet deployed** (merge/deploy requires Founder approval).

---

## 7. Youth Agent Readiness

- Submit Report flow: audio + attendance only; tender auto-resolved  
- Formats/sizes stated in UI (audio MP3/M4A/WAV/AAC ≤100MB; attendance JPEG/PNG/WebP/PDF ≤10MB)  
- Async acknowledgement; no synchronous Whisper wait  
- Assignment authorisation fail-closed  

---

## 8. Whisper Readiness

- Server-side OpenAI Whisper via `OPENAI_API_KEY`  
- Bounded attempts (`TRANSCRIPTION_MAX_ATTEMPTS=3`)  
- Failures classified; evidence retained  
- Transcript quality gate before report enqueue  

---

## 9. AI Report Quality Controls

- Structure / speaker-label / substantive-content gate before `draft_ready`  
- Authoritative tender number / closing date forced from tender record  
- Discrepancies surfaced as warnings / amendments, not silent overwrite  
- Irrelevant chatter regression covered in automated simulation  

---

## 10. Founder Workflow

- Minutes page shows status, version, PDF, attendance, transcript link  
- Pipeline diagnostics: stage, failure, retry eligibility, intact flags, quality warnings  
- Regenerate creates new version; Approve is atomic/idempotent  
- Server-side admin auth required  

---

## 11. Security / RBAC

- Existing IDOR/Firestore gates unchanged in intent  
- Anonymous BI APIs remain auth-required  
- YA cannot founder-approve AI drafts until `approved`  
- Draft PDF gated for non-admin until approved/final  
- Local BI permission tests continue to pass  

---

## 12. Idempotency

- Deterministic `reportId` / job ids  
- Transcription/report job claim + completed skip  
- Founder approve idempotent when already approved  
- Regenerate uses `force: true` for intentional new version  

---

## 13. Observability

- `[briefing-pipeline]` structured logs with `briefingRunId` (no secrets/transcripts)  
- `pipelineDiagnostics` on report doc + Founder minutes API  

---

## 14. Failure / Retry Handling

- Quality gate → `failed_quality_gate` / Founder-visible reason  
- Provider error categories classified  
- Bounded retries on jobs  
- Evidence + transcript preserved on AI failure  

---

## 15. Automated Simulation

`tests/briefing-intelligence/unit/briefingIntelligenceE2eSimulation.test.ts`  

**Explicitly labelled automated simulation — not real YA smoke.**

---

## 16. Test Results

| Gate | Result |
|------|--------|
| BI vitest | **72/72 PASS** |
| typecheck | PASS |
| lint | PASS (pre-existing ConnectorMatching hook warning) |
| secrets-scan | PASS |

Playwright / production build / Firestore emulator IDOR: run via PR CI before merge.

---

## 17. Remaining Human Gate

**Authorised real Youth Agent production audio + attendance → Whisper → AI report → Founder review/approve.**

Follow: [`docs/runbooks/BRIEFING_INTELLIGENCE_REAL_PRODUCTION_SMOKE.md`](../runbooks/BRIEFING_INTELLIGENCE_REAL_PRODUCTION_SMOKE.md)

---

## 18. Exact Next Action

1. Merge this hardening PR after CI green (Founder approval).  
2. Deploy TenderBriefing to production.  
3. Execute the real YA smoke runbook.  
4. Only then upgrade certification to **PRODUCTION CERTIFIED** if smoke PASS.
