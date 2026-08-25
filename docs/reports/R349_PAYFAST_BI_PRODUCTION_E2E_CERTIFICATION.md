# R349 PayFast + Briefing Intelligence — Production E2E Certification

**Date:** 2026-08-25  
**Repository:** tenderbriefing/tender  
**Certification request:** `req-1787605208259-42bhi4`

---

## 1. Executive Verdict

**PASS WITH CONDITIONS**

Primary blocker:

**BLOCKED — REAL PAYFAST SETTLEMENT REQUIRED**

The authorised smoke request remains `paymentStatus: pending`. Live PayFast checkout is healthy and correctly priced at R349.00, but no successful ITN has marked the request paid. Phases C–H (YA liability, evidence, Whisper, AI report, Founder approval, SME delivery) cannot proceed on this request without fabricating payment success, which is forbidden.

---

## 2. Certification Request

`req-1787605208259-42bhi4`

| Field | Production value |
|-------|------------------|
| SME | Smoke Test SME (`ops-smoke-sme@tenderbriefing.co.za`) |
| Tender | `tb-166733` / `166733` — TE/2026/08/3460/10324/RFQ |
| Province | Gauteng |
| Created | 2026-08-24T21:00:08.259Z |
| Suitability | **Suitable** — correct R349 snapshot; unpaid only |

No substitute paid booking was created.

---

## 3. Starting Production SHA

App (Cloud Run revision `tenderbriefing-00130-6xv`):  
`c6182f65666689ae352e2c1e987b0ce25845bc0d`

Local / `origin/master` at certification start:  
`39c3196e6829ae890bdaeab6656840aec6b1b5a7` (docs-only commit after app SHA)

---

## 4. Final Production SHA

**Unchanged** for application code.

App production SHA remains:  
`c6182f65666689ae352e2c1e987b0ce25845bc0d`

No feature or payment code was modified during this certification attempt.

---

## 5. Production Revision

`tenderbriefing-00130-6xv` @ **100%** traffic (africa-south1)

Feature flags (production):

| Flag | Value |
|------|-------|
| `PAYFAST_MODE` | `live` |
| `BRIEFING_AUDIO_TRANSCRIPTION_ENABLED` | `true` |
| `BRIEFING_AI_REPORT_GENERATION_ENABLED` | `true` |
| `BRIEFING_REPORT_PROMPT_VERSION` | `v1` |
| `FOUNDER_USER_INTELLIGENCE_ENABLED` | `true` |
| `FOUNDER_EMAIL_ALLOWLIST` | `info@tenderbriefing.co.za` |
| `OPENAI_API_KEY` | bound (secret; not exposed) |

---

## 6. PayFast Settlement

| Check | Result |
|-------|--------|
| Request exists | Yes |
| Price snapshot | **34900** (`briefingPriceCents` / `paymentAmount` / `quotedFee`) |
| Pricing version | `2026-08-v349` |
| Currency | ZAR |
| Merchant reference | `TB-REQ-req-1787605208259-42bhi4` |
| Provider | `payfast` |
| Live checkout regenerate | **200** — `https://www.payfast.co.za/eng/process` |
| Checkout amount field | **349.00** (client amount override ignored) |
| Signature present | Yes |
| `paymentStatus` | **`pending`** |
| `payfastPaymentId` | `null` |
| `paidAt` | `null` |
| ITN received for this request | **No** (no audit docs; no paid transition) |
| Idempotency on this request | N/A — never settled |

Human continuation URL (authorised SME):

`https://www.tenderbriefing.co.za/sme/requests/confirmation?requestId=req-1787605208259-42bhi4`

**Settlement status: NOT COMPLETE**

---

## 7. Commercial Reconciliation

Expected (constants + request snapshot):

| Line | Amount |
|------|--------|
| Customer paid | R349.00 (**34900**) — *expected after ITN; not yet paid* |
| YA liability | R200.00 (**20000**) — *created on evidence submit, not on paid* |
| Gross commercial margin | R149.00 (**14900**) |

Legacy: `LEGACY_BRIEFING_PRICE_CENTS = 24900` unchanged; no historical backfill observed.

**Actual reconciliation:** incomplete — customer settlement has not occurred.

---

## 8. YA Liability Record

| Check | Result |
|-------|--------|
| `youthAgentPayouts` for request | **0 records** |
| Expected after evidence | `ya-payout-{requestId}`, amount **20000**, status `eligible` |

Blocked pending paid → YA accept/assignment path and evidence submission.

---

## 9. YA Submission

**Not executed** — request unpaid; no evidence artefacts.

Architecture (ready when paid):

- `POST /api/briefing-intelligence/evidence`
- Required: briefing audio + ≥1 attendance proof
- Assignment gate: `agentId` / `assignedAgentId` / `notifiedAgents`
- Observations JSON not required

---

## 10. Transcription

**Not executed** (no evidence → no job).

Flags: `BRIEFING_AUDIO_TRANSCRIPTION_ENABLED=true`; OpenAI secret bound.

Expected: async Whisper via `briefingTranscriptionJobs` / worker (HTTP not blocked on Whisper).

---

## 11. AI Report Generation

**Not executed**.

Flags: `BRIEFING_AI_REPORT_GENERATION_ENABLED=true`; prompt version `v1`.

Expected: transcript → quality gate → meeting minutes → PDF (not a transcript dump).

---

## 12. Founder Approval

**Not executed** (no report to approve).

Founder access control verified separately:

- Founder finance / dashboard: **200**
- YA / SME / non-founder admin: **403**

---

## 13. SME Delivery

**Not executed** (no approved report).

SME can still load own request (**200**). Report PDF gate requires approved/final/delivered.

---

## 14. Security / IDOR Matrix

| Actor | Resource | Expected | Observed |
|-------|----------|----------|----------|
| Anonymous | YA evidence POST | 401 | **401** |
| Anonymous | Founder finance | 401 | **401** |
| Anonymous | Founder BI reports | 401 | **401** |
| SME | Founder finance | 403 | **403** |
| YA | Founder finance | 403 | **403** |
| Non-founder admin | Founder finance | 403 | **403** |
| Founder (allow-listed) | Founder finance | 200 | **200** |
| Founder | Founder dashboard | 200 | **200** |
| Authorised YA | Banking GET (masked) | 200, no full account | **200**, masked only |
| Authorised SME | Own attendance request | 200 | **200** |

Phases requiring paid report (SME B IDOR on approved PDF, Founder approve) **not exercised** — no report exists.

---

## 15. Regression Gates

| Gate | Result |
|------|--------|
| Typecheck | **PASS** |
| Lint | **PASS** (existing hooks warning only) |
| Unit tests (`tests/unit`) | **PASS** 308/308 |
| Briefing Intelligence unit | **PASS** |
| PayFast ITN / signature / pricing unit | **PASS** |
| Finance / YA banking / payout batch unit | **PASS** |
| Firestore IDOR emulator | **PASS** 46/46 |
| Production build | **PASS** |
| Founder finance prod probe | **PASS** (200) |
| Playwright (this session) | Not re-run; last master CI green on `39c3196` / #59 |
| Founder V2 CI workflow | Last dedicated run older; finance path verified live |

---

## 16. Production Monitoring

| Signal | Notes |
|--------|-------|
| Homepage / Firestore health | 200 / ok |
| PayFast ITN for this request | None |
| Historical PayFast webhook | Older 200/401 noise (Aug 18); unrelated to this smoke |
| Sustained 5xx (24h) | Founder finance/payout-batches 500s on `00129` from require-path bug — **fixed by PR #59** on `00130` |
| Transcription / OpenAI errors for this request | None (pipeline not started) |
| Duplicate payment / liability | None |

---

## 17. Banking / EFT Regression

**Intact — PRODUCTION CERTIFIED banking/manual-EFT baseline preserved.**

- Smoke YA banking profile still present (version 2)
- YA API returns masked account only
- No banking API / auto-EFT introduced
- No monthly batch fabricated for this certification
- R200 job-level liability model unchanged (still evidence-gated)

---

## 18. Defects / Fixes

| Item | Action |
|------|--------|
| Unpaid smoke request | **No code change** — requires real PayFast settlement |
| Prior Founder finance 500 | Already fixed in merged PR #59 (not reopened) |

No new PR created for this certification attempt.

---

## 19. Rollback Readiness

| Item | Value |
|------|-------|
| Previous known-good revision (pre-banking hotfix era) | `tenderbriefing-00128-p8d` |
| Banking + hotfix revision (current) | `tenderbriefing-00130-6xv` |
| Previous Git SHA (pre-#58) | `392ae6496ff3c03ee00ce08f07f9c060b98d1924` |
| Current app SHA | `c6182f65666689ae352e2c1e987b0ce25845bc0d` |
| Procedure | Redeploy prior Cloud Run revision / prior Git SHA via Deploy TenderBriefing; redeploy matching Firestore rules |
| Data | Do **not** delete banking profiles or historical payment docs on rollback |

---

## 20. Remaining Blockers

1. **Real R349 PayFast settlement** on `req-1787605208259-42bhi4` (ITN → `paymentStatus: paid`)
2. Thereafter, complete Phases C–H on the **same** request:
   - YA accept / authorised submission link
   - Audio + attendance evidence
   - Whisper transcription success
   - AI report quality gate + PDF
   - Founder approval (quality-gated)
   - SME approved-report access + IDOR

---

## 21. Final Recommendation

**No-ship for “PRODUCTION CERTIFIED — R349 COMMERCIAL + BRIEFING INTELLIGENCE”.**

Commercial checkout path is production-ready (live PayFast, R349 snapshot, banking intact). Certification of the full commercial + BI chain remains blocked solely on **human completion of the live R349 payment** for the authorised smoke request.

**Founder action:** Complete payment at the confirmation URL above using the smoke SME account, then re-run this certification from Phase B onward without creating a new paid booking.

---

## Appendix A — Architecture map (Phase A)

```
SME Booking (attendanceRequests, snapshot 34900)
  → PayFast live checkout (create-checkout → www.payfast.co.za)
  → ITN POST /api/webhooks/payfast (sign + amount → markRequestPaid, idempotent)
  → YA accept/assign (paid-gated) / notifiedAgents
  → Evidence POST /api/briefing-intelligence/evidence (audio + attendance)
  → youthAgentPayouts ensurePayoutOnEvidenceSubmitted (20000, eligible)
  → [flag] Whisper worker (async)
  → [flag] AI meeting-minutes worker + quality gate + PDF
  → Founder approve (admin / founder minutes API)
  → SME PDF/list (approved/final/delivered only)
```

Primary files:

- Pricing: `backend/constants/briefingPricing.js`
- Checkout / ITN: `backend/services/payments/attendancePaymentService.js`, `app/api/webhooks/payfast/route.ts`
- Liability: `backend/services/finance/youthAgentPayoutService.js`
- Evidence: `app/api/briefing-intelligence/evidence/route.ts`
- Transcription / report workers: `app/api/briefing-intelligence/transcription/worker`, `…/report/worker`
- Founder minutes: `app/api/briefing-intelligence/reports/[reportId]/minutes`
- SME PDF: `app/api/briefing-intelligence/reports/[reportId]/pdf`
