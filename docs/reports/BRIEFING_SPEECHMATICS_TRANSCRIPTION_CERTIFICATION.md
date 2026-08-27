# Speechmatics transcription — production certification

**Programme:** TenderBriefing Rationalisation — transcription provider swap  
**PR:** [#73](https://github.com/tenderbriefing/tender/pull/73)  
**Date:** 2026-08-27  
**Status:** **PRODUCTION CERTIFIED — SPEECHMATICS TRANSCRIPTION**

---

## 1. Executive verdict

**PRODUCTION CERTIFIED — SPEECHMATICS TRANSCRIPTION**

Speechmatics is the live default STT provider on production Cloud Run. Short-audio production smoke completed with `provider=speechmatics`, no Whisper, no chunking. Controlled 65-minute long-audio pilot (local flag-on) transcribed **7/7 chunks** via Speechmatics and reconstructed successfully.

`BRIEFING_AUDIO_CHUNKING_ENABLED` remains **OFF** in production. Enabling chunking requires a separate Founder decision.

---

## 2. Release identity

| Item | Value |
|------|--------|
| Branch (merged) | `feat/briefing-speechmatics-transcription` |
| Base SHA (at PR) | `204fc5e` (post long-audio merge) |
| Final PR head | `abd781b` |
| PR | [#73](https://github.com/tenderbriefing/tender/pull/73) — merged `2026-08-27T11:03:22Z` |
| Merge SHA | `87cca320ab0f4a75f60e1e46e6dbe698f64a94fc` |
| Current master SHA (deployed) | `45ed0057e45a3b229f2f743fb9167ad0a1f0bfe4` |

Follow-on master commits after #73 (middleware + storageBucket worker fixes #74/#75) are on the same production revision chain and preserve Speechmatics config.

---

## 3. Deployment

| Item | Value |
|------|--------|
| Speechmatics first deploy run | [33065705778](https://github.com/tenderbriefing/tender/actions/runs/33065705778) @ `87cca32` |
| Current production deploy | [33069889958](https://github.com/tenderbriefing/tender/actions/runs/33069889958) — **success** |
| Production revision | `tenderbriefing-00147-p4b` |
| Deployed SHA | `45ed0057e45a3b229f2f743fb9167ad0a1f0bfe4` |
| Service URL | `https://tenderbriefing-xzgs5uw5ta-bq.a.run.app` |

---

## 4. Production configuration

| Item | Value |
|------|--------|
| Transcription provider | `BRIEFING_INTELLIGENCE_PROVIDER=speechmatics` |
| Speechmatics secret | GSM `Speechmatic_api` → `SPEECHMATICS_API_KEY` (**mounted**) |
| Whisper availability | Retained via explicit `BRIEFING_INTELLIGENCE_PROVIDER=openai` or `whisper` — **not** implicit fallback |
| Invalid provider | Throws — no silent fallback |
| OpenAI key | Still mounted for extract / meeting-minutes |
| Chunking flag | **ABSENT** → fail-closed **OFF** |
| Transcription / AI reports | `BRIEFING_AUDIO_TRANSCRIPTION_ENABLED=true`, `BRIEFING_AI_REPORT_GENERATION_ENABLED=true` |

---

## 5. Architecture (audit)

| Area | Behaviour |
|------|-----------|
| Abstraction | `TranscriptionProvider.transcribe(audioUrl)` + `extractIntelligence` |
| Speechmatics | Batch v2 (`eu1.asr.api.speechmatics.com`): upload → poll transcript → normalize to `TranscriptionResult` |
| Whisper | `OpenAITranscriptionProvider` — explicit only |
| Direct path | Signed GCS URL → `provider.transcribe()` → transcript store → BI handoff |
| Chunked path | Same provider per chunk when `BRIEFING_AUDIO_CHUNKING_ENABLED=true` (production OFF) |
| Auth | `Authorization: Bearer $SPEECHMATICS_API_KEY` — never logged |
| Empty / auth / 4xx / timeout | Throw — no empty successful transcript |
| Formats | Provider downloads whatever evidence MIME the pipeline stores (mp3 typical); Speechmatics accepts common audio |
| Payload | Existing 100 MB upload cap; chunk hard max ~24 MB |

---

## 6. Test gates

| Gate | Result |
|------|--------|
| typecheck | PASS |
| lint | PASS (pre-existing hooks warning only) |
| unit/integration | **484 passed** / 8 skipped (pilot opt-in) |
| secrets scan | PASS |
| build | PASS |
| mobile-field-qa | PASS (see run log) |
| Speechmatics unit coverage (request, auth, empty, 401, 429, timeout, invalid, selection, Whisper explicit, chunking fail-closed) | PASS |
| Real short Speechmatics cert (`SPEECHMATICS_SHORT_CERT=1`) | **PASS** — job `lgizm2pvap`, 14 words, ~4.2 s |

---

## 7. Short-audio production smoke

| Item | Value |
|------|--------|
| Script | `SPEECHMATICS_PROD_SMOKE=1 node scripts/speechmatics-prod-transcription-smoke.js` |
| Result | **PASS** (`ok: true`) |
| reportId | `TB-BR-SMBLG1` |
| jobId | `tj-TB-BR-SMBLG1` |
| Job status | `completed` |
| Provider | `speechmatics` / model `speechmatics-enhanced` |
| Word count | 9 |
| Whisper used | **false** |
| Chunking invoked | **false** |
| Elapsed | ~21.6 s |
| Report generation | `failed_quality_gate` — expected for tiny smoke transcript (*"Transcript is too short…"*). Proves handoff + fail-safe gate; **not** a Speechmatics STT failure. Founder approval / SME delivery not exercised (smoke marked `doNotDeliver`). |

---

## 8. Long-audio controlled pilot (Speechmatics)

**Context:** Local Founder-authorised harness (`LONG_AUDIO_PILOT=1`). Chunking flag **on only for pilot**. Production chunking **unchanged OFF**.

| Metric | Value |
|--------|--------|
| Fixture target | 65 min |
| Measured duration | **3,896,256 ms (~65.0 min)** |
| Fixture size | **31,171,149 bytes (~29.7 MB)** |
| Chunk count | **7** |
| Speechmatics | **7/7 completed**, 1 attempt each |
| Per-chunk STT wall | ~16–29 s |
| Total pilot wall | ~170 s (fixture + ffmpeg + STT + assemble) |
| Stitching / overlap merge | **PASS** |
| Ordering | `chunkIndex` order |
| Downstream AI report on combined transcript | Not run in production (pilot local). Unit/integration minutes path unchanged. |

---

## 9. Security / configuration

| Check | Result |
|-------|--------|
| Secret in GSM only (`Speechmatic_api`) | PASS |
| No plaintext key in repo / `.env.local` | PASS |
| Secrets scan | PASS |
| No API key in logs | PASS (job IDs / counts only) |
| Empty transcript rejected | PASS |
| Invalid provider rejected | PASS |
| No silent Whisper fallback | PASS |

---

## 10. Rollback readiness

| Item | Value |
|------|--------|
| Previous Speechmatics-intro revision | First Speechmatics deploy @ `87cca32` → subsequent `00147` includes worker fixes |
| Pre-Speechmatics path | Set `BRIEFING_INTELLIGENCE_PROVIDER=openai` (Whisper) **or** redeploy prior revision from before #73 (`tenderbriefing-00144-*` era / long-audio-only) |
| Secret | Keep `Speechmatic_api` — do not delete on rollback |
| Chunking | Remains OFF |
| Existing requests | Jobs already completed keep their transcripts; new jobs follow restored provider |

**Rollback procedure (if needed):**

1. Redeploy with `BRIEFING_INTELLIGENCE_PROVIDER=openai` in `cloudbuild.yaml` `--set-env-vars`, **or** traffic-shift to last known-good pre-#73 revision.
2. Confirm Whisper path with short smoke.
3. Leave `SPEECHMATICS_API_KEY` mounted (harmless) or remove in a follow-up.

---

## 11. Remaining Founder decision

**Do NOT enable `BRIEFING_AUDIO_CHUNKING_ENABLED=true` in production yet without explicit Founder approval.**

Speechmatics STT is production-certified for the **direct** path. Long-audio chunking structural + Speechmatics provider pilot **passed** in controlled local context. Production enablement of chunking remains a **separate Founder decision**.

Recommended next Founder prompt (when ready):

> READY FOR FOUNDER APPROVAL — ENABLE LONG-AUDIO CHUNKING IN PRODUCTION
