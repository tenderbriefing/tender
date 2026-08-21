# Briefing Audio Transcription Pipeline — Engineering Certification

**Branch:** `feat/briefing-audio-transcription-pipeline`  
**Date:** 2026-08-21  
**Scope:** Reliable async audio → durable transcript (Phase: RECORD → TRANSCRIBE). Client meeting-minutes report generation is explicitly out of scope for this phase except where the existing BI extract path already runs after transcription.

---

## Executive Verdict

**PASS WITH CONDITIONS**

Local gates (typecheck, lint, BI unit/integration tests, build) pass. Feature is **fail-closed** (`BRIEFING_AUDIO_TRANSCRIPTION_ENABLED` unset/false): evidence upload continues; transcription jobs are not started. Production smoke against live Whisper is **not** certified in this PR — enable the flag in a controlled environment and run the smoke checklist before treating the async path as live.

---

## Architecture

```
YA submit-evidence
  → POST /api/briefing-intelligence/evidence
  → store audio + attendance (unchanged)
  → status: evidence_uploaded
  → IF BRIEFING_AUDIO_TRANSCRIPTION_ENABLED:
       create briefingTranscriptionJobs/{tj-{reportId}} (queued)
       fire-and-forget POST /api/briefing-intelligence/transcription/worker
  → return success immediately (HTTP not held open for Whisper)

Worker (SYNC_SECRET or admin Bearer)
  → claim job (transactional)
  → signed URL → TranscriptionProvider.transcribe (Whisper verbose_json)
  → GCS raw payload + Firestore briefingTranscripts/{bt-tj-…}
  → extractIntelligence (existing GPT path) → draft_report
  → job completed | retrying (≤3) | failed

Admin
  → GET/POST …/reports/{reportId}/transcript (viewer + Retry)
  → POST /process (enqueue or force sync)
```

Original audio is never deleted on transcription success/failure. Evidence submission and transcription statuses are independent: transcription failure → `processing_failed` on the report AI fields only; audio + attendance remain.

---

## Files Changed (important)

| Area | Path |
|------|------|
| Feature flag | `lib/briefing-intelligence/featureFlag.ts` |
| Job model | `lib/briefing-intelligence/transcriptionJobs.ts` |
| Transcript store | `lib/briefing-intelligence/transcriptStore.ts` |
| Types / YA labels | `lib/briefing-intelligence/transcriptionTypes.ts` |
| Shared processor | `lib/briefing-intelligence/processReport.ts` |
| Enqueue | `lib/briefing-intelligence/enqueueTranscription.ts` |
| Whisper segments | `lib/briefing-intelligence/transcriptionService.ts` |
| Evidence enqueue | `app/api/briefing-intelligence/evidence/route.ts` |
| Worker | `app/api/briefing-intelligence/transcription/worker/route.ts` |
| Process route | `app/api/briefing-intelligence/process/route.ts` |
| Admin transcript API | `app/api/briefing-intelligence/reports/[reportId]/transcript/route.ts` |
| Admin UI | `app/founder/briefing-reports/[reportId]/transcript/page.tsx` |
| Viewer | `components/briefing/BriefingTranscriptViewer.tsx` |
| YA labels | `components/briefing/ReportStatusBadge.tsx` |
| Rules / indexes | `firestore.rules`, `firestore.indexes.json` |
| Docs / env | `docs/operations/ENVIRONMENT_VARIABLES.md`, `.env.local.example` |

---

## Data Model

### `briefingTranscriptionJobs/{tj-{reportId}}`
Deterministic id per report. Status: `queued` | `processing` | `completed` | `failed` | `retrying`. Attempts capped at 3. Idempotent for same `audioStoragePath` when already completed.

### `briefingTranscripts/{bt-tj-{reportId}}`
`fullText`, `segments[{id,speaker,startSeconds,endSeconds,text}]`, language, duration, provider/model, `sourceAudioPath`, `reportId` / `requestId` / `tenderId`, `rawProviderResponseRef` (GCS).

### `briefingIntelligenceReports` (additive)
`transcription.transcriptId`, `segmentCount`, `durationSeconds` when present.

### Firestore rules
Jobs + transcripts: **Admin SDK only** (`allow read, write: if false`). Served via authenticated admin APIs.

---

## Transcription Provider

- Abstraction: `TranscriptionProvider` (`transcribe` + `extractIntelligence`)
- Production default: **OpenAI Whisper** (`whisper-1`) via existing `OPENAI_API_KEY`
- Response format: **`verbose_json`** for timestamped segments
- Diarisation: **not available on whisper-1** — all segments labelled **Speaker 1** (no fabricated names). Mock fixture may demonstrate Speaker 1/2 for tests only.
- Extraction model: existing `gpt-4o` (or `BRIEFING_INTELLIGENCE_EXTRACT_MODEL`) after transcript is stored

---

## Security

- No public audio/transcript URLs; short-lived signed URLs for admin viewer only (15 min)
- Transcript GET/POST: **admin only**
- Provider keys server-side only
- Worker auth: `x-sync-secret` / `x-automation-secret` or admin Bearer
- YA cannot call transcript API (unit-covered)

---

## Retry & Failure Behaviour

- Transient failures → `retrying` with exponential backoff metadata; worker re-enqueues when retryable
- Max **3** attempts → `failed`
- Report → `processing_failed`; AI artifacts cleared; **evidence retained**
- Admin **Retry transcription** resets job to queued and enqueues worker
- YA message: “Recording received. Our team is reviewing the transcription.”

---

## UI

| Role | Experience |
|------|------------|
| Youth Agent | Unchanged upload UX; post-submit: “Upload complete. We are preparing your report…”; badges use simple labels |
| Founder/Admin | Reports list → **Transcript**; viewer with timestamps/speakers, copy, optional audio seek; Retry; operational errors |

SME clients are **not** given raw transcript access in this phase.

---

## Tests

| Gate | Result |
|------|--------|
| `tsc --noEmit` | PASS |
| `next lint` | PASS (pre-existing ConnectorMatching warning only) |
| `vitest` briefing-intelligence (+ new pipeline/access tests) | PASS (53+) |
| `npm run build` | **CONDITIONAL** — local build hit pre-existing static generation timeouts on `/tenders/*` pages (unrelated to transcription). Typecheck + BI tests green; CI Cloud Build is the authoritative prod compile. |

---

## Production Smoke

**Not executed against production in this certification.** Checklist when flag is enabled:

1. YA submission succeeds  
2. Audio in GCS  
3. Job created  
4. Worker starts  
5. Transcript completes  
6. Segments/timestamps stored  
7. Founder views transcript  
8. YA simple status  
9. Original recording remains  
10. No secrets exposed  
11. No duplicate job for same audio  
12. Existing evidence/report workflow intact  

Use short non-sensitive sample audio only.

---

## Feature Flag / Rollback

```bash
# Disable (default): evidence upload continues; no jobs
BRIEFING_AUDIO_TRANSCRIPTION_ENABLED=false
# or unset

# Enable
BRIEFING_AUDIO_TRANSCRIPTION_ENABLED=true
# Requires: OPENAI_API_KEY, APP_URL/NEXT_PUBLIC_APP_URL, SYNC_SECRET for worker
```

Rollback does **not** require deleting audio, attendance, jobs, or transcripts.

---

## Known Limitations

1. Whisper-1 has **no true speaker diarisation** — segments are time-based under Speaker 1 unless a future diarising provider is plugged into the same interface.  
2. Very long briefings may hit OpenAI upload/size limits; **chunking/ffmpeg not implemented** in this phase (Cloud Run 300s `maxDuration` on worker).  
3. Worker self-enqueue needs reachable `APP_URL`; without it jobs remain queued until admin Retry/process.  
4. Auto-extract to draft report still runs after transcription (existing BI path); full “2-page meeting minutes” product polish is the **next** phase.  
5. Production smoke pending founder-controlled flag enablement.

---

## Next Recommended Phase

**Tender Document + Transcript + Attendance Evidence → AI-generated 2-page TenderBriefing Meeting Minutes Report**, consuming:

```json
{ "tenderDocument", "transcript", "attendanceEvidence", "briefingMetadata" }
```

with provenance back to `transcriptSegmentId` / `startSeconds` / source audio.
