# Briefing AI Minutes — Simple Summary Certification

**Status:** PRODUCTION CERTIFIED — SIMPLE AI TENDER BRIEFING SUMMARY

**Architecture:** Speechmatics transcript → simple AI structured summary → Founder review → SME briefing report

## Founder decision

SME-facing AI minutes must **not** include timestamps, segment/chunk IDs, or per-item provenance. The transcript remains the separate source record.

## Tests

`tests/briefing-intelligence/unit/aiMinutesTranscriptSummary.test.ts` covers:

1. Generation without timestamps  
2. Generation without segment IDs  
3. Q&A accuracy  
4. Date accuracy  
5. Clarification classification  
6. Unsupported-fact suppression  
7. Verification for uncertain statements  
8. Grounded actions  
9. Short-transcript quality gates  
10. Long stitched transcript same path  
11. Founder review mapping unchanged  
12. PDF/structured content free of timestamp/segment metadata  

## Scope

AI minutes report simplification only. No Speechmatics, chunking, PayFast, YA, booking, pricing, or provider changes.
