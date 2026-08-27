# Whisper transcription retirement

**Date:** 2026-08-27  
**Branch:** `chore/retire-whisper-transcription`  
**Status:** **PRODUCTION CERTIFIED — WHISPER TRANSCRIPTION RETIRED**  
**PR:** [#80](https://github.com/tenderbriefing/tender/pull/80)  
**Merge SHA:** `a84ed0905823c6a0b0c940c8e5bc4a69c9d6cdcc`  
**Deploy:** [33109843542](https://github.com/tenderbriefing/tender/actions/runs/33109843542) → `tenderbriefing-00150-q4g`

---

## Reason

Speechmatics is production-certified for short-audio direct transcription and long-audio chunked transcription (including ~65-minute production workloads). Whisper is no longer required and must not remain as a selectable transcription path or silent fallback.

---

## Scope

| In scope | Out of scope |
|----------|--------------|
| Remove reachable Whisper STT (`/audio/transcriptions`) | OpenAI chat extract / AI meeting minutes |
| Reject `BRIEFING_INTELLIGENCE_PROVIDER=openai\|whisper` | Chunking thresholds / ffmpeg behaviour |
| Update active ops/architecture docs | Historical certification narratives |
| Keep `OPENAI_API_KEY` for minutes/extract | PayFast / YA / Founder / SME flows |

---

## Production transcription architecture (post-retirement)

**Short audio**

`audio → Speechmatics → transcript → AI briefing report (OpenAI minutes when enabled)`

**Long audio**

`audio → ffprobe → chunk planner → ffmpeg → Speechmatics × N → stitch → AI briefing report`

---

## Provider configuration

`BRIEFING_INTELLIGENCE_PROVIDER` retained to avoid deployment churn.

| Value | Behaviour |
|-------|-----------|
| unset / `speechmatics` | Speechmatics STT |
| `mock` | Test mock |
| `openai` / `whisper` | **Throws** — retired |
| other | **Throws** — invalid |

No silent transcription fallback.

---

## Files changed (runtime)

| File | Change |
|------|--------|
| `lib/briefing-intelligence/transcriptionService.ts` | Removed Whisper `transcribe` implementation; OpenAI class retained for `extractIntelligence` only; selector rejects openai/whisper |
| `lib/briefing-intelligence/featureFlag.ts` | Comment cleanup |
| `lib/briefing-intelligence/processReport.ts` | Comment cleanup |
| `lib/briefing-intelligence/enqueueTranscription.ts` | Comment cleanup |
| `lib/briefing-intelligence/audioChunking/constants.ts` | Comment cleanup |
| `lib/briefing-intelligence/speechmaticsTranscriptionProvider.ts` | Comment cleanup |
| Tests / env examples / ops docs | Aligned to Speechmatics-only STT |

**Deployment secrets:** `OPENAI_API_KEY` **kept** (minutes/extract). `SPEECHMATICS_API_KEY` unchanged. No Whisper-only secret existed beyond the shared OpenAI key.

---

## Test results (pre-merge)

| Gate | Result |
|------|--------|
| typecheck | PASS |
| lint | PASS (pre-existing hooks warning) |
| unit/integration | **490/490** PASS |
| secrets scan | PASS |
| build | PASS |

Whisper-only transcription unit tests removed; selector tests assert `openai`/`whisper` throw.

---

## Historical note

Prior certification documents may describe Whisper as the then-current STT. Those records remain historically accurate. Active operational docs must describe Speechmatics-only transcription.
