# Founder Review — Email Deliverability Protection System

**Branch:** `feat/outreach-deliverability-protection`  
**Date:** 2026-10-09  
**Status:** DRAFT PR ONLY — **DO NOT MERGE · DO NOT DEPLOY · DO NOT SEND EMAILS**  
**Sender (unchanged):** `TenderBriefing <hello@tenderbriefing.co.za>`  
**Provider:** Resend (unchanged)  
**Bulk outreach:** BLOCKED (fail-closed)

---

## 1. Existing architecture

| Layer | Behaviour |
| --- | --- |
| Composer V2 | Founder-authored HTML → sanitize → render multipart (HTML + text) → Resend |
| Campaign store | `founderOutreachCampaigns` + `deliveries` subcollection |
| Send engine | Per-recipient sends with `Idempotency-Key: outreach-delivery:${id}`; status `sent` = API acceptance |
| Suppressions | `emailSuppressions` (unsubscribe / hard bounce / complaint / manual) |
| Resend webhooks | Signature-verified; ops correlation + **new** Outreach reconcile path |
| Founder UI | `/founder/outreach` compose; **new** `/founder/outreach/deliverability` |

Prior gap: Resend `email.delivered` / bounce / complaint events did not advance Outreach delivery documents beyond `SUBMITTED`.

---

## 2. Identified deliverability risks

1. **SUBMITTED ≠ inbox** — Founders may interpret Resend acceptance as mailbox placement.
2. **Webhook gap** — Deliveries stayed `SUBMITTED` after Resend reported delivered/bounced (fixed in this PR, pending deploy).
3. **DMARC `aspf=s`** — Strict SPF alignment can fail for Resend MAIL FROM `send.tenderbriefing.co.za` while DKIM may still pass DMARC.
4. **Apex SPF is Outlook-only** — Correct for Microsoft 365; must not add Resend includes without approval.
5. **Gmail placement** — Controlled tests showed provider-delivered mail that was not visibly in Primary for some recipients.
6. **Bulk volume** — Uncontrolled volume would damage reputation; bulk remains blocked.
7. **Content risk** — Misleading subjects / dangerous URL schemes can trigger filters.

---

## 3. Authentication findings (read-only audit)

| Check | Status | Notes |
| --- | --- | --- |
| Resend domain `tenderbriefing.co.za` | Pass when verified | eu-west-1; live status fetched when API key present |
| DKIM `resend._domainkey` | Pass | Expected alignment on apex domain |
| Return-Path `send.` SPF | Pass | `include:amazonses.com` (Resend MAIL FROM) |
| Apex SPF | Pass (preserve) | Outlook-only `-all` — **do not overwrite** |
| DMARC | Warn | `p=none; aspf=s; adkim=s` — monitoring only |
| From identity | Pass | Locked to `hello@tenderbriefing.co.za` |
| Microsoft 365 | Preserved | Apex SPF/MX unchanged by this work |

**No DNS was changed.** Recommendations require Founder approval (see §8).

---

## 4. Proposed improvements (this PR)

| Phase | Implementation |
| --- | --- |
| 1 Auth | `lib/founder/outreach/deliverability/authAudit.ts` — static + optional Resend status |
| 2 Content | `contentWarnings.ts` — warn/block before send; **no auto-rewrite** of Founder copy |
| 3 Recipients | Existing suppression + syntax/duplicates; bounce/complaint → suppression via webhook |
| 4 Reputation | Cap (default 5), bulk fail-closed, auto-pause on bounce/complaint spikes |
| 5 Webhooks | `webhookReconcile.ts` + provider index; lifecycle on deliveries; idempotent / ordered |
| 6 Dashboard | `/founder/outreach/deliverability` + GET/POST API |
| 7 Inbox tests | Manual placement recording only (no auto-send, no mailbox access) |
| 8 Tests | Unit coverage for gates, labels, reconcile, wiring |
| 9 Review | This report + draft PR |

UI labels: `SUBMITTED` → `PROVIDER_DELIVERED` / `BOUNCED` / `COMPLAINED` — never “inbox delivered” from Resend alone.

---

## 5. Implemented changes (file map)

- `lib/founder/outreach/deliverability/*` — auth, content, reputation, reconcile, metrics, placement
- `lib/founder/outreach/statusLabels.ts` — provider lifecycle-aware labels
- `lib/founder/outreach/sendEngine.ts` — index provider message id; `providerLifecycle: accepted`
- `app/api/webhooks/resend/route.ts` — Outreach reconcile after verify
- `app/api/founder/outreach/compose/route.ts` — content + reputation gates
- `app/api/founder/outreach/deliverability/route.ts` — metrics + placement POST
- `app/founder/outreach/deliverability/page.tsx` — Founder dashboard
- `firestore.rules` — Admin-only collections for index / runtime / placements
- `components/founder/FounderShell.tsx` — Deliverability nav
- `tests/unit/founderOutreachDeliverability.test.ts`

---

## 6. Test results

Executed locally (2026-10-09), **no live sends**:

```text
✓ tests/unit/founderOutreachDeliverability.test.ts (9)
✓ tests/unit/founderOutreachComposerAmendments.test.ts (10)
✓ tests/unit/founderOutreachComposer.test.ts (16)
→ 35 passed
```

Also green in prior suite runs: preview suppression, Resend idempotency.

Automated tests must not call Resend with real sends. Integration “controlled live” suites remain Founder-gated and out of CI email paths.

---

## 7. Remaining risks

- Historical deliveries created before this PR lack provider index → webhooks remain noop until new sends.
- Firestore collectionGroup index for auto-pause may be missing; pause logic fails soft until index exists.
- Google Postmaster Tools not wired (needs Founder OAuth / domain verification approval).
- Provider “delivered” still ≠ Primary; only Founder-recorded placements count as verified.
- DNS DMARC/SPF recommendations not applied.

---

## 8. DNS changes requiring Founder approval

1. **Medium:** Consider DMARC `aspf=r` (relaxed) so Resend Return-Path can SPF-align under DMARC — without changing apex Outlook SPF.
2. **Low:** Later raise `p=none` → `p=quarantine` only after clean metrics and monitoring.
3. **Never without explicit plan:** Adding Resend to apex SPF (would risk Microsoft 365).

---

## 9. Deployment readiness

| Item | Ready? |
| --- | --- |
| Code complete on feature branch | Yes (pending CI) |
| Draft PR | Yes |
| Merge | **NO** — Founder approval required |
| Deploy | **NO** |
| Send email | **NO** |
| Bulk | **BLOCKED** |
| Firestore rules deploy | With app deploy only after approval |
| DNS | No automatic changes |

---

## 10. Recommended controlled testing plan (after Founder OK to deploy)

1. Deploy to production **only after** merge approval.
2. Founder opens `/founder/outreach/deliverability` — confirm auth audit + zero invented inbox %.
3. Send **1** approved Gmail test from compose (hello@) — confirm SUBMITTED → PROVIDER_DELIVERED via webhook.
4. Founder manually checks Gmail → records Primary / Promotions / Spam on dashboard.
5. Repeat for 1 Outlook + 1 Yahoo approved addresses.
6. Replay webhook event (duplicate) — confirm idempotent noop.
7. Confirm bounce path suppresses recipient and blocks re-send.
8. Stop. No bulk. Expand volume only with Founder-written approval.

---

## Stop

**Awaiting Founder approval. Do not merge, deploy, or send.**
