# Private Tender Publishing Phase 2 — Certification Report

## 1. Executive Verdict

**READY FOR FOUNDER APPROVAL TO MERGE**

Phase 2 organisation procurement workspace is implemented on branch `feat/private-tender-organisation-workspace` without replacing certified Phase 1 behaviour. Feature flag is fail-closed. Not production-certified until Founder merge approval, deploy (app + rules + indexes), and production smoke.

## 2. Branch

`feat/private-tender-organisation-workspace`

## 3. Base SHA

`4082c2062818d71dbb1429d61a12477d1c812577` (`origin/master`, includes certified Phase 1 tip `a92c61c…` + Phase 1 production certification docs)

Production baseline referenced by Founder brief:

- Certified production SHA: `a92c61c82ca152339dca212703162603a0d2c199`
- Revision: `tenderbriefing-00133-zvg` @ 100%
- Rollback: `tenderbriefing-00131-nj5`

## 4. Final SHA

`670369fa86b4072320a80f5685b07f4c97c5a163`

## 5. PR

Pending push — see GitHub PR for `feat/private-tender-organisation-workspace`

## 6. Files Changed

Key additions:

- Assessment: `docs/private-tender-phase2-assessment.md`
- Architecture: `docs/PRIVATE_TENDER_PHASE2.md`
- Domain: org types/permissions, status machine, workspace feature flag
- Services: `privateOrganisationService`, `privateOrganisationMemberService`, `privateTenderAuditService`, Phase 2 helpers on `privateTenderSubmissionService`
- APIs: `/api/procurement/**`
- UI: `/procurement/**` workspace; soft CTA on `/submit-tender`
- Founder: change-request category on review UI/API
- Firestore: deny-all rules for new collections; org indexes
- Tests: `tests/unit/privateTenderPhase2.test.ts`
- Backfill scaffold: `scripts/backfill-private-tender-organisations.js` (dry-run only)

## 7. Architecture Summary

Organisation → org-scoped drafts in `privateTenderSubmissions` → Founder moderation → canonical `tenderBriefings` (`sourceType=private`) → existing R349 / YA / BI.

No parallel booking, BI, or tender datastore. Phase 1 guest `/submit-tender` preserved (hybrid with workspace CTA when UI flag on).

## 8. Organisation Model

- `privateOrganisations` — legal profile + `verificationStatus` (users cannot self-verify)
- `privateOrganisationMembers` — `owner` | `admin` | `procurement`; `active` | `invited` | `disabled`

## 9. Permission Matrix

| Capability | owner | admin | procurement |
| --- | --- | --- | --- |
| manage profile / members | ✓ | ✓ | |
| create / edit / submit / withdraw / duplicate | ✓ | ✓ | ✓ |
| publish to catalogue | Founder only | Founder only | Founder only |

## 10. Tender State Machine

Central transitions in `lib/privateTenders/statusMachine.ts` + `backend/services/privateTenderStatusMachine.js`.

Org withdraw allowed only for `draft` | `submitted` | `changes_requested`. Published cancellation requires Founder.

## 11. Founder Moderation

Existing Founder queue/APIs retained. Review supports `issueCategory` for request-changes; historical notes kept on submission (`reviewHistory` / `changesRequestedNote`). Publish remains idempotent.

## 12. Security / IDOR

- New collections: client `allow read, write: if false`
- `privateTenderSubmissions` deny-all unchanged
- Procurement APIs derive membership from Auth UID; reject cross-org ids
- Unit coverage: permissions, withdraw rules, duplicate isolation, flag fail-closed

## 13. Firestore Rules

Deny-all added for `privateOrganisations`, `privateOrganisationMembers`, `privateTenderAuditEvents`. Phase 1 submission rules unchanged. `qa:firestore-rules` **PASS**.

## 14. Firestore Indexes

Composites for org list/filter, membership lookups, audit by submission. Deploy with release.

## 15. R349 Regression

No pricing/PayFast/cloudbuild payment changes. Phase 1 publish → canonical tender → existing attendance request path unchanged. Unit suite includes PayFast / briefing pricing tests **PASS**.

## 16. Youth Agent Regression

No YA architecture changes. Private source remains metadata on canonical tender.

## 17. Briefing Intelligence Regression

No second BI pipeline. Existing evidence → Whisper → AI → Founder path unused by this PR except structural compatibility.

## 18. SEO

`/procurement/**` uses `PRIVATE_ROUTE_ROBOTS` (noindex). `/submit-tender` remains noindex. Published tender SEO unchanged.

## 19. Notifications

Existing fail-soft private tender email helpers reused on org submit. Provider failure must not roll back transitions (unchanged contract).

## 20. Tests

| Gate | Status |
| --- | --- |
| typecheck (`tsc --noEmit`) | **PASS** |
| lint | **PASS** (pre-existing unrelated warning) |
| unit (`tests/unit` — 341) | **PASS** |
| Phase 2 unit (`privateTenderPhase2`) | **PASS** |
| Phase 1 PR61 cert units | **PASS** |
| `qa:firestore-rules` | **PASS** |
| `qa:google-auth` | **PASS** |
| production build | **PASS** |
| Firestore emulator IDOR (CI) | run on PR |
| Playwright / Founder smoke / PayFast prod smoke | run on PR / post-merge |

## 21. Secrets Audit

No secrets, service accounts, PayFast keys, or OpenAI credentials introduced in branch files. Feature uses existing Auth / Admin SDK patterns.

## 22. Feature Flag / Rollback

- `PRIVATE_TENDER_ORGANISATION_WORKSPACE_ENABLED` (server, fail-closed)
- `NEXT_PUBLIC_PRIVATE_TENDER_ORGANISATION_WORKSPACE_ENABLED` (UI only)
- Disable flag → Phase 1 public submit + Founder review continue
- Do not delete org/draft data on rollback

## 23. Outstanding Issues

1. Full end-to-end org→Founder→publish→R349 production smoke deferred until after Founder merge + controlled deploy (flag on).
2. Optional backfill of legacy Phase 1 rows into organisations not executed (scaffold only).
3. Founder “approve” still publishes in one step (Phase 1 behaviour; `approved` status reserved).

## 24. Merge Recommendation

**READY FOR FOUNDER APPROVAL TO MERGE**

Do **not** merge or deploy automatically. On approval: merge via normal controlled strategy, deploy app + Firestore rules + indexes together, enable workspace flag in production deliberately, then run Phase 2 acceptance + R349 regression smokes before claiming production certification.
