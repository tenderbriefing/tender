# Long-audio production certification — Speechmatics chunking

**Programme:** TenderBriefing Rationalisation — long-audio enablement  
**Date:** 2026-08-27  
**Status:** **PRODUCTION CERTIFIED — LONG-AUDIO SPEECHMATICS TRANSCRIPTION**

---

## 1. Executive verdict

**PRODUCTION CERTIFIED — LONG-AUDIO SPEECHMATICS TRANSCRIPTION**

Production now runs:

- `BRIEFING_INTELLIGENCE_PROVIDER=speechmatics`
- `BRIEFING_AUDIO_CHUNKING_ENABLED=true`

Short audio uses **direct Speechmatics**. Long audio uses **ffprobe → planner → ffmpeg chunks → Speechmatics per chunk → stitch → BI handoff**. Whisper remains **explicit-only** (no silent fallback).

---

## 2. Release identity

| Item | Value |
|------|--------|
| Master SHA (certified) | `4e0be5f4b355eaed8d6f4cf42b64676e7cd456b5` |
| Enablement PR | [#77](https://github.com/tenderbriefing/tender/pull/77) (`9dbd550`) |
| Pre-decision ffprobe fix | [#78](https://github.com/tenderbriefing/tender/pull/78) (`4e0be5f`) |
| Chunking enable deploy | [33090508349](https://github.com/tenderbriefing/tender/actions/runs/33090508349) → revision `00148` |
| Fix deploy | [33092896324](https://github.com/tenderbriefing/tender/actions/runs/33092896324) → revision **`tenderbriefing-00149-z99`** |
| Traffic | **100%** on `tenderbriefing-00149-z99` |
| Previous rollback revision | `tenderbriefing-00147-p4b` (chunking OFF) |

---

## 3. Production configuration

| Item | Value |
|------|--------|
| Provider | `speechmatics` |
| Chunking | **`BRIEFING_AUDIO_CHUNKING_ENABLED=true`** |
| Speechmatics secret | GSM `Speechmatic_api` → `SPEECHMATICS_API_KEY` mounted |
| Whisper | Explicit `BRIEFING_INTELLIGENCE_PROVIDER=openai\|whisper` only |
| ffmpeg | Present in Docker runner image (`apk add ffmpeg`) |

### Blocker fixed during enablement

Initial long-audio attempt (`TB-BR-LABQ1R`) failed with `audio_too_long` because pre-decision used **size-only duration estimate** (~480 B/s), falsely treating ~30 MB / 65 min mp3 as >120 min.  

**Fix (PR #78):** ffprobe source duration before direct/chunked routing when chunking is enabled.

---

## 4. Test gates (pre-enablement)

| Gate | Result |
|------|--------|
| typecheck | PASS |
| lint | PASS (pre-existing hooks warning) |
| unit/integration | **492/492** PASS |
| secrets scan | PASS |
| build | PASS |

---

## 5. Short-audio production smoke

| Item | Value |
|------|--------|
| reportId | `TB-BR-SMBTOP` |
| Result | **PASS** (`ok: true`) |
| Provider | `speechmatics` / `speechmatics-enhanced` |
| Chunking invoked | **false** |
| Whisper used | **false** |
| Job | `completed` |
| Report gen | `failed_quality_gate` (9-word synthetic — expected fail-safe) |
| Elapsed | ~25.5 s |

---

## 6. ~65-minute production long-audio pilot

| Item | Value |
|------|--------|
| reportId | `TB-BR-LABTQ5` |
| Source duration | **3,893,412 ms (~64.9 min)** |
| Source size | **31,148,397 bytes (~29.7 MB)** |
| Mode | **`chunked`** |
| Planned / extracted chunks | **7 / 7** |
| Speechmatics success | **7/7** (1 attempt each) |
| Failed chunks | **0** |
| Retries | **0** |
| Provider | `speechmatics` on all chunks + assembled transcript |
| Whisper used | **false** |
| Stitched transcript | **43,109 chars** (substantial; non-empty) |
| Job / BAP status | both **`completed`** |
| Wall clock (start→complete) | ~52 min (`17:56:37Z` → `18:48:11Z`) |

### Chunk map

| Index | Range (ms) | Status | Attempts | Text length |
|-------|------------|--------|----------|-----------|
| 0 | 0–600000 | completed | 1 | 6643 |
| 1 | 590000–1200000 | completed | 1 | 6757 |
| 2 | 1190000–1800000 | completed | 1 | 6753 |
| 3 | 1790000–2400000 | completed | 1 | 6769 |
| 4 | 2390000–3000000 | completed | 1 | 6790 |
| 5 | 2990000–3600000 | completed | 1 | 6767 |
| 6 | 3590000–3893412 | completed | 1 | 3349 |

---

## 7. Stitching integrity

| Check | Result |
|-------|--------|
| All chunks completed before assembly | PASS |
| Canonical `chunkIndex` order | PASS (0…6) |
| No failed / missing chunks | PASS |
| Non-empty final transcript | PASS |
| No Whisper provider labels | PASS |
| Overlap windows present (10 s) | PASS (adjacent startMs < prior endMs) |

---

## 8. Downstream AI report result

| Item | Result |
|------|--------|
| Transcription / handoff | **PASS** |
| AI report generation | **FAIL** — OpenAI **429 quota exceeded** on summary/extract |
| Classification | **Downstream content/AI failure**, not transcription/chunking failure |
| SME delivery | Not attempted (`doNotDeliver` smoke) |
| Founder approval | Not altered on customer jobs |

Synthetic looped fixture is also content-weak for minutes quality; primary blocker observed was **OpenAI quota**, not stitch quality.

---

## 9. Security checks

| Check | Result |
|-------|--------|
| Secret only via GSM mount | PASS |
| No API key in cert logs | PASS |
| Smoke does not print transcript body | PASS |
| Worker auth via sync secret | PASS |

---

## 10. Rollback readiness

1. **Config:** set `BRIEFING_AUDIO_CHUNKING_ENABLED=false` in `cloudbuild.yaml` and redeploy.  
2. **Traffic:** shift to `tenderbriefing-00147-p4b` (pre-chunking enable).  

Whisper remains available via explicit provider env if needed. Chunking rollback does not remove Speechmatics.

---

## 11. Final operational recommendation

**Long-audio chunking is production-certified and enabled.**

Operational follow-ups (not blockers for chunking certification):

1. Restore OpenAI billing/quota so AI meeting-minutes can complete after long transcripts.  
2. Monitor Cloud Run wall time for multi-chunk jobs (~50 min for ~65 min audio with sequential continuation).  
3. Keep Founder approval mandatory before SME delivery.

**No further product-development phase opened by this workstream.**
