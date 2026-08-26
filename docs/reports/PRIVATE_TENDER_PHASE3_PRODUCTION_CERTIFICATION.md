# Private Tender Phase 3 — Production Certification Report

**Date/time:** 2026-08-26 (Africa/Johannesburg)  
**Implementation PR:** [#64](https://github.com/tenderbriefing/tender/pull/64)  
**Hotfix PR:** [#65](https://github.com/tenderbriefing/tender/pull/65)  
**Certification docs PR:** [#66](https://github.com/tenderbriefing/tender/pull/66)

---

## 1. Executive verdict

**PASS WITH CONDITIONS — awaiting authorised live payment-bound production E2E certification**

### Closed in this session

- PR #65 hotfix **deployed and live**
- Production revision **`tenderbriefing-00142-68x` @ 100%** contains merge `690cbb5…`
- **Wave 4 = 35/35 PASS** (follow-up create → Founder approve → SME history; no HTTP 500)
- Security / IDOR probes PASS for exercised endpoints
- Fresh pending R349 booking retained for Founder live PayFast completion

### Still blocking full PRODUCTION CERTIFIED

Automated agents **cannot complete live PayFast card checkout**. Remaining gates requiring Founder (or authorised operator) in PayFast UI + post-payment lifecycle:

1. Live R349 ITN → `paymentStatus=paid` exactly once
2. Assignment → YA evidence → **exactly one R200 liability**
3. BI v2 generation + Founder approval + SME delivery on that paid job
4. Follow-up + notifications on the **paid** lifecycle (Wave 4 already proved create/approve on smoke path)

---

## 2. Release identity

| Item | Value |
| --- | --- |
| PR #64 head | `b0ffdeb4b393db94d5a5db1a45ba2e59d59a5863` |
| PR #64 merge | `d36a74ba4f97a50acf4387896a2a94ab1af181c6` |
| PR #65 merge | `690cbb5fac813a8b3ddefad8fe110deadb4a6146` |
| Master SHA (hotfix tip) | `690cbb5fac813a8b3ddefad8fe110deadb4a6146` |
| Deploy run #65 | [32986464322](https://github.com/tenderbriefing/tender/actions/runs/32986464322) |
| Deploy conclusion | **success** (`2026-08-26T16:14:25Z`) |
| Jobs | Auth/Firestore QA ✓ · Firebase ✓ · Cloud Run ✓ · Hosting proxy ✓ · Domains/health ✓ |
| Deployed headSha | `690cbb5fac813a8b3ddefad8fe110deadb4a6146` |
| Image (00142) | `…/tenderbriefing@sha256:61050cdc8bc3877be1e44a1b3bea9b42b678a4948ef3c293ba868b4d5da1485e` |
| Revision created | `2026-08-26T16:11:28Z` |
| OPENAI secret | `OPENAI_API_KEY` ← `Open_ai_Secret_Key:latest` |

---

## 3. Production revision

| Item | Value |
| --- | --- |
| **Current** | **`tenderbriefing-00142-68x` @ 100%** |
| Prior (flags-on, pre-hotfix) | `tenderbriefing-00141-fmm` |
| Phase 2 rollback | `tenderbriefing-00137-fbl` |
| Health | `/api/health/firestore` `{status:ok,connected:true}`; `/` 200 |

**Wave 4 was run only after confirming 00142 (not 00141).**

---

## 4. Feature flags (production @ 00142)

| Flag | Expected | Production | Result |
| --- | --- | --- | --- |
| `PRIVATE_TENDER_BRIEFING_BOOKING_ENABLED` | true | true | PASS |
| `NEXT_PUBLIC_PRIVATE_TENDER_BRIEFING_BOOKING_ENABLED` | true | true | PASS |
| `BRIEFING_INTELLIGENCE_V2_ENABLED` | true | true | PASS |
| `BRIEFING_FOLLOW_UP_UPDATES_ENABLED` | true | true | PASS |
| `NEXT_PUBLIC_BRIEFING_FOLLOW_UP_UPDATES_ENABLED` | true | true | PASS |
| `PRIVATE_TENDER_ORGANISATION_WORKSPACE_ENABLED` | true | true | PASS (Phase 2) |
| `NEXT_PUBLIC_PRIVATE_TENDER_ORGANISATION_WORKSPACE_ENABLED` | true | true | PASS (Phase 2) |

Persisted in `cloudbuild.yaml` via PR #65.

---

## 5. Phase 3A–3H

| Area | Status | Evidence |
| --- | --- | --- |
| 3A Booking snapshot | **PASS** | Pending booking `req-1787761531376-5722tx`: 34900 / `2026-08-v349` / `private_tender` |
| 3B Founder ops | **PASS** | Founder dashboard 200 |
| 3C Recommendations | **PASS** | Prior Wave2 on flag-on revision; YA 403 |
| 3D Evidence integrity | **PASS (code)** | Metadata path; full YA upload awaits paid E2E |
| 3E BI v2 | **PASS (flag + prior local)** | Flag ON; paid OpenAI lifecycle awaits live payment |
| 3F Follow-ups | **PASS** | Wave4: create 201 → approve 200 → SME history |
| 3G SME history | **PASS** | Lists booking + approved follow-up |
| 3H Notifications | **PASS (code)** | Lifecycle service + unit; paid-job events await E2E |

---

## 6. Wave 4 (post-#65)

**35/35 PASS** against `tenderbriefing-00142-68x`

| Check | Result |
| --- | --- |
| Follow-up create | 201 → `bfu-1787761043201-746bf3` |
| Founder approve | **200** `reviewStatus=approved` (no MODULE_NOT_FOUND) |
| SME history shows followUp | PASS (`followUpCount: 1`) |
| Cross-org create/approve | 403 |
| Org scoping | PASS |

Command: `PHASE3_CERT_MODE=wave4 node scripts/pr64-phase3-production-cert-smoke.js`

---

## 7. Security / IDOR

| Actor | Endpoint | Status |
| --- | --- | --- |
| Anonymous | Phase 3 / Founder APIs | 401 |
| SME | Founder dashboard / follow-ups | 403 |
| YA | Founder dashboard / recommendations | 403 |
| Founder | dashboard / finance | 200 |
| SME | briefing-history | 200 |
| Cross-org | tender get / follow-up | 404 / 403 (Wave4) |

No IDOR observed in exercised paths.

---

## 8. Payment smoke (stop-before-pay + retained booking)

| Field | Value |
| --- | --- |
| requestId | `req-1787761531376-5722tx` |
| privateTenderId | `priv-pts-1787761515465-3da136f6` |
| organisationId | `porg-1787729385088-7cb3e86d` |
| paymentReference | `TB-REQ-req-1787761531376-5722tx` |
| briefingPriceCents | **34900** |
| paymentAmount | **34900** |
| currency | **ZAR** |
| pricingVersion | **2026-08-v349** |
| paymentStatus | **pending** |
| YA liability | **none** (correct pre-pay) |
| Checkout amount | **349.00** |
| Live PayFast card payment | **NOT COMPLETED** (requires Founder UI) |
| Live ITN | **NOT OBSERVED** |

Org + tender **reactivated** after smoke archive so this booking remains payable.

---

## 9. R200 / BI / paid lifecycle

**Not certified** — depends on live payment completion.

---

## 10. Financial invariants (code + pre-pay snapshot)

| Invariant | Expected | Result |
| --- | --- | --- |
| SME | 34900 | PASS |
| YA liability | 20000 | Constants PASS; live count **N/A** |
| Gross | 14900 | PASS |
| Pricing version | 2026-08-v349 | PASS |
| Automated YA bank transfer | NONE | Architecture unchanged |

---

## 11. CI / deployment

| Gate | Result |
| --- | --- |
| Deploy 32986464322 | **success** |
| Wave4 prod smoke | **35/35** |
| Role probes | PASS |
| PR #64 CI | PASS (prior) |

---

## 12. Rollback

| Target | Use |
| --- | --- |
| Flag disable | Preferred first response |
| `tenderbriefing-00141-fmm` | Immediate prior |
| `tenderbriefing-00137-fbl` | Phase 2 certified |

Do not delete Firestore payment/finance/follow-up/audit data.

---

## 13. Residual risks / blockers

**Blocking for PRODUCTION CERTIFIED**

1. Founder completes live R349 on `req-1787761531376-5722tx` (or fresh equivalent)
2. Prove ITN → paid once; R200 liability count = 1
3. Complete YA evidence → BI v2 → Founder approve → SME delivery on that paid job
4. Re-verify notifications on paid transitions

**Non-blocking**

- Wave4 smoke archives cross-org users; primary smoke org reactivated
- Deep adversarial BI transcript matrix not re-run live this session

---

## 14. Recommended Founder action

1. Sign in as smoke SME (`ops-smoke-sme@tenderbriefing.co.za`)
2. Open attendance request **`req-1787761531376-5722tx`** and complete **live PayFast R349.00**
3. Continue assignment → evidence → BI → approve → liability audit
4. Only then promote verdict to **PRODUCTION CERTIFIED — PRIVATE TENDER BRIEFING OPERATIONS PHASE 3**
