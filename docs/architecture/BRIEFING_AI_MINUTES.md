# Briefing AI Minutes

**Core rule:** Completed transcript in → structured tender briefing summary out. The transcript remains the source of truth.

## Production flow

```
Speechmatics transcript → simple AI structured summary → Founder review → SME briefing report
```

Long audio uses the same AI path after stitch:

```
audio → chunking → Speechmatics × N → stitch → final transcript → AI summary → Founder review → SME report
```

## SME-facing report sections

1. Executive summary  
2. Key requirements discussed  
3. Submission requirements (or “Not discussed in the recorded briefing.”)  
4. Questions and answers  
5. Clarifications or changes (`clarification_only` | `confirmed_change` | `possible_future_amendment`)  
6. Important dates (date/time + what it relates to)  
7. Technical or site observations  
8. Risks and watch-outs  
9. Actions for the SME  
10. Items requiring verification  

**Not included in the SME report:** timestamps, transcript segment IDs, chunk IDs, per-item provenance, line-by-line citations, LLM metadata.

The completed Speechmatics transcript is stored separately. Founder reviews the full transcript when verification is needed.

## Entry point

| Step | Module |
|------|--------|
| After transcript saved | `transcriptionHandoff.handoffAfterTranscriptSaved` |
| Queue | `enqueueReportGenerationWorker` |
| Generate | `generateMeetingMinutesReport` |
| Summarise | `OpenAIBriefingSummaryService.summarize` |

Feature flag: `BRIEFING_AI_REPORT_GENERATION_ENABLED` (fail-closed).  
Prompt version: `BRIEFING_REPORT_PROMPT_VERSION` (default `v2-transcript-summary`).

## Provider

OpenAI Chat Completions (`BRIEFING_INTELLIGENCE_EXTRACT_MODEL`, default `gpt-4o`). Unchanged.

## Input

- Full completed transcript text  
- Official job/tender metadata (cover fields)  
- Optional tender document text for amendment comparison only  

Segment timing may exist on the transcript record but is **not** required for AI minutes and is not sent to the model for citation mapping.

## Hallucination controls

1. Transcript is source of truth  
2. Never invent facts / Q&A / dates / amounts / requirements  
3. Never fill gaps with generic procurement knowledge  
4. Preserve uncertainty  
5. State when not discussed  
6. Distinguish official statements from speculation  
7. Possible future amendments stay unconfirmed until officially issued  
8. Useful summary — do not reconstruct the full tender document  

## Founder review

Structured summary + Q&A + clarifications + dates + risks + actions + verification items + link to full transcript. Approval gate unchanged. No timestamp-heavy UI.

## Quality / failures

Missing provenance never fails generation. AI 429/timeouts are AI-minutes failures; transcript remains intact for regenerate.
