# Private Tender Phase 3 — Production Certification Report

**Date/time:** 2026-08-26 (Africa/Johannesburg)  
**PR (implementation):** [#64](https://github.com/tenderbriefing/tender/pull/64)  
**Hotfix (follow-up review path + flag persistence):** [#65](https://github.com/tenderbriefing/tender/pull/65)

---

## 1. Executive verdict

**PASS WITH CONDITIONS — awaiting authorised live payment-bound production E2E certification**

Phase 3 is deployed, flags enabled in controlled waves, baseline + Waves 1–3 production smokes PASS, financial invariants PASS, security posture for exercised endpoints PASS. Full **PRODUCTION CERTIFIED** is blocked until:

1. Hotfix PR #65 is deployed and Wave 4 (follow-up approve → SME history) re-smoke PASS  
2. One authorised live R349 PayFast E2E completes (ITN → paid → single R200 liability)

Do **not** treat stop-before-pay as completed payment certification.

---

## 2. Release identity

| Item | Value |
| --- | --- |
| PR #64 | MERGED `2026-08-26T12:03:39Z` |
| PR #64 head | `b0ffdeb4b393db94d5a5db1a45ba2e59d59a5863` |
| Merge SHA | `d36a74ba4f97a50acf4387896a2a94ab1af181c6` |
| Master at Phase 3 deploy | `d36a74ba4f97a50acf4387896a2a94ab1af181c6` |
| Deploy run | [32966567818](https://github.com/tenderbriefing/tender/actions/runs/32966567818) **success** (watcher API timeout ≠ deploy failure) |
| App image (00138) | `…/tenderbriefing@sha256:296282349044687ac6bf1562a68e770fa057427ad32fc53ed051999287fddad3` |
| Phase 3 fail-closed revision | `tenderbriefing-00138-cr4` @ 100% |
| Wave 1 flags | `tenderbriefing-00139-v9q` |
| Wave 3 BI v2 | `tenderbriefing-00140-b5m` |
| Wave 4 follow-ups (+ all flags) | **`tenderbriefing-00141-fmm` @ 100%** (certifying runtime at wave completion) |
| Rollback known-good (Phase 2) | `tenderbriefing-00137-fbl` |
| OPENAI binding | `OPENAI_API_KEY` ← `Open_ai_Secret_Key:latest` (confirmed on revision) |

---

## 3. Phase 3A–3H status

| Area | Status | Evidence |
| --- | --- | --- |
| 3A Booking snapshot | **PASS** | Wave1: `source=private_tender`, `34900`, `pricingVersion=2026-08-v349`, org + tender linkage; stop-before-pay |
| 3B Founder ops/pipeline | **PASS** | Founder dashboard 200; enriched briefing rows + pipeline KPIs in code |
| 3C YA recommendations | **PASS** | Wave2: Founder 200 + explainable text; YA 403 |
| 3D Evidence integrity | **PASS (code)** | Metadata on BI evidence route; invasive upload skipped in prod smoke |
| 3E BI v2 | **PASS (flag + local negatives)** | Flag ON; normalize helpers reject fabrication on null; live OpenAI not re-run against prod in this session |
| 3F Follow-ups | **CONDITIONAL** | Create OK (`bfu-…`); **approve 500** `MODULE_NOT_FOUND` — fixed in PR #65 (not yet redeployed at report draft) |
| 3G SME briefing history | **PASS** | SME history 200; lists booking; followUps await approve fix |
| 3H Notifications | **PASS (code)** | `briefingLifecycleNotificationService` + unit coverage; event-driven / idempotent |

---

## 4. Feature flags (production @ `00141-fmm`)

| Flag | Production value | Expected default (post-merge) | Result |
| --- | --- | --- | --- |
| `PRIVATE_TENDER_BRIEFING_BOOKING_ENABLED` | `true` | off → enabled Wave 1 | Enabled after baseline PASS |
| `NEXT_PUBLIC_PRIVATE_TENDER_BRIEFING_BOOKING_ENABLED` | `true` (runtime) | off | Set; client bundle bake via next deploy w/ cloudbuild |
| `BRIEFING_INTELLIGENCE_V2_ENABLED` | `true` | off → Wave 3 | Enabled |
| `BRIEFING_FOLLOW_UP_UPDATES_ENABLED` | `true` | off → Wave 4 | Enabled |
| `NEXT_PUBLIC_BRIEFING_FOLLOW_UP_UPDATES_ENABLED` | `true` | off | Enabled |
| Phase 2 workspace flags | `true` / `true` | unchanged | Preserved |

Initial post-merge (`00138`): Phase 3 flags **absent** = fail-closed **OFF**. Proven before enablement.

---

## 5. Security / IDOR

| Probe | Result |
| --- | --- |
| Anonymous Phase 3 / Founder APIs | 401 |
| YA → Founder dashboard | 403 |
| YA → recommendations | 403 |
| Cross-org get tender | 404 / denied (Wave1/2) |
| Outsider procurement | 403 |
| Founder allow-list | Enforced (middleware + verifyFounder) |

**Any unresolved cross-org IDOR:** none observed in executed smokes.

---

## 6. Financial invariants

| Invariant | Result |
| --- | --- |
| SME 34900 / YA 20000 / gross 14900 | PASS (constants + Wave1 booking snapshot) |
| `pricingVersion=2026-08-v349` | PASS |
| Client cannot set charge (server snapshot) | PASS (booking stamp) |
| Stop-before-pay; no YA liability yet | PASS |
| Live ITN / duplicate liability / monthly batch re-settle | **Not exercised** (no live payment) |
| PayFast live / OPENAI secret mounts | Confirmed on revision |
| Banking / manual EFT architecture | Unchanged |

---

## 7. Payment smoke

| Item | Value |
| --- | --- |
| Mode | **STOP BEFORE PAY** (`ALLOW_LIVE_R349_PAYMENT` false) |
| Example requestId | `req-1787758262239-x0ocok` (Wave1; cancelled in cleanup) |
| Example published tender | `priv-pts-1787758228062-ade8fd8d` |
| Checkout amount | `349.00` |
| Live R349 E2E | **NOT COMPLETED** |

---

## 8. BI v2

- Flag enabled on `00140` → `00141`  
- Local normalize: empty/null does not fabricate; authoritative cover still designed in pipeline  
- Live OpenAI negative matrix against production: **not run** this session (avoid prod cost/side effects); unit suite covers schema  
- Founder approval remains gated in existing BI deliver path  

---

## 9. Notifications

Phase 3H closed in code (`briefingLifecycleNotificationService`): evidence, draft, AI fail, approve, clarification, assignment change, evidence correction — idempotent Safe wrappers. Unit: `tests/unit/privateTenderPhase3HNotify.test.ts` PASS.

---

## 10. Regression

| Area | Result |
| --- | --- |
| Public `/`, `/tenders`, `/submit-tender`, `/procurement` | 200 |
| Firestore health | `{status:ok,connected:true}` |
| Phase 2 org workspace flags | still true |
| Baseline Phase 3 flags OFF smoke | PASS |
| R349 constants | PASS |

---

## 11. CI / gates (this certification)

| Gate | Result |
| --- | --- |
| PR #64 CI | PASS (prior) |
| Deploy 32966567818 | PASS |
| `vitest` Phase2/3/3H/pricing | 38 PASS |
| typecheck / lint / build (hotfix) | PASS |
| Prod smoke baseline | PASS |
| Prod smoke wave1 | **27/27 PASS** |
| Prod smoke wave2 | PASS |
| Prod smoke wave3 | PASS |
| Prod smoke wave4 | **32/35** — fail: review MODULE_NOT_FOUND (+ smoke false positive on local flag-off) |
| PR #65 GitHub check-runs | **Did not attach** (empty Actions listing for branch) — local gates used |

Script: `scripts/pr64-phase3-production-cert-smoke.js`

---

## 12. Deployment / Firestore

- Rules/indexes: shipped with Phase 3 merge deploy; `briefingFollowUpUpdates` deny-all client  
- Hotfix #65 must redeploy app + keep flags (cloudbuild persistence)

---

## 13. Rollback

1. Disable Phase 3 flags via `gcloud run services update --update-env-vars=…=false`  
2. Preserve Phase 1/2, payments, follow-up/audit docs (do not delete collections)  
3. If needed: route 100% to `tenderbriefing-00137-fbl` (Phase 2 certified) or `00138-cr4` (Phase 3 code, flags off)

---

## 14. Residual risks

**Blocking for full PRODUCTION CERTIFIED**

- Live R349 + ITN + single R200 liability not proven  
- Wave 4 approve path requires #65 deploy + re-smoke  

**Non-blocking**

- NEXT_PUBLIC client CTA bake depends on next image build (runtime flag set)  
- GitHub CI check-runs failed to attach to #65  
- Deep BI v2 adversarial transcript matrix not re-executed live in prod  

---

## Recommended Founder action

1. Confirm merge + deploy of **PR #65**  
2. Re-run `PHASE3_CERT_MODE=wave4 node scripts/pr64-phase3-production-cert-smoke.js`  
3. Authorise **one** live R349 production payment E2E when ready  
4. Only then promote verdict to **PRODUCTION CERTIFIED — PRIVATE TENDER BRIEFING OPERATIONS PHASE 3**
