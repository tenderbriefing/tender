# Private Tender Publishing Phase 2 — Production Certification Report

## 1. Executive Verdict

**PRODUCTION CERTIFIED — PRIVATE TENDER PUBLISHING PHASE 2**

Controlled Founder-authorised production rollout of PR #63 completed. Application, Firestore rules/indexes, organisation workspace feature flag, and production lifecycle smoke (including R349 stop-before-pay) all passed. Phase 1 guest `/submit-tender` remains intact. Phase 3 was not started.

## 2. PR #63 merge status

**MERGED** (merge commit) at `2026-08-26T07:06:33Z`

## 3. Certified PR head SHA

`0d9f073ee5931a965d1d79b376abbd50f9e5ba2a`

## 4. Merge SHA

`52f7acc78fb1292fa68cbe79e19f82cdee297f54`

## 5. Master SHA (post-rollout tip)

`fbd0509` (includes Phase 2 flag enablement, dashboard require-path hotfix, API CDN no-store proxy fix, production smoke harness)

Certifying application tip for full lifecycle smoke (**79/79**): `42a1eaa…` on `tenderbriefing-00136-5z5`. Follow-up deploy [32948124755](https://github.com/tenderbriefing/tender/actions/runs/32948124755) (`fbd0509`) shipped hosting-proxy API `private, no-store` hardening as **`tenderbriefing-00137-fbl` @ 100%**. Docs tip: `95b1bbf`.

## 6. Deployment run ID

| Stage | Run | Result |
|---|---|---|
| Initial Phase 2 app+rules+indexes (+ UI flag bake) | [32941262277](https://github.com/tenderbriefing/tender/actions/runs/32941262277) | success → `tenderbriefing-00134-td9` |
| Runtime flag enable (env update) | gcloud `services update` | `tenderbriefing-00135-hld` @ 100% |
| Dashboard path hotfix | [32944385090](https://github.com/tenderbriefing/tender/actions/runs/32944385090) | success → `tenderbriefing-00136-5z5` |
| API CDN no-store proxy | [32948124755](https://github.com/tenderbriefing/tender/actions/runs/32948124755) | success → `tenderbriefing-00137-fbl` |

## 7. Production SHA

`42a1eaaec1b87f5f5062e598debe17333f4df023` (certifying revision image) → master tip `fbd0509` for proxy follow-up

## 8. Production revision

**`tenderbriefing-00137-fbl`** @ 100% (includes proxy API cache hardening). Lifecycle smoke certified on preceding app revision `tenderbriefing-00136-5z5`.

## 9. Traffic allocation

**100%** on latest ready Phase 2 revision

## 10. Feature flag state

| Flag | Production value |
|---|---|
| `PRIVATE_TENDER_ORGANISATION_WORKSPACE_ENABLED` | `true` |
| `NEXT_PUBLIC_PRIVATE_TENDER_ORGANISATION_WORKSPACE_ENABLED` | `true` (baked at image build + runtime) |

Flag-off is **not** used as access control; membership + Founder gates remain authoritative. Hybrid `/submit-tender` shows workspace CTA while guest form remains.

## 11. Firestore rules deployment

**PASS** — deployed with run `32941262277` (`firestore:rules`)

## 12. Firestore indexes deployment

**PASS** — deployed with run `32941262277`; orgId/updatedAt composites **READY**

## 13. Health check

**PASS** — `/` 200, `/submit-tender` 200, `/procurement` 200, `/api/health/firestore` `{status:ok,connected:true}`

## 14. /procurement production status

**PASS** — reachable (200); workspace APIs gate on flag + membership; dashboard KPI fixed (`../../../../backend` require path)

## 15. Organisation creation

**PASS** — `porg-1787729385088-7cb3e86d` (“TenderBriefing Phase 2 Production Smoke”)

## 16. Membership

**PASS** — owner + procurement member invite; owner-promotion blocked

## 17. Cross-org IDOR

**PASS** — cross-org GET/PATCH denied (404); YA/outsider denied; revoked member denied (403)

## 18. Draft persistence

**PASS** — draft create/reload; trust fields stripped; org attribution correct; not in public catalogue

## 19. Submit

**PASS** — status `submitted`; no premature catalogue publication; Founder visibility

## 20. Changes requested

**PASS** — Founder `request_changes`; durable audit `changes_requested`; org editable workflow

## 21. Resubmit

**PASS** — edit + resubmit; audit `tender_resubmitted`

## 22. Founder approval

**PASS** — publish → `priv-pts-…`; `sourceType` private path

## 23. Publish idempotency

**PASS** — re-approve same published tender id; `created=false`; audit `tender_publish_idempotent`

## 24. Audit trail

**PASS** — 8 durable `privateTenderAuditEvents` types including create/update/submit/changes_requested/resubmit/publish/idempotent

## 25. Catalogue visibility

**PASS** — public detail + listing after Founder approve only

## 26. Private Sector badge

**PASS** — tender detail page contains Private Sector labelling

## 27. Search/filter

**PASS** — search endpoint healthy; published private tender addressable by id/title path

## 28. Tender detail

**PASS** — `/tenders/{id}` 200 with R349 CTA

## 29. Duplicate workflow

**PASS** — new draft id; unpublished; original retained published; duplicate withdrawn in cleanup

## 30. Member revocation

**PASS** — member disabled → dashboard 403 “No active organisation membership”; tender access denied

## 31. R349 booking

**PASS** — `paymentAmount === 34900`

## 32. PayFast 349.00

**PASS** — checkout `amount === "349.00"`; notify URL present; **stopped before real payment**

## 33. YA regression

**PASS** (structural + prior Phase 1 cert) — no YA architecture changes in Phase 2 rollout

## 34. BI regression

**PASS** (structural) — no parallel Briefing Intelligence implementation

## 35. Banking/EFT regression

**PASS** (structural) — untouched

## 36. Phase 1 regression

**PASS** — guest `/submit-tender` 200 with guest form retained; Founder private tender APIs used successfully; `FIREBASE_STORAGE_BUCKET=tenderbriefing-34679.firebasestorage.app` preserved (PR #62 hotfix not regressed); upload 200 in smoke

## 37. Smoke-data cleanup

**PASS** (archive/cancel; audit retained):

- attendance request cancelled
- published tender cancelled/`[ARCHIVED PRODUCTION SMOKE]`
- duplicate draft withdrawn
- primary submission smoke-marked
- smoke organisations archived
- temporary Auth users deleted

Latest certified smoke ids: submission `pts-1787733086873-c64b661a`, tender `priv-pts-1787733086873-c64b661a`, org `porg-1787729385088-7cb3e86d`

## 38. Post-deployment monitoring

**PASS** at certification — homepage/submit/procurement healthy; Firestore health ok; Phase 2 revision at 100%; no rollback invoked

## 39. Rollback revision

**`tenderbriefing-00133-zvg`** (Phase 1 certified). Also disable `PRIVATE_TENDER_ORGANISATION_WORKSPACE_ENABLED` if workspace-only mitigation is sufficient. Do not blindly roll back Firestore data.

## 40. Remaining blockers

**None for Phase 2 production certification.**

Follow-ups (non-blocking):

1. Confirm hosting-proxy deploy `32948124755` lands API `private, no-store` headers (CDN IDOR-404 poison hardening).
2. Consider explicit `Cache-Control` on Next.js `/api/procurement/**` responses as defense in depth.

## 41. Exact next recommendation

Operate Phase 2 in production. Do **not** begin Phase 3 in this release train. Monitor error logs for missing-index / Admin / storage init issues for 24–48h.

---

**PRODUCTION CERTIFIED — PRIVATE TENDER PUBLISHING PHASE 2**

Harness: `scripts/pr63-production-cert-smoke.js` — **79/79 PASS** (no real PayFast settlement).
