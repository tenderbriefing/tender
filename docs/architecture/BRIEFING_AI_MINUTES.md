# Briefing AI Minutes

**Core rule:** AI minutes are a structured summary of the completed briefing transcript. The transcript remains the source of truth.

## Production flow

```
audio → Speechmatics transcript → AI summarisation/extraction → TenderBriefing minutes/report
```

For long audio:

```
audio → chunking → Speechmatics × N → stitch → final transcript → AI summarisation/extraction → TenderBriefing minutes/report
```

The AI minutes layer operates **only** on:

1. The completed (stitched) transcript
2. Approved job / tender metadata already available in TenderBriefing

It must **not** behave as:

- a transcription provider
- an external researcher
- a tender-document reconstruction engine

## Entry point

| Step | Module |
|------|--------|
| After transcript saved | `transcriptionHandoff.handoffAfterTranscriptSaved` |
| Queue | `enqueueReportGenerationWorker` |
| Generate | `generateMeetingMinutesReport` |
| Summarise | `OpenAIBriefingSummaryService.summarize` (`lib/briefing-intelligence/briefingSummaryService.ts`) |

Feature flag (fail-closed): `BRIEFING_AI_REPORT_GENERATION_ENABLED`.

Prompt version default: `v2-transcript-summary` (`BRIEFING_REPORT_PROMPT_VERSION`).

## Provider

- **Minutes model:** OpenAI Chat Completions (`BRIEFING_INTELLIGENCE_EXTRACT_MODEL`, default `gpt-4o`)
- **STT:** Speechmatics (unchanged by this layer)
- Mock provider for tests: `BRIEFING_INTELLIGENCE_PROVIDER=mock`

## Input

- `transcriptText` — full completed transcript
- `transcriptSegments` — optional timing / segment ids for provenance
- `officialMetadata` — title, reference, department, briefing date/venue, closing date/time
- `tenderDocumentText` — **amendment comparison only**; never used to invent undiscussed requirements

## Output schema (structured)

Extends `StructuredMeetingMinutesReport` / `BriefingSummary`:

- `purposeOfBriefing` (executive summary)
- `keyRequirementsDiscussed`
- `submissionRequirements` (or `Not discussed in the recorded briefing.`)
- `questionsAndAnswers[]` — `{ question, answer, unresolved?, sourceStartSeconds?, sourceEndSeconds?, transcriptSegmentIds? }`
- `amendments[]` — with optional `kind`: `confirmed_change` | `clarification_only` | `possible_future_amendment`
- `importantDates[]` — `{ date, description, uncertain? }`
- `technicalObservations`
- `risksAndWatchOuts`
- `actionsForSme[]`
- `verificationItems[]`
- `provenance[]` — optional `startSeconds` / `endSeconds` / segment ids

Malformed model output fails validation before persistence (`validateAndNormalize` / quality gate).

## Hallucination controls

Strict prompt rules:

1. Transcript is primary source of truth  
2. Do not invent facts  
3. Do not infer undiscussed requirements  
4. Do not fill gaps with general procurement knowledge  
5. Do not fabricate Q&A, dates, amounts, specs, deadlines  
6. Preserve uncertainty  
7. State when unclear  
8. State when not discussed  
9. Distinguish facts from interpretation  
10. Do not claim amendments without transcript support  
11. Do not treat speculation as official instruction  
12. Ignore noise / fragmented speech as reliable fact  

## Quality gates

| Failure class | Examples |
|---------------|----------|
| Transcript-quality | empty / too short / unintelligible |
| AI summarisation | invalid JSON/schema, provider 429/timeout, hallucination guard |
| Success with limited content | Short briefing may leave sections as “Not discussed…” — **not** a failure |

## Provider errors

OpenAI 429 / timeout / 5xx are recorded as **AI-minutes** failures (`ai_provider_rate_limit`, etc.), with `lastSuccessfulStage: transcription_complete` and `transcriptIntact: true`. The Speechmatics transcript is never discarded on AI failure; Founder can regenerate.

## Founder review

`/founder/briefing-reports/[reportId]/minutes` — review transcript, minutes, Q&A, clarifications, verification warnings; approve before delivery. Approval gate unchanged.

## PDF

`meetingMinutesPdf.ts` renders the structured sections for SME delivery after Founder approval.
