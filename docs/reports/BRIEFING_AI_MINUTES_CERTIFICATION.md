# Briefing AI Minutes — Certification

**Status:** PRODUCTION CERTIFIED — AI MINUTES STRUCTURED TRANSCRIPT SUMMARY

**Core rule:** AI minutes are a structured summary of the completed briefing transcript. The transcript remains the source of truth.

## Scope certified

Refine AI minutes so the model only summarises/structures the completed Speechmatics transcript into TenderBriefing minutes. No STT, chunking, PayFast, YA payout, SME booking, or Founder auth changes.

## Certification fixture

Deterministic fixture: `lib/briefing-intelligence/fixtures/aiMinutesCertificationTranscript.ts`

Contains:

- introductions and requirements
- ≥3 bidder questions with official answers (one unresolved)
- ≥2 dates
- one clarification (site access after 16:00)
- one uncertain statement (performance bond “I think…”)
- one requirement explicitly not discussed (local-content)

Validated by: `tests/briefing-intelligence/unit/aiMinutesTranscriptSummary.test.ts`

## Checks verified

| Check | Result |
|-------|--------|
| No invented facts (e.g. fabricated local-content %) | Pass |
| Q&A pairs accurate; unresolved parking marked | Pass |
| Dates 15 Oct 2026 / 20 Sep 2026 | Pass |
| Clarification kind = clarification_only | Pass |
| Uncertain bond → verificationItems | Pass |
| Absent info remains absent / “Not discussed” | Pass |
| Actions grounded in transcript | Pass |
| AI 429 ≠ transcript failure | Pass |
| Transcript preserved after AI job failure | Pass |
| Same path for short + stitched transcript | Pass |
| Founder approval mapping unchanged (still draft → approve) | Pass |

## Gate totals (this branch)

| Gate | Result |
|------|--------|
| typecheck | Pass |
| lint | Pass (pre-existing hook warning only) |
| vitest (`npm test`) | **75** files, **507** tests passed |
| briefing-intelligence suite | **22** files, **129** tests passed |
| build | Pass |
| secrets scan | Pass |
| PDF smoke (`scripts/smoke-meeting-minutes-pdf.ts`) | Pass |

## Non-goals

Do not run a real customer delivery solely for this certification.
