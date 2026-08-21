# Briefing Intelligence — Real Production Smoke Runbook

**Not a certification.** Operational checklist for the authorised human YA → Founder smoke.

Production URL: https://www.tenderbriefing.co.za

---

## Pre-check

- [ ] Authorised Youth Agent account available
- [ ] Real assigned briefing with valid assignment
- [ ] Valid briefing audio (MP3/M4A/WAV/AAC, ≤100MB)
- [ ] Attendance register photo/PDF (JPEG/PNG/WebP/PDF, ≤10MB)
- [ ] Founder account available
- [ ] Flags: `BRIEFING_AUDIO_TRANSCRIPTION_ENABLED=true`, `BRIEFING_AI_REPORT_GENERATION_ENABLED=true`, `BRIEFING_REPORT_PROMPT_VERSION=v1`
- [ ] OpenAI mounted: `OPENAI_API_KEY` ← `Open_ai_Secret_Key`
- [ ] Production health: homepage + `/api/health/firestore` OK

---

## Youth Agent

1. Sign in as Youth Agent  
2. Open assigned briefing → **Submit Report**  
3. Upload briefing audio  
4. Upload attendance evidence  
5. Submit  
6. Confirm acknowledgement + Report ID (`TB-BR-…` = `briefingRunId`)  
7. Leave page (processing is async)

---

## Technical verification (Founder / ops)

Using Report ID / `briefingRunId`:

- [ ] Submission persisted (`evidence_uploaded` → processing)
- [ ] Transcription job created (`tj-{reportId}`)
- [ ] Whisper completes; transcript persisted
- [ ] Report job runs; draft PDF generated
- [ ] `reportGenerationStatus=draft_ready` (or `failed_quality_gate` with clear reason)
- [ ] Evidence still intact if AI fails
- [ ] No unexpected 5xx on public site

---

## Founder

1. Open `/founder/briefing-reports` → report minutes  
2. Review diagnostics (stage, retries, warnings)  
3. Open PDF + attendance evidence  
4. Compare report vs known briefing facts / audio  
5. Check tender number, closing date, amendments  
6. Confirm no speaker labels / invented attendees  
7. Regenerate only if needed (creates new version)  
8. Approve  

---

## Post-check

- [ ] Approved version recorded (`approvedBy` / `approvedAt`)
- [ ] YA cannot approve Founder-controlled AI draft
- [ ] Draft PDF not exposed to SME/YA before approval
- [ ] No duplicate uncontrolled approved versions
- [ ] Transcript not exposed to SME
- [ ] Audit events present

---

## Certification decision

**PASS:** all stages succeed and report quality is acceptable.  
**FAIL:** security, integrity, workflow, Whisper/OpenAI, or material accuracy defect.

Only after PASS may production certification be upgraded to **PRODUCTION CERTIFIED**.
