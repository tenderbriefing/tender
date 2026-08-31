# Private Tender Phase 3 — Production Certification Report

**Date:** 2026-08-26  
**PR:** [#64](https://github.com/tenderbriefing/tender/pull/64)  
**Branch:** `feat/private-tender-briefing-operations-phase3`

---

## Step 1 — Release identity (verified)

| Item | Value |
| --- | --- |
| Prior tip (implementation report) | `fad7adef02d9a7a1197e46aaf111252e66d28c1c` |
| PR head at certification start | `fad7adef02d9a7a1197e46aaf111252e66d28c1c` (**match**) |
| Base SHA | `cdeb8586ad3b6c41bccafd08caa44d24ba3c567b` |
| Mergeable | MERGEABLE / CLEAN |
| CI at start | All SUCCESS (typecheck/lint/unit/integration, Firestore IDOR, build, Playwright, Founder smoke) |
| Reviews | None blocking |

Hardening commits after this identity will produce a **new certified head** before merge.

---

## Architecture (certified intent)

Extends Phase 1+2 private tenders → R349 attendance → YA evidence → Whisper → AI minutes → Founder approve → SME delivery → append-only clarifications.

No parallel marketplace, payment engine, payout engine, or AI report stack.

---

## Phase 3H — Notifications (closed)

Reuse: `briefingLifecycleNotificationService` (Founder Resend + idempotency) + `transactionalEmailService` templates.

| # | Event | Audience | Status |
| --- | --- | --- | --- |
| 1 | Upcoming compulsory briefing | Founder | Wired (`notifyUpcomingBriefingSafe`) |
| 2 | YA assigned | YA + SME | Existing TX emails |
| 3 | YA accepts | YA + SME | Existing assign/accept path |
| 4 | Evidence submitted | Founder | Wired |
| 5 | Transcription completed | Founder | Wired |
| 6 | AI draft ready | Founder | Wired |
| 7 | AI/report failure | Founder only (SME-safe copy) | Wired |
| 8 | Founder approves report | Founder | Wired |
| 9 | SME report delivered | SME | Existing BI deliver TX |
| 10 | SME clarification requested | Founder | Wired (`POST /api/sme/briefing-clarifications`) |
| 11 | Clarification response added | Founder | Wired |
| 12 | Clarification resolved | Founder + SME TX | Wired |
| 13 | Assignment reassigned | Founder | Wired on admin reassign |
| 14 | Evidence correction required | Founder + YA TX | Wired |

Idempotent keys under `notifications` (`briefing-life-idem-*` / `tx-email-idem-*`). Fail-soft Safe wrappers.

---

## AI v2 quality gate

- Nested `briefingIntelligenceV2` in model `outputSchema` when flag on
- `attachV2SectionsIfEnabled` **never** falls back to whole raw v1 blob
- Expanded sections: executive summary, amendments, returnables, technical/commercial/site/attendance, Q&A, outstanding, risks, recommended SME actions, qualityWarnings
- Authoritative cover + closing date/time forced
- Deliver requires `reportGenerationStatus === 'approved'` when AI gen enabled
- YA R200 eligibility remains evidence-triggered (not AI-tied)
- Failure preserves evidence / request / transcript; Founder notified

---

## Feature flags (fail-closed; OFF at merge)

| Flag | Default | Rollout stage |
| --- | --- | --- |
| `PRIVATE_TENDER_BRIEFING_BOOKING_ENABLED` | off | 1 — 3A |
| `NEXT_PUBLIC_PRIVATE_TENDER_BRIEFING_BOOKING_ENABLED` | off | UI CTA |
| (ops KPIs / recommendations reuse booking flag or always-on Founder routes when booking flag on) | — | 2–3 |
| Evidence integrity | additive metadata (no separate flag) | 4 |
| `BRIEFING_FOLLOW_UP_UPDATES_ENABLED` (+ optional NEXT_PUBLIC) | off | 5–6 |
| `BRIEFING_INTELLIGENCE_V2_ENABLED` | off | 7 |
| Notifications | code-path always available; gated by lifecycle events | 8 |

---

## Financial invariants

- SME booking: **34900** cents  
- YA liability: **20000** cents  
- Gross: **14900** cents  
- PayFast / banking / monthly EFT unchanged  

---

## Rollout / rollback

1. Merge #64 on certified head  
2. Deploy app + rules + indexes with **all Phase 3 flags OFF**  
3. Regression smoke Phase 1/2 + R349 checkout stop-before-pay  
4. Incremental flag enablement (3A→3B/C→3D→3G→3F→3E→3H)  
5. Rollback: disable flags first; app revision to `tenderbriefing-00137-fbl` lineage if needed; do not delete financial/audit/evidence  

---

## Certification status

Filled during Steps 9–17 of controlled rollout.
