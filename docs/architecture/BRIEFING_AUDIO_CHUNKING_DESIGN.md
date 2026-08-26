# Briefing Audio Chunking — Technical Design

**Programme:** TenderBriefing Rationalisation — Batch C follow-on  
**Branch:** `design/briefing-audio-chunking`  
**Date:** 2026-08-26  
**Status:** Design only — **no implementation in this branch**  
**Founder decision:** Long-audio chunking → **DESIGN NEXT** (approved 2026-08-26)

**Production baseline:** `tenderbriefing-00142-68x` · R349 / R200 / PayFast invariants unchanged

**Verdict:** **READY FOR FOUNDER REVIEW — LONG-AUDIO CHUNKING DESIGN**

---

## Executive recommendation

Implement **hybrid time-and-size chunking** behind a new fail-closed flag `BRIEFING_AUDIO_CHUNKING_ENABLED`, using **ffmpeg in the existing Cloud Run image**, **sequential worker continuation** (no new Pub/Sub/Cloud Tasks initially), and **additive Firestore/GCS artefacts**. BI v2 consumes **one canonical assembled transcript** only after all chunks succeed.

**Do not enable in production** until certification: **PRODUCTION CERTIFIED — LONG-AUDIO BRIEFING TRANSCRIPTION**.

**Interim production posture (until certified):** **Option C** — keep `BRIEFING_AUDIO_TRANSCRIPTION_ENABLED` restricted to recordings within single-request limits; add explicit YA guidance on supported duration; Founder/Ops manual retry for failures. Do **not** silently accept 100MB uploads that Whisper cannot process.

---

## 1 — Current state assessment

### Upload endpoint

| Item | Implementation |
|------|----------------|
| Route | `POST /api/briefing-intelligence/evidence` |
| File | `app/api/briefing-intelligence/evidence/route.ts` |
| Auth | Youth Agent (`verifyApiUser`, role `youth-agent`) |
| Required | `requestId`, `audio` file, ≥1 attendance image/PDF |
| Max audio size | **100 MB** (`MAX_AUDIO_BYTES`) |
| Max image size | 10 MB each, max 10 files |
| Accepted audio MIME | `audio/mpeg`, `audio/mp4`, `audio/x-m4a`, `audio/wav`, `audio/aac`, `audio/ogg`, `audio/webm`; extensions `mp3`, `m4a`, `wav`, `aac` |
| Assignment check | `agentId` / `assignedAgentId` / `notifiedAgents` on `attendanceRequests/{requestId}` |

### Evidence storage path

```
workspace-evidence/{requestId}/{agentId}/briefing-intelligence/{reportId}/audio/{timestamp}-{sanitizedFileName}
```

Attendance images: `.../attendance/{n}-{timestamp}-{name}`

Uploaded via Firebase Admin Storage (`admin.storage().bucket()`), metadata: `uploadedBy`, `requestId`, `reportId`.

### Firestore report document

Collection: `briefingIntelligenceReports/{reportId}`

Key fields set on upload:

- `status: 'evidence_uploaded'`
- `audioFileRef`, `audioFileName`, `audioFileSizeMb`
- `evidenceIntegrity` (Phase 3D metadata — no GPS/biometric)
- `pipelineDiagnostics` (`currentStage: 'evidence_uploaded'`)
- Payout triggered via `backend/services/finance/youthAgentPayoutService.ensurePayoutOnEvidenceSubmitted` — **independent of transcription**

Report ID: deterministic via `generateBriefingIntelligenceReportId({ requestId, agentId, salt: tenderId })`.

### Transcription trigger

When `BRIEFING_AUDIO_TRANSCRIPTION_ENABLED` is true (fail-closed default off; **mounted true in `cloudbuild.yaml` production env**):

1. `createOrResetTranscriptionJob` → `briefingTranscriptionJobs/tj-{reportId}`
2. `enqueueTranscriptionWorker` → fire-and-forget `POST /api/briefing-intelligence/transcription/worker`

Files: `lib/briefing-intelligence/transcriptionJobs.ts`, `lib/briefing-intelligence/enqueueTranscription.ts`

### Transcription service

| Item | Implementation |
|------|----------------|
| Provider wrapper | `lib/briefing-intelligence/transcriptionService.ts` |
| Default provider | `OpenAITranscriptionProvider` (`whisper-1`, `verbose_json`) |
| Mock provider | `BRIEFING_INTELLIGENCE_PROVIDER=mock` |
| Flow | Signed URL (1h) → `fetch` entire file → `arrayBuffer` → single `FormData` POST to OpenAI `/audio/transcriptions` |
| Temp files | **None** — in-memory blob only |
| Output | `transcriptText`, timestamped `segments`, `durationSeconds` |

**Provider limit (documented):** OpenAI Whisper API accepts files up to **~25 MB** per request. App allows **100 MB** — structural mismatch.

### Job / worker architecture

| Item | Value |
|------|-------|
| Job collection | `briefingTranscriptionJobs` |
| Job ID | `tj-{reportId}` (one per report) |
| Worker route | `app/api/briefing-intelligence/transcription/worker/route.ts` |
| Route `maxDuration` | **300 seconds** |
| Worker auth | `x-sync-secret` / `x-automation-secret` or admin Bearer |
| Core processor | `processBriefingIntelligenceReport()` in `lib/briefing-intelligence/processReport.ts` |
| Claim | `claimTranscriptionJob` (transactional) |
| Max attempts | `TRANSCRIPTION_MAX_ATTEMPTS = 3` |
| Retry | Exponential backoff; re-enqueue worker on `retrying` |

### Cloud Run configuration

From `cloudbuild.yaml`:

| Setting | Value |
|---------|-------|
| Memory | **1 GiB** |
| CPU | **1** |
| Request timeout | **300 s** |
| Max instances | 3 |

Docker image: Node 20 Alpine (`Dockerfile`) — **no ffmpeg today**.

### Briefing Intelligence handoff

After successful transcription:

- Transcript stored: `briefingTranscripts/bt-tj-{reportId}` + GCS raw JSON at `briefing-intelligence/{reportId}/transcripts/raw-{ts}.json`
- If `BRIEFING_AI_REPORT_GENERATION_ENABLED`: quality gate → `briefingReportJobs` → `POST /api/briefing-intelligence/report/worker`
- If AI flag off: synchronous `extractIntelligence` → `status: 'draft_report'`

Founder approval / SME delivery: existing BI v2 routes (`approve`, `deliver`) — unchanged by this design.

### Current idempotency

| Mechanism | Behaviour |
|-----------|-----------|
| Job ID | Deterministic `tj-{reportId}` |
| Re-upload same audio path | Completed job returned without re-billing |
| In-flight same path | No reset while `queued`/`processing` |
| Transcript ID | `bt-{jobId}` — **overwrite on re-process** (`merge: false`) |
| Report generation job | Separate deterministic job per report |
| Payout | Idempotent on evidence submission — **must not re-fire on transcription retry** |

---

## 2 — Failure modes (current)

### File exceeds OpenAI request limit (~25 MB)

- `OpenAITranscriptionProvider.transcribe` throws after OpenAI 4xx.
- `failTranscriptionJob` → `retrying` or `failed` (up to 3 attempts).
- Report set to `status: 'processing_failed'`, `transcription: null`, `reportContent: null`.
- **Evidence and attendance remain valid**; YA R200 liability already created on evidence.
- Founder notified via lifecycle hooks on downstream failures; SME **not** delivered.

### Worker exceeds Cloud Run timeout (300 s)

- In-flight request killed; job may remain `processing` until stale or manual intervention.
- `claimTranscriptionJob` refuses re-claim while `processing` → **stuck job risk** on timeout without lease expiry (gap).

### OpenAI times out / 5xx

- Treated as retryable (`transcription_failed`); backoff re-enqueue.

### One chunk would succeed — N/A today

Single-request model — no partial transcript persisted on failure.

### Job retries after partial completion

- On success: `completeTranscriptionJob` + transcript saved.
- On retry after partial OpenAI success but before complete: full re-transcription of entire file (duplicate provider cost if first call actually succeeded but crash before persist — unlikely but possible).

### Same audio processed twice

- Re-upload with **new storage path** resets job (`merge: false` on job reset).
- Re-upload same path while completed: idempotent skip.
- Admin `force` process can re-run.

### Transcript succeeds but BI generation fails

- Transcript retained; `reportGenerationStatus` tracks failure; Founder can retry report worker.
- SME not delivered until `approved` + deliver.

### Worker crashes during merge — N/A today

No merge stage.

### Temp storage cleanup fails — N/A today

No temp files; memory-only.

### Founder requests regeneration

- Admin transcript retry / process routes exist; re-invokes pipeline with `force` where supported.

---

## 3 — Proposed pipeline

```
YA uploads audio (+ attendance proof)
  → evidence record (briefingIntelligenceReports) — unchanged
  → R200 liability (evidence-triggered) — unchanged, no chunk side effects
  → IF BRIEFING_AUDIO_TRANSCRIPTION_ENABLED:
       create transcription job (existing)
       IF BRIEFING_AUDIO_CHUNKING_ENABLED && analysis requires chunking:
         briefingAudioProcessing doc (queued)
         worker: analyze → plan chunks → generate chunk files (GCS)
         FOR each chunk (sequential or batched per continuation):
           transcribe chunk → persist chunk result
         assemble canonical transcript → validate completeness
       ELSE:
         existing single-file transcribe path (short audio)
  → transcript validation / quality gate
  → IF BRIEFING_AI_REPORT_GENERATION_ENABLED:
       single BI v2 job on canonical transcript (once)
  → Founder review → approve → SME deliver
```

**Financial invariant:** Chunk processing **must not** invoke payment, payout, or pricing services.

---

## 4 — Chunking strategy

### Options evaluated

| Strategy | Pros | Cons |
|----------|------|------|
| Time-based only | Predictable duration; easy overlap | Dense audio (high bitrate) may exceed 25 MB |
| Size-based only | Respects Whisper limit | Splits mid-word/sentence; harder UX messaging |
| **Hybrid (recommended)** | Caps both duration and bytes | Slightly more planner logic |

### Recommendation: **Hybrid chunking**

| Parameter | Proposed value | Rationale |
|-----------|----------------|-----------|
| Target chunk duration | **10 minutes** | 60 min → ~6 chunks; manageable worker units; 120 min → ~12 chunks |
| Hard max chunk duration | **15 minutes** | Safety ceiling if bitrate low |
| Target max chunk size | **20 MB** | Below ~25 MB Whisper limit with headroom for multipart overhead |
| Hard max chunk size | **24 MB** | Never exceed provider limit |
| Min chunk duration | **30 seconds** | Avoid trivial fragments |

**Planner logic:**

1. `ffprobe` source: duration, codec, bitrate, sample rate.
2. Compute expected bytes/minute.
3. Choose segment length = `min(10 min, time that fits 20 MB at observed bitrate)`.
4. If entire file < 20 MB **and** < 15 min → **single-request path** (no chunking overhead).

**Codec considerations:**

- Phone recordings often `m4a/aac` or `mp3` — ffmpeg normalises to consistent chunk format (recommend export chunks as `mp3 64kbps mono` or `m4a` for size predictability).
- Speech density varies; hybrid protects against high-quality stereo uploads.

---

## 5 — Overlap strategy

### Recommendation: **10-second overlap** between adjacent chunks

| Benefit | Detail |
|---------|--------|
| Sentence boundaries | Reduces split mid-phrase |
| Speaker continuity | Helps merge when Whisper segments lack diarisation |

| Risk | Mitigation |
|------|------------|
| Duplicate text | Deterministic merge dedupe (see §11) |
| Extra cost | ~10s × (N−1) ≈ negligible vs full briefing |
| Complexity | Overlap only at assembly — raw chunk transcripts immutable |

**Dedupe rule:** When merging chunk *i* and *i+1*, compare trailing text of *i* with leading text of *i+1* using longest common suffix/prefix over normalized words (min 3 words match); remove duplicate from chunk *i+1* start. Store merge audit in assembly metadata.

---

## 6 — ffmpeg packaging

### Options

| Option | Assessment |
|--------|------------|
| **A — Install ffmpeg in existing Cloud Run image** | **Recommended** — minimal new infrastructure; same deploy pipeline |
| B — Dedicated transcription worker image | Better isolation; higher ops burden (second service/build) |
| C — Managed media service (e.g. Transcoder API) | Higher cost/complexity; overkill for speech |

### Recommendation: **Option A**

Add to `Dockerfile` runner stage:

```dockerfile
RUN apk add --no-cache ffmpeg
```

| Factor | Impact |
|--------|--------|
| Image size | +~80–100 MB Alpine ffmpeg — acceptable |
| Security patching | Follow Alpine/ffmpeg CVE cycle in regular deploys |
| Cold start | Slight increase — monitor p95 |
| Ownership | Same team as Cloud Run app |

**Do not implement in this design branch.**

---

## 7 — Worker architecture

### Constraint

Multi-hour audio cannot complete in one **300 s** Cloud Run request with ffmpeg + multiple Whisper calls.

### Recommendation: **Sequential job continuation** (existing pattern)

Reuse the established fire-and-forget worker enqueue (`enqueueTranscriptionWorker` style):

```
Worker invocation (bounded work unit):
  1. Claim processing lease on briefingAudioProcessing
  2. If status=queued → analyze + plan chunks + write chunk docs + chunk files to GCS
  3. Process up to K chunks (K=1 initially, tune to fit ~240s budget within 300s timeout)
  4. If more chunks remain → update cursor → re-enqueue self with continuation token
  5. If all chunks done → assemble → complete transcription job → enqueue BI worker
```

| Alternative | Why not first |
|-------------|---------------|
| Cloud Tasks | New IAM/infra; defer unless continuation proves insufficient |
| Pub/Sub | Same |
| Cloud Run Jobs | Separate deploy surface |
| Parallel chunk Whisper | Rate limits + memory spike on 1 GiB |

### Survivability

| Scenario | Design response |
|----------|-----------------|
| Process restart | Processing lease with TTL; stale lease allows reclaim |
| Worker timeout | Persist chunk cursor; continuation resumes next chunk |
| Duplicate delivery | Chunk IDs deterministic; transcribe skip if chunk `completed` |
| Duplicate worker | Transactional claim on processing doc + chunk status |

**Stale `processing` fix (prerequisite):** Add lease expiry to existing `briefingTranscriptionJobs` claim logic — today a timeout can leave job stuck in `processing`.

---

## 8 — Data model

### New top-level collection: `briefingAudioProcessing`

Document ID: `bap-{reportId}` (deterministic)

```typescript
{
  id: string                    // bap-{reportId}
  reportId: string
  requestId: string
  tenderId: string
  agentId: string
  smeId: string
  sourceStoragePath: string     // original audio in workspace-evidence
  sourceHash: string            // SHA-256 of source object
  sourceSizeBytes: number
  sourceDurationMs: number | null
  sourceCodec: string | null
  transcriptionVersion: string  // e.g. "chunk-v1"
  status: ProcessingStatus
  chunkCount: number
  completedChunkCount: number
  failedChunkCount: number
  nextChunkIndex: number          // continuation cursor
  assembledTranscriptId: string | null
  chunkingEnabled: boolean
  plannerSummary: object          // small JSON — not audio
  errorCode: string | null
  errorMessage: string | null
  leaseOwner: string | null
  leaseExpiresAt: string | null
  attempts: number
  maxAttempts: number
  createdAt: string
  updatedAt: string
  completedAt: string | null
}
```

### Subcollection: `briefingAudioProcessing/{id}/chunks/{chunkId}`

```typescript
{
  id: string                    // bac-{reportId}-{index padded}
  index: number                 // 0-based order
  startMs: number
  endMs: number
  overlapStartMs: number | null
  storagePath: string           // GCS chunk audio (not Firestore)
  audioHash: string
  sizeBytes: number
  status: 'pending' | 'transcribing' | 'completed' | 'failed'
  transcriptText: string | null   // chunk-local text only
  segments: Segment[] | null
  provider: string | null
  providerRequestId: string | null
  attempts: number
  errorCode: string | null
  completedAt: string | null
}
```

### GCS layout (additive)

```
briefing-intelligence/{reportId}/audio-chunks/{processingId}/{index}.mp3
briefing-intelligence/{reportId}/transcripts/chunks/{index}-raw.json
briefing-intelligence/{reportId}/transcripts/assembled-{version}.json
```

### Existing collections

- **`briefingTranscriptionJobs`** — remains orchestration entry point; links to `processingId`.
- **`briefingTranscripts`** — canonical assembled transcript only after assembly completes.
- **No parallel briefing system** — same `reportId` throughout.

**Firestore rules:** Admin SDK only (consistent with existing transcription jobs/transcripts).

---

## 9 — Idempotency

### Deterministic identities

| Entity | Formula |
|--------|---------|
| Processing job | `bap-{reportId}` |
| Chunk | `bac-{reportId}-{index}` |
| Source binding | `SHA-256(sourceStoragePath bytes)` stored on processing doc |
| Transcript | `bt-tj-{reportId}` (existing) |
| Assembly version | `{transcriptionVersion}:{sourceHash prefix}` |

### Rules

1. **Source hash mismatch** → invalidate prior chunk/transcript artefacts; re-plan from scratch; never silently reuse old transcript.
2. **Chunk retry** → same `chunkId`; skip Whisper if `status=completed` and hash unchanged.
3. **Worker retry** → continuation from `nextChunkIndex`; no duplicate chunk docs.
4. **BI generation** → existing `briefingReportJobs` idempotency; trigger **once** when `assembledTranscriptId` set.
5. **Notifications** → existing idempotent keys (`briefing-life-idem-*`) — assembly complete must use new key suffix `assembly:{sourceHash}`.
6. **Financial** → no code path in chunk worker may call payout/payment services.

---

## 10 — Source integrity

| Check | When |
|-------|------|
| `sourceHash` computed at processing start | After evidence upload (read GCS object) |
| Re-upload new audio path | New hash → reset processing, invalidate stale chunks |
| Chunk `audioHash` | After ffmpeg extract; verify before transcribe |
| Transcript version | Bump `transcriptionVersion` env on algorithm change |

If YA re-submits evidence for same report (allowed unless `final`/`delivered`), existing evidence route resets downstream fields — chunk processing must align with that reset.

---

## 11 — Transcript assembly

### Input

- All chunks `status=completed` ordered by `index`.
- Raw chunk transcripts **immutable** after completion.

### Merge algorithm

1. Sort chunks by `index`.
2. For each adjacent pair, apply overlap dedupe (§5).
3. Offset segment timestamps: `segment.startSeconds += chunk.startMs / 1000`.
4. Concatenate `transcriptText` with single space/newline separator.
5. Validate: total duration ≈ source duration ± tolerance (5%).
6. Fail assembly if any chunk missing or failed — **no partial canonical transcript**.

### Outputs

| Artefact | Storage |
|----------|---------|
| Per-chunk raw provider JSON | GCS (existing pattern) |
| Assembled canonical | `briefingTranscripts/bt-tj-{reportId}` + GCS assembled JSON |
| Merge audit | `pipelineDiagnostics.assembly` on report doc |

---

## 12 — Failure / retry states

| Status | Meaning | Retry? | Terminal? | SME-visible? |
|--------|---------|--------|-----------|--------------|
| `queued` | Processing doc created | Yes | No | “Processing audio” |
| `analyzing` | ffprobe running | Yes | No | “Processing audio” |
| `chunking` | ffmpeg splitting | Yes | No | “Processing audio” |
| `transcribing` | Whisper in progress | Yes | No | “Transcribing” |
| `assembling` | Merge in progress | Yes | No | “Preparing briefing” |
| `completed` | Canonical transcript ready | No | Yes | “Preparing briefing” (BI next) |
| `partial_failure` | Some chunks failed | Manual/Founder | No | **Not complete** — ops detail |
| `failed` | Exhausted attempts | Manual | Yes | “Processing delayed — support contacted” |

**Rule:** SME never receives report unless downstream `approved` + `delivered` — partial transcript never qualifies.

### Founder/Ops visibility

Extend Founder briefing report diagnostics page with chunk grid: index, duration, status, last error, retry button (admin-only).

---

## 13 — Briefing Intelligence integration

- BI v2 (`processReport` / report worker) consumes **`fullText` from canonical assembled transcript only**.
- **Do not** run BI per chunk (context loss, duplicate reports, cost multiplication).
- **Authoritative metadata** from Firestore tender/attendance context (`fetchAttendanceAndTenderContext`) — never from transcript text alone.
- Transcript treated as **untrusted evidence** — existing prompt rules (“do not invent facts”) unchanged.
- AI retry must check `reportGenerationStatus` + job claim — no duplicate drafts on chunk worker retry.

---

## 14 — Cost model (relative)

Assumptions: ~64 kbps mono speech ≈ **0.48 MB/min**; 10 min chunk ≈ **4.8 MB**; Whisper priced per minute of audio (exact tariff not confirmed here — use relative units).

| Duration | Expected chunks (10 min target) | Whisper calls | Relative ffmpeg CPU | Relative storage | Relative total |
|----------|--------------------------------|---------------|---------------------|------------------|----------------|
| 30 min | 3 | 3× | 1× | 1× | **~3×** single short file |
| 60 min | 6 | 6× | 2× | 2× | **~6×** |
| 90 min | 9 | 9× | 3× | 2× | **~9×** |
| 120 min | 12 | 12× | 4× | 3× | **~12×** |

Retries add multiplicative cost on failed chunks only — idempotency prevents full re-spend on success.

---

## 15 — Limit policy

### Recommended maximum supported recording

| Limit | Value | Rationale |
|-------|-------|-----------|
| **Max duration** | **120 minutes (2 hours)** | Covers typical compulsory briefings; bounds cost at ~12 Whisper calls |
| **Max source file size** | **100 MB** (keep existing) or **80 MB** after chunking cert | Size alone insufficient — duration is primary |
| **Supported codecs** | Current MIME set | ffmpeg handles conversion |

Recordings >120 min: reject at planner with clear YA message to split recording before upload (future: multi-file upload out of scope).

---

## 16 — User experience

### Youth Agent (non-technical copy)

| Internal status | YA-facing label |
|-----------------|-----------------|
| evidence_uploaded | Upload complete |
| processing (chunk pipeline) | Processing your briefing recording |
| transcribing | Transcribing briefing |
| draft/report generating | Preparing briefing report |
| processing_failed | **We’re processing your recording — the team has been notified** |
| delivered (downstream) | Report delivered to client (existing) |

Never show “Whisper”, “OpenAI”, or “chunk failed” to YA.

### Founder/Ops

Detailed diagnostics: chunk index, errors, durations, retry actions, source hash, processing version.

---

## 17 — Observability

### Structured logs (existing `[transcription]` pattern)

- `audio.uploaded` — size, duration estimate, reportId
- `audio.processing.started|completed` — chunkCount, sourceHash
- `audio.chunk.transcribe.started|completed|failed` — index, latencyMs
- `audio.assembly.completed|failed`
- `bi.handoff.enqueued`

### Metrics / KPIs

| KPI | Target use |
|-----|------------|
| Transcription success rate | >98% for ≤120 min after launch |
| Median processing time | Baseline post-cert |
| p95 processing time | Capacity planning |
| Failed briefing count | Ops alert |
| Manual Founder retry count | Quality signal |

---

## 18 — Security and privacy

| Topic | Design |
|-------|--------|
| Temp files | `/tmp/bap-{reportId}-*` only; deleted in `finally` |
| GCS permissions | Private bucket; signed URLs ≤1h for provider |
| Logs | No transcript text in logs; reportId/chunk index only |
| Access | Transcripts Admin/Founder APIs; YA sees status not full transcript pre-delivery |
| Org isolation | All queries scoped by `requestId` → attendance request ownership |
| Retention | Align with existing evidence retention policy; no public buckets |
| POPIA | Audio is personal data — minimise copies; document retention |

---

## 19 — Rollback

| Action | Effect |
|--------|--------|
| Set `BRIEFING_AUDIO_CHUNKING_ENABLED=false` | Fall back to single-file path (short audio only) |
| Disable transcription flag | Evidence upload unchanged; no new jobs |
| Deploy previous revision | No migration required |
| Data | Preserve all processing/chunk/transcript docs — no deletion |

---

## 20 — Feature flag

```bash
# Fail-closed — default unset/false
BRIEFING_AUDIO_CHUNKING_ENABLED=false
```

**Requires** `BRIEFING_AUDIO_TRANSCRIPTION_ENABLED=true` to have effect.

Convention: match `lib/briefing-intelligence/featureFlag.ts` truthy parsing (`true`/`1`/`yes`/`on`).

**Do not enable in production** until certification complete.

---

## 21 — Test strategy

### Unit

- Chunk planner: duration/size matrix, codec variants
- Overlap dedupe merge
- Deterministic ID generation
- Source hash mismatch invalidation
- Retry skip when chunk completed

### Integration

- Simulated 30/60/90/120 min fixtures (generated ffmpeg tone + speech sample)
- One failed chunk → `partial_failure`, no SME delivery
- Provider timeout simulation
- Duplicate worker invocation
- Mid-run cursor resume

### Security

- Cross-org access denied on processing/chunk APIs
- YA cannot read other agents’ processing docs

### Financial (mandatory)

Assert chunk retry/assembly **does not** mutate:

- `briefingPriceCents` / R349 on request
- `paymentStatus`
- `youthAgentPayoutCents` / R200 liability
- `payoutStatus`

Payout remains evidence-triggered only once.

---

## 22 — Certification plan

### Pre-requisites

- Implementation PR(s) on feature branch
- ffmpeg in Docker image
- Stale processing lease fix

### Certification script (future)

```
Upload 60–90 min realistic fixture
→ chunks generated (count matches planner)
→ every chunk transcribed
→ canonical transcript assembled
→ BI v2 generated once
→ Founder approves
→ SME receives report
```

### Required verdict

**PRODUCTION CERTIFIED — LONG-AUDIO BRIEFING TRANSCRIPTION**

before enabling `BRIEFING_AUDIO_CHUNKING_ENABLED` broadly in Cloud Run.

---

## 23 — Interim production posture (until certified)

| Option | Assessment |
|--------|------------|
| A — Keep 100MB + guidance only | Low engineering; **high failure risk** for long files |
| B — Reduce upload to ~25MB | Reduces failures; **poor UX** without chunking |
| **C — Flag discipline + guidance (recommended)** | Keep transcription enabled only for pilots; document max **~15–20 min** safe single-request duration; monitor failures; Founder manual retry |

**Recommendation: Option C** with added YA UI copy: *“Recordings longer than 20 minutes may take longer to process; contact support if processing fails.”*

Implement Option C messaging in a **separate approved PR** — not in this design branch.

---

## Implementation phases (post-approval)

| Phase | Deliverable |
|-------|-------------|
| **0** | Stale job lease fix; observability baseline |
| **1** | ffmpeg in image; chunk planner + GCS chunk storage (flag off) |
| **2** | Continuation worker + chunk transcribe + assembly |
| **3** | BI handoff integration + Founder diagnostics UI |
| **4** | Certification harness + long-audio smoke |
| **5** | Pilot enablement → production rollout |

---

## Open decisions (Founder input)

1. **Max duration cap:** Confirm **120 min** vs 180 min.
2. **Interim Option C:** Approve YA messaging-only mitigation until Phase 4 cert?
3. **Worker parallelism:** Start sequential (recommended) — revisit if p95 SLA missed?
4. **Dedicated worker service:** Defer unless Cloud Run continuation fails load test?

---

## Founder recommendation

Approve this design for implementation planning. **Do not implement or enable flags** until:

1. Batch C decision memo merged (PR #69)
2. Implementation PR(s) reviewed
3. Certification harness passes on realistic long recording

**Final verdict:** **READY FOR FOUNDER REVIEW — LONG-AUDIO CHUNKING DESIGN**

---

## References (code)

| Area | Path |
|------|------|
| Evidence upload | `app/api/briefing-intelligence/evidence/route.ts` |
| Transcription jobs | `lib/briefing-intelligence/transcriptionJobs.ts` |
| Process pipeline | `lib/briefing-intelligence/processReport.ts` |
| OpenAI provider | `lib/briefing-intelligence/transcriptionService.ts` |
| Worker | `app/api/briefing-intelligence/transcription/worker/route.ts` |
| Enqueue | `lib/briefing-intelligence/enqueueTranscription.ts` |
| Report enqueue | `lib/briefing-intelligence/enqueueReportGeneration.ts` |
| Feature flags | `lib/briefing-intelligence/featureFlag.ts` |
| Cloud Run | `cloudbuild.yaml` |
| Prior cert limitation | `docs/reports/BRIEFING_AUDIO_TRANSCRIPTION_CERTIFICATION.md` §Known Limitations |
| Batch C decision | `docs/decisions/BATCH_C_INCOMPLETE_CAPABILITIES_DECISION.md` |
