# Batch C — Incomplete Capabilities Founder Decision Memo

**Programme:** TenderBriefing Rationalisation & Production Hardening  
**Batch:** C (decision memo only — **no implementation**)  
**Date:** 2026-08-26  
**Author:** Engineering rationalisation review  
**Production baseline:** `tenderbriefing-00142-68x` · Phase 3 **PASS WITH CONDITIONS** (live R349 PayFast E2E outstanding)

This memo does **not** change Phase 3 certification status or commercial invariants (R349 / R200 / PayFast / Founder approval / no cross-org IDOR).

---

## Executive recommendation

| Capability | Recommendation | Rationale (one line) |
|------------|----------------|----------------------|
| **Push notifications** | **RETIRE** *(runtime retirement PR pending Founder merge)* | Fake 501 API surface + no production FCM config; real ops covered by inbox, email, WhatsApp; native/PWA not wired end-to-end. |
| **SMS notifications** | **DEFER** | No production template uses SMS; legacy client stub is misleading; existing channels sufficient unless a named ops gap is identified. |
| **Long-audio chunking** | **DESIGN NEXT** | Core BI service risk: 100MB upload vs ~25MB Whisper limit; chunking/ffmpeg not implemented; failures block transcript → report delivery. |

**Verdict:** **FOUNDER APPROVED — READY FOR SIGN-OFF (docs PR)**

---

## Founder approved decisions (2026-08-26)

These decisions are **approved by the Founder** for the rationalisation programme. This document records them only. **No runtime changes** are included in the Batch C docs PR.

| Capability | Founder decision | Implementation in this PR |
|------------|------------------|---------------------------|
| **Push notifications** | **RETIRE** | Document only — routes **not deleted** here; dedicated runtime PR later |
| **SMS notifications** | **DEFER** | Document only — no SMS implementation; misleading stub removal deferred to later hygiene PR |
| **Long-audio chunking** | **DESIGN NEXT** | Separate design branch (`design/briefing-audio-chunking`) — no ffmpeg/code |

**Explicit exclusions (Founder directive):**

- No FCM implementation
- No Twilio SMS implementation
- No ffmpeg / audio chunking code in this batch
- No production feature-flag changes
- No R349 / R200 / PayFast / finance behaviour changes
- No modification of Phase 3 certification evidence

### Push — RETIRE (approved)

**Rationale (Founder record):**

- Production routes currently return **501**
- Token registration is **not wired end-to-end** (PWA/native do not persist tokens via `/api/push/register-token`)
- **FCM secret is not mounted** in Cloud Run production
- Certified TenderBriefing operations do **not** depend on push (email, in-app inbox, Resend lifecycle)
- Fake capability creates more maintenance and support risk than having no feature

**Next step (separate PR):** Retire 501 routes, client hooks, and non-functional push surface after Founder approves runtime retirement PR.

### SMS — DEFER (approved)

**Rationale (Founder record):**

- No proven operational gap
- Existing channels: email, in-app inbox, WhatsApp capability (fail-closed in prod)
- SMS adds provider cost, POPIA/consent, retry handling, duplicate-notification risk

**Next step:** Later hygiene PR may remove misleading dead SMS branches after separate review.

### Long-audio chunking — DESIGN NEXT (approved)

**Business priority:** **HIGH**

**Rationale (Founder record):**

Audio transcription sits directly on: **YA evidence → transcript → Briefing Intelligence → Founder approval → SME delivery**.

**Current risk:**

- Evidence upload allows files up to **~100 MB**
- Whisper single-request limits are **substantially smaller (~25 MB)**
- Current pipeline sends the **whole file in one transcription call**
- Long briefings can fail **after valid evidence has already been submitted**

**Next step:** Technical design in `docs/architecture/BRIEFING_AUDIO_CHUNKING_DESIGN.md` — implementation only after design Founder review.

---

## Executive recommendation (engineering analysis — superseded by Founder table above)

Optimised for: protecting the R349 commercial workflow, reliable YA attendance/evidence, successful briefing report delivery, lower Founder ops burden, reduced fake capability, minimal provider cost — **not** feature count.

---

# 1. Push notifications

## Current state

### Relevant files / routes / services

| Layer | Path | Status |
|-------|------|--------|
| API (501) | `app/api/push-notifications/send/route.ts` | Returns **501** — admin-only stub |
| API (501) | `app/api/push-notifications/subscribe/route.ts` | Returns **501** — authenticated stub |
| API (working) | `app/api/push/register-token/route.ts` | Stores token on `users/{uid}.deviceTokens` |
| Backend send | `backend/services/integrations/fcmService.js` | Sends **if** `FCM_SERVER_KEY` or Firebase Admin messaging configured **and** tokens exist |
| Backend wrapper | `backend/services/pushNotificationService.js` | registerToken / sendPush |
| Workflow hook | `backend/services/workflowAutomationService.js` | Optional `push` channel → `sendPush` (skipped when FCM not configured) |
| Backend notify | `backend/services/notificationService.js` | `dispatch('push')` → audit log only (“not yet configured”) |
| Client hook | `hooks/usePushNotifications.ts` | Used by mobile PWA bootstrap + dev test page |
| Client service | `lib/services/pushNotificationService.ts` | Firebase web messaging; calls **501** subscribe/send routes |
| Mobile PWA | `app/agent/mobile/MobileFieldBootstrap.tsx` | Requests browser permission; **does not** POST to `/api/push/register-token` |
| Native app | `mobile-agent-app/src/services/push.ts` | Expo push token locally; **does not** POST to `/api/push/register-token` (README lists wiring as future step) |
| Dev only | `app/features-test/page.tsx` | Push test UI (404 in production) |
| Health | `app/api/admin/automation-health/route.ts` | Reports FCM integration status |

### Reachability

- **Production users cannot receive push** today: `FCM_SERVER_KEY` is **not** mounted in `cloudbuild.yaml`; FCM health is “not configured”.
- PWA/mobile clients may obtain local tokens but **end-to-end delivery is broken**: subscribe → 501; token not persisted via register-token from hooks/native app.
- Workflow automation may *attempt* push but result is `skipped: FCM not configured` or `No device tokens`.

### Feature flags

No dedicated push feature flag. Behaviour is **fail-closed** via missing env (documented in `docs/operations/ENVIRONMENT_VARIABLES.md` as “Push degraded”).

### Production usage evidence

- `docs/reports/TENDERBRIEFING_AUDIT_REMEDIATION_CERTIFICATION.md` §9: **“Push / SMS stubs | Explicit not implemented”** (intentional posture).
- Phase 3 notification hardening uses **Resend email + in-app/inbox + idempotent lifecycle keys** — not push.
- No certification report claims live FCM delivery.

### Tests

- No unit/integration tests asserting push delivery.
- Route retirement / audit tests do not depend on push routes.

### External dependencies

- Firebase Cloud Messaging (legacy server key or Admin SDK messaging)
- `NEXT_PUBLIC_FIREBASE_VAPID_KEY` (client web push — optional, often unset)
- Expo push (native — separate from FCM server wiring)

## Business value

| Stakeholder | Value today | Notes |
|-------------|-------------|-------|
| SME | **Low** | Email + in-app notifications cover booking/report delivery |
| Youth Agent | **Low–Medium (potential)** | Timely dispatch/assignment alerts *could* help field response — **but not working** |
| Founder/Ops | **Low** | Ops uses Founder dashboard, email, command centre — not push |

**Revenue / retention relevance:** **None proven.** Push does not gate R349 payment, assignment, evidence, or SME report delivery.

## Operational necessity

**Classification: optional (currently speculative)**

Push would be *useful* for YA dispatch latency if fully wired and reliable. It is **not core** to the certified commercial workflow. Carrying 501 routes and client hooks creates **false confidence**.

## Cost

| Dimension | Estimate |
|-----------|----------|
| Engineering effort to productionise | **High** — FCM v1, token lifecycle, Expo→FCM bridge, auth boundaries, invalid token cleanup, E2E tests |
| Infrastructure / provider | **Low** (FCM free tier) |
| Maintenance | **Medium** — token rot, platform differences (iOS/Android/PWA), permission regressions |
| Support | **Medium** — “I enabled notifications but get nothing” (current state) |

## Risk

| Risk | Assessment |
|------|------------|
| Security | Cross-user notification if token lookup wrong — **high impact if built carelessly** |
| Privacy | Device tokens on user docs — manageable with RLS/server-only send |
| Reliability | Duplicate notifications if push added parallel to email/WhatsApp without idempotency |
| Vendor lock-in | Firebase/Expo ecosystem — moderate |
| Production complexity | **High** for marginal gain vs existing channels |

## Recommendation: **RETIRE**

**Why RETIRE over DEFER:**

1. **Fake capability is worse than no capability** — 501 routes and client subscribe flows imply a product feature that does not work.
2. **No production dependency** — certified workflow does not require push; audit explicitly accepted stubs.
3. **Incomplete wiring** — native app README still says “wire FCM”; PWA never calls register-token; this is scaffolding debt, not a paused feature.
4. **If revived later**, re-introduce behind a feature flag with a single canonical send path, token registration in YA mobile surfaces, and tests — not by restoring 501 stubs.

**Retire scope (for a future implementation batch, after Founder approval):**

- Remove or return **410/404** on non-functional push API routes (keep audit trail in ADR).
- Remove client hooks from production mobile bootstrap (or gate behind explicit flag).
- Retain **optional** `register-token` + `fcmService` only if Founder chooses “implement later” instead — otherwise retire together.
- Do **not** delete `deviceTokens` user field data (may contain historical tokens).

**Alternative if Founder wants native YA alerts soon:** change recommendation to **DEFER** with mandatory product spec — only if field rollout of native app push is confirmed on roadmap.

---

# 2. SMS notifications

## Current state

### Relevant files / routes / services

| Layer | Path | Status |
|-------|------|--------|
| Legacy client service | `lib/services/notificationService.ts` | `case 'sms':` → `console.log('SMS notification not implemented yet')` |
| API consumer | `app/api/notifications/route.ts` | Imports legacy client service (mark read / admin send paths) |
| Production backend | `backend/services/notificationService.js` | Channels: `email`, `whatsapp`, `push` — **no SMS channel** |
| Phase 3 lifecycle | `backend/services/briefingLifecycleNotificationService.js` + `transactionalEmailService` | Email (Resend) — production path |
| WhatsApp | `backend/services/whatsappService.js` | Twilio/Meta — **fail-closed** in prod (secrets not mounted) |
| Calendar comment | `lib/calendar/googleCalendar.ts` | Comment “Send SMS via Twilio” — not implemented |

### Reachability

- **No notification template includes `sms` in channels** — all legacy templates use `['in_app', 'email']` only.
- SMS branch in `lib/services/notificationService.ts` is **dead code** for current templates.
- Production attendance/BI notifications use **backend** services, not the legacy client notification service.

### Feature flags

None for SMS.

### Production usage evidence

- Audit remediation: SMS explicitly “not implemented”.
- No Twilio SMS env vars in Cloud Run matrix (WhatsApp Twilio vars documented as not mounted).

### Tests

- No SMS-specific tests.

### External dependencies

- Would require Twilio SMS (distinct from WhatsApp on Twilio) or alternate SMS provider, Secret Manager, opt-out/consent (POPIA-relevant), delivery logs.

## Business value

| Stakeholder | Value | Notes |
|-------------|-------|-------|
| SME | **Low** | Email + in-app for report delivery |
| Youth Agent | **Low–Medium (potential)** | SMS could reach agents without data — **WhatsApp already planned for ops** |
| Founder/Ops | **Low** | Ops alerts via Founder email in Phase 3H |

**Revenue / retention:** **None proven.** SMS does not unblock R349 or report delivery.

## Operational necessity

**Classification: optional**

SMS only justified if WhatsApp + email + in-app cannot reach a defined cohort (e.g. agents without smartphones/data but with SMS — increasingly rare in SA urban YA cohort).

## Cost

| Dimension | Estimate |
|-----------|----------|
| Engineering effort | **Medium** — provider integration, consent, templates, idempotency, admin visibility |
| Provider cost | **Medium–High** at scale (per-SMS; unlike email) |
| Maintenance | **Medium** |
| Support | **Medium** — delivery failures, wrong numbers, opt-out |

## Risk

| Risk | Assessment |
|------|------------|
| Security | Low if no payment/bank content in SMS |
| Privacy / POPIA | **Medium** — phone numbers, consent, opt-out records |
| Duplicate notifications | **High** if SMS added parallel to WhatsApp/email without shared idempotency keys |
| Reliability | Provider delivery variance |
| Cost runaway | **High** without rate limits and template discipline |

## Recommendation: **DEFER**

**Why not RETIRE yet:** Removing the SMS type from shared interfaces is a small code change but touches legacy client notification types; defer allows explicit “disabled” documentation first.

**Why not IMPLEMENT NOW:** No identified ops gap that email/WhatsApp/in-app cannot cover; Twilio SMS adds cost and POPIA overhead; WhatsApp is already the intended mobile messaging channel for SA.

**Founder action if DEFER accepted:**

- Document SMS as **out of scope** in notification architecture.
- On a future hygiene PR (after approval): remove SMS from legacy client channel types and stub branch to prevent misleading “sentChannels” semantics.

---

# 3. Long-audio chunking

## Current state

### Relevant files / routes / services

| Layer | Path | Role |
|-------|------|------|
| Upload API | `app/api/briefing-intelligence/evidence/route.ts` | `MAX_AUDIO_BYTES = 100 * 1024 * 1024` (100MB) |
| YA UI | `app/agent/workspace/assignments/[requestId]/submit-evidence/page.tsx` | Client-side 100MB check |
| Transcription | `lib/briefing-intelligence/transcriptionService.ts` | Downloads **entire file** to memory → single Whisper `audio/transcriptions` request |
| Pipeline | `lib/briefing-intelligence/processReport.ts` | Transcribe → store transcript → optional AI extract |
| Worker | `app/api/briefing-intelligence/transcription/worker/route.ts` | `maxDuration = 300` (5 min wall clock) |
| Flags | `lib/briefing-intelligence/featureFlag.ts` | `BRIEFING_AUDIO_TRANSCRIPTION_ENABLED` (fail-closed default off) |
| Certification | `docs/reports/BRIEFING_AUDIO_TRANSCRIPTION_CERTIFICATION.md` | Known limitation: **“chunking/ffmpeg not implemented”** |

### Reachability

- **Core path when flags enabled:** YA evidence upload → async transcription worker → transcript → BI report → Founder approval → SME delivery.
- Directly on the **R349 commercial workflow** after payment and evidence submission.

### Limits mismatch (critical)

| Limit | Value | Source |
|-------|-------|--------|
| App upload max | **100 MB** | evidence route + UI |
| OpenAI Whisper API file max | **~25 MB** | Provider constraint (documented in certification) |
| Worker wall clock | **300 s** | Next.js route `maxDuration` |
| Memory | Full `arrayBuffer` load | `transcriptionService.ts` |

**Gap:** Users can upload audio the provider **cannot transcribe in one request**. Failure sets report transcription to failed; evidence remains, but **BI delivery blocked** until manual recovery.

### Real-world briefing duration

Compulsory tender briefings commonly run **45–120+ minutes**. Compressed voice (64 kbps mono) ≈ 0.5 MB/min → 60 min ≈ 30 MB (may exceed Whisper limit). Higher-quality phone recordings (128 kbps+) exceed 25 MB sooner.

### Production usage evidence

- Feature fail-closed in production by default.
- Phase 3 architecture **depends** on BI v2 path when flags enabled for private tender briefing operations.
- Certification explicitly deferred chunking.

### Tests

- `tests/briefing-intelligence/integration/evidenceUpload.test.ts` — 100MB boundary (413 over limit).
- `tests/briefing-intelligence/unit/transcriptionService.test.ts` — provider behaviour (mocked).
- **No tests** for multi-chunk merge or >25MB files.

### External dependencies

- OpenAI Whisper (`whisper-1` default)
- GCS/Firebase Storage for audio
- **Not present:** ffmpeg in Docker image (`Dockerfile` is Node Alpine only)

## Business value

| Stakeholder | Value |
|-------------|-------|
| SME | **High** — paid for briefing intelligence; failed transcription = no report |
| Youth Agent | **High** — evidence accepted but pipeline fails silently downstream |
| Founder/Ops | **High** — manual retry/load; support burden; certification gap |

**Revenue / retention relevance:** **Direct** — core differentiator of R349 service.

## Operational necessity

**Classification: core** (when `BRIEFING_AUDIO_TRANSCRIPTION_ENABLED` is on for production briefing ops)

Without chunking or a lower upload cap aligned to Whisper, the system **accepts inputs it cannot reliably process**.

## Cost

| Dimension | Estimate |
|-----------|----------|
| Engineering effort | **High** — ffmpeg in Cloud Run, chunk pipeline, merge, idempotency, tests |
| Infrastructure | **Medium** — temp disk, longer worker runs, possible memory bump |
| Maintenance | **Medium** — ffmpeg versions, edge cases (silence, overlap) |
| Support | **High** if unaddressed — “upload succeeded but no report” |

## Risk

| Risk | Assessment |
|------|------------|
| Security | Temp files must not leak across tenants; signed URLs only |
| Reliability | Partial chunk failure → incomplete transcript without recovery |
| Duplicate BI generation | **High** if retries re-run extract on same report without idempotency |
| Memory / timeout | **High** on Cloud Run without chunking |
| Data integrity | Must preserve authoritative tender metadata over model output |

## Recommendation: **DESIGN NEXT**

Do **not** implement in Batch C. Produce design + sizing, then implement in a dedicated batch **before** broad production enablement of `BRIEFING_AUDIO_TRANSCRIPTION_ENABLED`.

---

## Proposed chunking architecture (design only — not approved for build)

### Goals

1. Support briefings up to a defined **maximum duration** (recommend Founder cap: **120 minutes** initially).
2. Never send >25 MB per Whisper request.
3. Deterministic, idempotent pipeline — no duplicate BI generation.
4. Preserve evidence + partial transcripts on failure.

### Proposed components

```
Evidence audio (GCS)
  → chunk planner (ffprobe/ffmpeg metadata: duration, codec)
  → N chunks (e.g. 10–15 min each, target <20 MB; optional 2s overlap)
  → sequential or bounded-parallel Whisper calls (same job id)
  → ordered merge (segment timestamps offset by chunk start)
  → single transcript record → existing extractIntelligence path
```

### Design decisions for Founder review

| Topic | Proposal |
|-------|----------|
| **ffmpeg availability** | Add `ffmpeg` to Cloud Run builder/runner (Alpine `apk add ffmpeg`); verify licence + image size |
| **Max duration** | Hard cap **120 min** at upload (configurable env); reject with clear YA message above cap |
| **Upload cap alignment** | Lower client/API max to match cap (e.g. 50 MB) **or** allow large uploads but always chunk before Whisper |
| **Chunk boundaries** | Fixed wall-clock windows (e.g. 600s) with optional 2s overlap for word boundary safety |
| **Merge** | Concatenate segments; re-index `startSeconds`/`endSeconds`; store chunk manifest in GCS |
| **Idempotency** | Job fields: `chunkIndex`, `chunkStatus[]`; retry per chunk; merge only when all chunks complete |
| **Temp files** | Write to `/tmp` per chunk; delete in `finally`; no cross-request sharing |
| **Worker budget** | May require chained worker invocations (continuation token) if total >300s — reuse automation continuation pattern |
| **Observability** | Pipeline trace fields: chunk count, bytes, per-chunk latency, merge status |
| **Failure** | Partial transcript flagged; Founder notified; SME **not** delivered until Founder resolves |
| **BI duplicate guard** | Reuse existing report job ids; merge stage triggers extract **once** |

### Interim mitigations (until chunking built)

1. **Align upload limit to 25 MB** with clear YA copy (“record in two parts if needed”) — cheap stopgap, poor UX.
2. Keep `BRIEFING_AUDIO_TRANSCRIPTION_ENABLED` **off** in production until chunking certified.
3. Admin manual re-upload/split procedure documented in runbook.

---

# Founder decision table

| Capability | Founder decision | Business Priority | Engineering Effort | Operational Risk | Status |
|------------|------------------|-------------------|--------------------|------------------|--------|
| Push notifications | **RETIRE** | Low | High (if rebuilt) | Medium (fake capability today) | **Approved** — runtime PR pending |
| SMS notifications | **DEFER** | Low | Medium | Medium (cost/POPIA/duplication) | **Approved** |
| Long-audio chunking | **DESIGN NEXT** | **High** (core BI) | **High** | **High** if ignored | **Approved** — design PR pending |

---

# Recommended implementation order (after Founder decisions)

1. **Long-audio chunking** — design review → implementation batch → certification (blocks safe BI flag rollout)
2. **Push notifications** — retire fake surface **or** (only if Founder mandates) full FCM spec for native YA only
3. **SMS** — remain deferred unless named ops gap; remove misleading legacy stub when convenient

**Explicitly not approved in Batch C:**

- FCM / push implementation
- Twilio SMS implementation
- ffmpeg/chunking implementation
- Any change to R349 / R200 / PayFast / payout / pricing logic

---

# Items explicitly not approved for implementation

- Push notification delivery (FCM/Expo server integration)
- SMS provider integration
- Audio chunking/ffmpeg code changes
- Feature flag enablement changes in production
- Deletion of user `deviceTokens` or notification history
- Modification of Phase 3 certification reports

---

# Change control

| Field | Value |
|-------|-------|
| **Verdict** | **FOUNDER APPROVED — READY FOR SIGN-OFF (docs PR)** |
| **Branch** | N/A (documentation only) |
| **Base SHA** | `690cbb5fac813a8b3ddefad8fe110deadb4a6146` (master at memo authoring) |
| **Files added** | `docs/decisions/BATCH_C_INCOMPLETE_CAPABILITIES_DECISION.md` |
| **Behaviour changes** | None |
| **Financial invariant impact** | None |
| **Deployment impact** | None |
| **Merge / deploy** | **Do not merge or deploy without Founder approval of this memo’s decisions** |

---

*This memo is product/engineering analysis, not legal advice (POPIA/consent noted for SMS/GPS context only).*
