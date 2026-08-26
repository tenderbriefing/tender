# Long-audio chunking — implementation certification

**Programme:** TenderBriefing Rationalisation — Batch C follow-on  
**Design source:** PR #70 · `docs/architecture/BRIEFING_AUDIO_CHUNKING_DESIGN.md`  
**Branch:** `feat/briefing-long-audio-chunking`  
**Date:** 2026-08-26  
**Status:** Implementation complete — **awaiting Founder merge approval**

---

## Executive verdict

**READY FOR FOUNDER APPROVAL TO MERGE — LONG-AUDIO CHUNKING**

Implementation follows the approved PR #70 design. Feature flag `BRIEFING_AUDIO_CHUNKING_ENABLED` defaults **fail-closed off** — production behaviour unchanged until Founder enables after review.

---

## Release identity

| Item | Value |
|------|--------|
| Base master SHA (branch point) | `1979efb8db97ccaaa137cbbc8fb75f9abc551171` |
| Production runtime (pre-merge) | `tenderbriefing-00143-d72` @ `7bd0646` (push retirement) |
| Design reference | PR #70 merged |

---

## Implementation summary

| Area | Change |
|------|--------|
| **Decision** | Hybrid size/duration thresholds → `direct` or `chunked` (`transcriptionMode` in pipeline diagnostics) |
| **Chunking** | ffmpeg/ffprobe in Docker; planner; GCS chunk storage; Firestore `briefingAudioProcessing` + `chunks` subcollection |
| **Worker** | Sequential continuation (`CHUNKS_PER_WORKER_INVOCATION=1`); re-enqueue on partial progress |
| **Assembly** | Overlap dedupe merge → single canonical transcript → existing BI handoff |
| **Idempotency** | Deterministic IDs; chunk skip when `completed`; source hash invalidation; stale job lease reclaim |
| **Flags** | `BRIEFING_AUDIO_CHUNKING_ENABLED` requires `BRIEFING_AUDIO_TRANSCRIPTION_ENABLED` |

---

## Direct vs chunked threshold

| Condition | Path |
|-----------|------|
| Chunking flag **off** | Always **direct** |
| Size **< 20 MB** AND duration **< 15 min** | **direct** |
| Size **≥ 20 MB** OR duration **≥ 15 min** | **chunked** (when flag on) |
| Duration **> 120 min** | Rejected (`audio_too_long`) |

Pre-chunking decision uses size metadata + duration estimate; chunked worker runs ffprobe for accurate planning.

---

## Chunking model

- Target segment: **10 min** / **20 MB** (hybrid)
- Overlap: **10 s** between adjacent chunks
- Max chunks: **15**; max source: **120 min** / **100 MB** (existing upload cap)
- GCS: `briefing-intelligence/{reportId}/audio-chunks/bap-{reportId}/{index}.mp3`

---

## Retry / idempotency

- Transcription job: stale **processing** lease reclaim after **5 min**
- Chunk: up to **3** attempts; completed chunks skipped on retry
- Worker continuation from `nextChunkIndex`
- Assembly blocked until **all** chunks complete (no partial canonical transcript)
- Report generation: existing `briefingReportJobs` idempotency unchanged

---

## Cost controls

- Bounded chunk count, duration, retries, concurrency (1 chunk/worker invocation)
- No pricing/payout/payment code in chunk path
- ffmpeg temp dirs cleaned in `finally`

---

## Security

- Worker auth unchanged (`x-sync-secret` / admin)
- No transcript text in structured logs (reportId/chunk index only)
- Temp files under `/tmp/bap-*` with cleanup
- Admin SDK Firestore writes (consistent with existing jobs)

---

## Test results (pre-PR)

| Gate | Result |
|------|--------|
| typecheck | PASS |
| unit/integration | **466/466** pass (+17 chunking tests, +1 stale lease) |
| Briefing integration | PASS |
| Phase 3H / pricing / payout / push retirement | Included in full suite — PASS |

---

## Rollout recommendation

1. **Merge** this PR (does not enable chunking in production).
2. Deploy to Cloud Run (ffmpeg in image).
3. Enable `BRIEFING_AUDIO_CHUNKING_ENABLED=true` in **staging/pilot only**.
4. Run long-audio certification harness with realistic fixture (60–90 min).
5. Founder sign-off → enable in production Cloud Run env.

**Do not enable in production Cloud Run until PRODUCTION CERTIFIED — LONG-AUDIO BRIEFING TRANSCRIPTION.**

---

## Residual risks

1. Real-provider long-audio E2E not run in CI (mock ffmpeg + mock Whisper in unit tests).
2. First production enable increases Whisper API cost ~linearly with chunk count.
3. Founder diagnostics UI for chunk grid deferred (design §12 — ops can use Firestore/logs).

---

## Rollback

Set `BRIEFING_AUDIO_CHUNKING_ENABLED=false` or revert PR. No data migration required.
