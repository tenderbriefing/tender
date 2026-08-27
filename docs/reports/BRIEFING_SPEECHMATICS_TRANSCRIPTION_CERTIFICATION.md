# Speechmatics transcription — production certification

**Programme:** TenderBriefing Rationalisation — transcription provider swap  
**Branch:** `feat/briefing-speechmatics-transcription`  
**Date:** 2026-08-27  
**Status:** Pre-merge / deploy certification in progress

---

## Architecture summary

| Item | Behaviour |
|------|-----------|
| Abstraction | `TranscriptionProvider` (`transcribe` + `extractIntelligence`) |
| Default STT | **Speechmatics Batch** (`SpeechmaticsTranscriptionProvider`) |
| Explicit Whisper | `BRIEFING_INTELLIGENCE_PROVIDER=openai` or `whisper` |
| Mock | `BRIEFING_INTELLIGENCE_PROVIDER=mock` |
| Invalid provider | **Throws** — no silent Whisper fallback |
| Extract / minutes | Still OpenAI when that path runs (`OPENAI_API_KEY`) |
| Chunking | Fail-closed OFF unless `BRIEFING_AUDIO_CHUNKING_ENABLED=true` |

Secret: GSM `Speechmatic_api` → Cloud Run env `SPEECHMATICS_API_KEY`.

---

## Local real-provider short certification

| Item | Result |
|------|--------|
| Fixture | Spoken `say` → mp3 (~few seconds) |
| Provider | `speechmatics` |
| Job ID | `j59gcf9c49` |
| Word count | 14 |
| Elapsed | ~2.2 s |
| Empty non-speech sine | Correctly **rejected** (empty text) |

---

## Production constraints

- Do **not** enable `BRIEFING_AUDIO_CHUNKING_ENABLED` in this release.
- Whisper retained as explicit emergency option only.
- No plaintext API keys in repo.
