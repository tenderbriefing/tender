# Briefing AI Meeting Minutes — Final Certification

**Branch:** `feat/briefing-audio-transcription-pipeline` (merged)  
**PR:** https://github.com/tenderbriefing/tender/pull/47 (**MERGED**)  
**Certified source SHA:** `1643434b76e5700af04963c1dc18fde1aea25f3a`  
**Merge SHA:** `0d71d9b09e1012c2af9bc4147c1acaa59ff8c004`  
**CI:** All required checks green at merge  
**Date:** 2026-08-21  
**Scope:** Transcription + AI meeting minutes + tender comparison + branded PDF + founder approval  
**Production certification:** see [`BRIEFING_AI_MEETING_MINUTES_PRODUCTION_CERTIFICATION.md`](./BRIEFING_AI_MEETING_MINUTES_PRODUCTION_CERTIFICATION.md)

---

## Executive Verdict

**PASS WITH CONDITIONS** (post-merge)

Founder approval granted; PR #47 merged and deployed. Feature flags enabled via ops PRs #48–#50. **Not** `PRODUCTION CERTIFIED`: OpenAI GSM mount failed on first flag deploy, and genuine YA Whisper → report → Founder approve smoke was not completed in the release session.

**Remaining before PRODUCTION CERTIFIED:**

1. Grant Cloud Run SA `secretAccessor` on GSM `openai-api-key`, remount `OPENAI_API_KEY`, redeploy.  
2. Authorised Youth Agent live smoke: real audio + attendance → Whisper → AI draft → Founder Approve.  
3. Founder reviews 1–2 real drafts before client delivery automation.

---

## Architecture

```
YA evidence upload (async return)
  → briefingTranscriptionJobs + Whisper → briefingTranscripts (internal)
  → IF BRIEFING_AI_REPORT_GENERATION_ENABLED:
       briefingReportJobs → BriefingSummaryService
       → tender metadata (+ PDF text when reachable)
       → structured meeting minutes (no speaker labels)
       → Amendments, Clarifications & Changes (Tender / Briefing / Implication)
       → pdf-lib A4 PDF (logo + attendance)
       → briefingReportVersions (versioned)
       → draft_report + reportGenerationStatus=draft_ready
  → Founder Minutes: view / Approve / Regenerate
  → YA cannot finalise AI reports until reportGenerationStatus=approved
  → SME PDF download gated until approved/final/delivered
```

Evidence remains valid if transcription or report generation fails.

---

## Feature Flags

| Flag | Default | Behaviour |
|------|---------|-----------|
| `BRIEFING_AUDIO_TRANSCRIPTION_ENABLED` | fail-closed off | Evidence OK; no Whisper jobs when off |
| `BRIEFING_AI_REPORT_GENERATION_ENABLED` | fail-closed off | Transcript may exist; no minutes/PDF when off |
| `BRIEFING_REPORT_PROMPT_VERSION` | `v1` | Persisted on jobs/versions |

Rollback AI reports: set `BRIEFING_AI_REPORT_GENERATION_ENABLED=false` — does not delete evidence, audio, transcripts, or prior versions.

---

## Firestore Changes

**Rules (deny-all client):** `briefingTranscriptionJobs`, `briefingTranscripts`, `briefingReportJobs`, `briefingReportVersions`  

**YA update deny-list extended** to block mutation of `status`, `reportContent`, `meetingMinutes*`, `transcription`, `reportGenerationStatus`, etc.

**Indexes:** `briefingTranscripts` (reportId+updatedAt), `briefingIntelligenceReports` (agentId/status+createdAt), `briefingReportVersions` (reportId+version, reportId+status)

---

## Controlled Smoke (mock / non-sensitive)

Script: `scripts/smoke-meeting-minutes-pdf.ts`  
Output: `/tmp/TenderBriefing_SCM002_2026_Briefing_Report_SMOKE.pdf` (~322KB, logo embedded)

| Stage | Result |
|-------|--------|
| Mock transcript themes (regs priority, Q&A, extension, irrelevant coffee) | PASS |
| Structured minutes | PASS |
| Speaker labels | **None** |
| Official closing date / tender number | Preserved (`2026-09-30`, `SCM002-2026`) |
| Amendments (≥1 structured items) | **2** |
| Irrelevant “coffee” chatter | Excluded |
| PDF generation + logo | PASS |
| Live Whisper + real attendance embed | **Not run** (condition) |
| Duplicate worker idempotency | Covered by unit tests |

---

## Report Quality

| Check | Result |
|-------|--------|
| Meeting-minutes tone (not transcript dump) | PASS (mock) |
| Amendments: Tender / Briefing / Implication | PASS |
| No invented speakers/names | PASS |
| Hallucinated requirements | Not observed in mock fixture |
| Tender metadata vs model | Official metadata wins |
| Full-doc comparison unavailable handling | `documentComparisonStatus` recorded internally |

---

## Security

| Control | Status |
|---------|--------|
| Jobs/transcripts client-readable | **No** (rules deny-all) |
| Transcript/minutes APIs | Admin only |
| YA founder-bypass finalize | **Blocked** when AI report flag on until `approved` |
| Draft PDF to SME/YA | **Blocked** until approved/final/delivered |
| Attendance verified=true without proof | **Fixed** |
| YA Firestore write of AI fields | **Denied** via rules |

---

## Test Results

| Gate | Result |
|------|--------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (pre-existing ConnectorMatching warning) |
| `npm test -- tests/briefing-intelligence` | **61 passed / 16 files** |
| Controlled mock PDF smoke | PASS |
| `npm run build` | Conditional / pre-existing `/tenders/*` SSG risk |

---

## Known Limitations

1. Live production Whisper+attendance smoke pending flag enablement.  
2. Long-audio chunking not in scope.  
3. Tender PDF compare depends on reachable attachments.  
4. WebP attendance may not embed (prefer JPEG/PNG).  
5. Prompt quality on real SA briefings needs founder review of early drafts.

---

## Rollback

```bash
BRIEFING_AI_REPORT_GENERATION_ENABLED=false
# optionally also:
BRIEFING_AUDIO_TRANSCRIPTION_ENABLED=false
```

No database deletion required.

---

## Merge Recommendation

**READY FOR FOUNDER APPROVAL TO MERGE**

Do **not** enable client auto-delivery of AI drafts on day one. Merge → deploy rules/indexes → controlled flag-on smoke → founder draft review → then consider delivery.
