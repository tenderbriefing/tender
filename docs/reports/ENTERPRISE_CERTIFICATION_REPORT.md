# Tender Briefing — Enterprise Release Certification Report

**Programme:** Enterprise SaaS Transformation  
**Date:** 2026-07-31  
**Author role:** Principal Architect / Staff Security / Platform / SRE / Release Manager  

---

## 1. Executive verdict

**PASS WITH CONDITIONS**

Critical security boundaries, PayFast hardening, attendance/payment domain models, governance, CI gates, and unit tests were delivered without deploying. Full E2E, Firestore emulator suite, Next/Firebase major upgrades, and shared rate limiting remain conditional follow-ups before an unqualified PASS.

## 2. Release classification

- security hardening  
- refactor  
- platform upgrade (governance, CI, typed domain/config)  
- dependency upgrade (vitest added; Next/Firebase majors **deferred**)  

**Not** a rewrite or architecture migration of the App Router ↔ backend boundary.

## 3. Git integrity

| Field | Value |
|-------|--------|
| Starting SHA (Phase 0) | `27a5463ea2b10395f9963d16772264c256c22377` |
| Batch 0 SHA | `d228dc663d4e958407f1e545f9ca8af6fd895848` |
| Final SHA | `d4063eb` (+ docs amendment commits if any) |
| Branch | `master` |
| Ahead of origin | 4+ (not pushed; no deploy) |
| Excluded unrelated files | None (prior audit tree classified intended and committed in Batch 0) |

Commit list for this programme (after final commits): see `git log 27a5463..HEAD`.

## 4. Architecture changes

**Consolidated / authoritative modules**

- `lib/domain/paymentLifecycle.ts` — payment states, fee resolution, amount checks  
- `lib/domain/attendanceLifecycle.ts` — workflow transitions + role gates  
- `lib/security/accessControl.ts` — ownership/ACL helpers  
- `lib/config/runtimeConfig.ts` — typed server config  
- `lib/observability/logger.ts` — structured logs with redaction  
- `lib/api/errors.ts` — standard error shape  

**Removed / retired**

- Dead Connector booking UI (Batch 0)  
- Yoco create/confirm → **410**  
- Legacy `/api/bookings` → **410** (Batch 0)  

**Routes**

- `/bookings` → `/sme/requests` (Batch 0)  
- WhatsApp webhook production fail-closed unless enabled + secret  

**Firestore**

- `attendanceRequests` privileged-field denylist for client updates  

## 5. Security certification

| Area | Status | Notes |
|------|--------|-------|
| Authentication | PASS | middleware JWT + `verifyApiUser`; suspended users denied |
| Authorisation | PASS WITH CONDITIONS | Central ACL helpers + existing guards; not every of 109 APIs re-audited line-by-line this sprint |
| IDOR | IMPROVED | PDF ownership (Batch 0); attendance privileged fields locked in rules |
| Role isolation | PASS | Bootstrap strips elevation; rules deny role escalation |
| Tenant isolation | IMPROVED | Rules + ACL tests for SME A/B |
| Secrets | IMPROVED | Smoke password required; prod Firebase env required; public web fallback non-prod only |
| API validation | PARTIAL | Domain validators added; full zod schema coverage deferred |
| Rate limiting | BEST-EFFORT | Documented in-memory only |
| Secure headers | PASS | Existing next.config CSP/HSTS etc. retained |
| Webhooks | IMPROVED | PayFast structured logging + duplicate ITN; WhatsApp HMAC/fail-closed |
| Residual risks | P1 | Next 14.0.4 / Firebase 9 advisories; incomplete E2E IDOR matrix; dual JS backend |

## 6. PayFast certification

| Check | Status |
|-------|--------|
| Server-side amount | PASS — `EFFECTIVE_FEE_CENTS` / canonical 24900 |
| Client amount ignored | PASS |
| Signature + validate + merchant | PASS (existing service) |
| Idempotent paid / duplicate ITN | PASS (enhanced) |
| Redirect non-authoritative | PASS (documented + unchanged) |
| Unit tests | PASS (signature helper, amount, transitions) |
| Residual | Live ITN sandbox soak still manual; full ITN integration tests need PayFast/test doubles for validate URL |

## 7. Attendance lifecycle certification

| Check | Status |
|-------|--------|
| Explicit states | PASS (`lib/domain/attendanceLifecycle.ts`) |
| Transition enforcement module | PASS (unit tested) |
| Wired into every legacy JS assign path | PARTIAL — model + rules first; gradual caller adoption |
| Concurrent updates | PARTIAL — Firestore transactions not universally applied |
| Audit history | PARTIAL — payment audit events exist; not every transition emits yet |

## 8. Firestore certification

| Check | Status |
|-------|--------|
| Privileged attendance fields | PASS (rules + QA script asserts) |
| auditLogs client write deny | PASS |
| Static rules QA | PASS |
| Emulator multi-identity suite | HOLD — not added this sprint (static QA only) |
| Indexes | Unchanged; no new unbounded query introduced |

## 9. API certification

| Metric | Approx |
|--------|--------|
| Total route handlers | ~109 |
| Public | tender GETs, health, ITN, support POST, selected sync |
| Protected | majority Bearer |
| Admin | `/api/admin/**`, calendar mutations |
| Retired | bookings, yoco, yoco webhook, prod-blocked legacy |
| Undocumented deep inventory | Partial — summary in `API_INVENTORY.md` |
| Validation coverage | Partial |
| Rate-limit coverage | Public tenders / support / selected paths (existing) |

## 10. Test evidence

| Suite | Result |
|-------|--------|
| Unit (`npm test`) | **17 passed / 0 failed** (4 files) |
| `npm run typecheck` | **PASS** |
| `npm run lint` | **PASS** (1 warning: legacy ConnectorMatching hook deps) |
| `npm run qa:firestore-rules` | **PASS** |
| `npm run qa:google-auth` | **PASS** |
| Firestore emulator | Not run (no new emulator suite) |
| E2E | Not automated this sprint |
| `npm run build` | **PASS** (standalone Next build completed successfully) |

## 11. Dependency audit

| Item | Status |
|------|--------|
| Added | `vitest` |
| Removed (Batch 0) | stripe, headlessui, rhf, dropzone |
| Upgraded Next/Firebase | **Deferred** — high blast radius; advisories remain |
| `npm audit` | Critical/high remain (Next/Firebase/transitive) — tracked P1 |

## 12. Performance impact

No intentional bundle expansion for product UI. Vitest is dev-only. No before/after production build size captured (**CONDITION**). No N+1 query rewrites this sprint.

## 13. Accessibility

No dedicated WCAG automation added (**CONDITION**). Terminology/nav consistency improved earlier; no redesign.

## 14. Observability

- Structured logger + ITN/WhatsApp events  
- Audit logs for payment confirm/fail  
- Recommended dashboards/alerts documented  
- Missing: centralized APM, full transition event coverage  

## 15. Documentation

**Created:** governance (4), ADRs (8), architecture inventory/lifecycle/API, operations env+observability, runbooks rollback+PayFast, Phase 0 baseline, this report.  
**Updated:** README, firestore-rules-qa, CI workflow.  
**Obsolete retained:** `docs/YOCO_PAYMENTS_SETUP.md` (historical; routes 410).

## 16. Files removed (Batch 0 highlight)

~30 dead components (`BookingModal`, `TenderCard`, unused home sections, etc.), `lib/config/enhancedEnvironment.ts`, `app/page-simple.tsx`. See commit `d228dc6`.

## 17. Files added (programme)

Governance/ADR/ops docs; `lib/domain/*`; `lib/security/accessControl.ts`; `lib/config/runtimeConfig.ts`; `lib/observability/logger.ts`; `lib/api/errors.ts`; `tests/unit/*`; `vitest.config.ts`; `.eslintrc.json`.

## 18. Remaining technical debt

| ID | Item | Class |
|----|------|-------|
| D1 | Next 14.0.4 → patched 14.2.x+ | P1 |
| D2 | Firebase 9 → modern modular SDK | P1 |
| D3 | Firestore emulator IDOR matrix | P0 for unqualified PASS |
| D4 | Wire lifecycle asserts into all JS assignment services | P1 |
| D5 | Production build + bundle baseline in CI | P1 |
| D6 | Shared rate limit (Redis/Armor) | P2 |
| D7 | Collapse root markdown sprawl | P2 |
| D8 | Delete bookingService/matching when prod-block proven permanent | P2 |
| D9 | Full E2E SME/agent/admin journeys | P1 |
| D10 | Dual `require(backend)` typed adapter programme | P2 |

## 19. Deployment recommendation

**do not deploy** from this certification alone until:

1. Remaining programme commits are pushed  
2. CI goes green on the release SHA (typecheck/lint/test/QA)  
3. Optional: `npm run build` green on CI — **local build already PASS**
4. Explicit human approval  

Then: **deploy with conditions** (monitor ITN + auth; WhatsApp remains disabled unless secrets set).

## 20. Rollback plan

- Last known good pre-programme: `27a5463`  
- Post Batch 0: `d228dc6`  
- Process: `docs/runbooks/ROLLBACK.md`  
- Rules rollback: redeploy `firestore.rules` from last-good SHA  
- Payments: code rollback does not reverse PayFast settlements  

## 21. Manual production smoke plan

1. SME sign-in  
2. Tender discovery `/tenders`  
3. Book an agent → attendance request  
4. PayFast initiation (sandbox/live as configured)  
5. Verified ITN → `paymentStatus=paid`  
6. Agent assignment visibility  
7. Agent accept  
8. En-route / arrived / complete (as product supports)  
9. SME tracking `/sme/requests`  
10. Briefing PDF access (owner only)  
11. Cross-user denial (SME B cannot open SME A request)  
12. Admin-only calendar delete  
13. `/api/bookings` → 410  
14. `/api/payments/yoco/*` → 410  
15. WhatsApp POST without enablement → 503 in production  

## 22. Enterprise-readiness score ( /10 )

| Category | Score |
|----------|-------|
| Architecture | 7 |
| Security | 7 |
| Payments | 8 |
| Data integrity | 7 |
| Testing | 5 |
| Observability | 6 |
| Reliability | 6 |
| Performance | 6 |
| Accessibility | 4 |
| Developer experience | 7 |
| Deployment maturity | 7 |
| Operational readiness | 7 |

**Overall: 6.4 / 10**

**Largest remaining gap:** Firestore emulator IDOR matrix + full E2E journeys and Next/Firebase advisory upgrades — without these, enterprise “PASS” cannot be unqualified.

---

## Batch change log (summary)

| Batch | Objective | Result |
|-------|-----------|--------|
| 0 | Prior audit hardening commit | `d228dc6` |
| 1 | Governance + ADR + inventory | Docs added |
| 2–5 | ACL, rules, PayFast, lifecycle | Code + tests |
| 6 | Config + observability | Modules + ITN logs |
| 7 | CI + vitest + eslint | CI strengthened |
| 8–9 | Terminology/docs/legacy yoco 410 | Done selectively |
| 10 | Certification | This document |

**No production deployment performed.**
