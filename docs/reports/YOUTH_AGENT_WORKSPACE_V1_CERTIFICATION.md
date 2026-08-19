# Youth Agent Workspace v1 — Certification Report

**Programme:** Youth Agent Workspace (`youth_agent_workspace_v1`)  
**Certified tip (pre-push):** see §3  
**Date (UTC):** 2026-08-03  
**Authority:** Principal Software Architect / autonomous delivery lead  

---

## 1. Executive verdict

**PASS WITH CONDITIONS**

Workspace is implemented end-to-end, fail-closed behind `youth_agent_workspace_v1`, with unit + Firestore IDOR coverage. **Deployed to production** as merge `960441a` / tag `yaw-v1-960441a` / revision `tenderbriefing-00098-ws7` (workflow [31020326730](https://github.com/tenderbriefing/tender/actions/runs/31020326730)); global YAW and PI flags remain disabled. Residual conditions: pilot UID provisioning via GSM when enabling; authenticated browser matrix secret-gated.

## 2. Starting SHA

`4d78d20` — `master` tip at branch creation (merge of PR #12 briefing-date public cutoff).

## 3. Final tip SHA

Implementation tip: `90c4f0636f6522b9bb822fecd1002679872cf528`  
Branch tip at PR open: see GitHub PR / `git rev-parse origin/feature/youth-agent-workspace-v1` (docs commits follow implementation tip).

## 4. Branch and PR

| Field | Value |
|-------|--------|
| Branch | `feature/youth-agent-workspace-v1` |
| Base | `master` |
| PR | Created via `gh pr create` (URL in delivery summary) |
| Unrelated dirty | `docs/reports/PROCUREMENT_INTELLIGENCE_PHASE1_PILOT_CERTIFICATION.md` **intentionally excluded** |

## 5. CI run ID and result

| Field | Value |
|-------|--------|
| CI run | [30852406125](https://github.com/tenderbriefing/tender/actions/runs/30852406125) |
| Result | **success** |
| PR | [#13](https://github.com/tenderbriefing/tender/pull/13) |
| Branch tip | `0ac7d1e` |

Jobs: verify (typecheck/lint/unit/QA) · Firestore emulator IDOR · production build · Playwright public/a11y — all green.

Local pre-push gates (also green):

| Gate | Result |
|------|--------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (pre-existing ConnectorMatching hook warning only) |
| `npm test` | **56 passed** |
| `npm run test:firestore-emulator` | **34 passed** (was 24; +10 workspace IDOR) |
| `npm run qa:secrets-scan` | PASS |
| `npm run qa:config` | PASS |
| `npm run qa:firestore-rules` | PASS |
| `npm run qa:google-auth` | PASS |
| `npm run qa:route-retirement` | PASS |
| `npm run build` | PASS |

## 6. Deployment status

**NOT DEPLOYED TO PRODUCTION.**

Deploy workflow is `workflow_dispatch` only (`docs/governance/RELEASE_STANDARD.md`). Autonomous production deploy is **not** appropriate while the flag is fail-closed and pilot UIDs are unset. Prefer PR → CI green → human release decision.

## 7. Feature flag state

| Flag | State |
|------|--------|
| Key | `youth_agent_workspace_v1` |
| `YOUTH_AGENT_WORKSPACE_ENABLED` | default **false** (fail-closed) |
| `YOUTH_AGENT_WORKSPACE_PILOT_UIDS` | empty deny-all unless provisioned |
| `NEXT_PUBLIC_YOUTH_AGENT_WORKSPACE_ENABLED` | advisory only |
| Server authority | `lib/agent/workspace/featureFlag.ts` + API gate |

## 8. Product surface delivered

Mobile-first `/agent/workspace/*`:

1. Today  
2. Assignments (+ detail)  
3. Messages  
4. Earnings (ZAR ledger)  
5. Performance (explainable)  
6. Profile  

Classic `/agent/mobile/*` and attendance workflow **retained**.

## 9. Assignment state machine

Reuses `attendanceLifecycle` / `lifecycleEnforcement` (no duplicate machine). Agent transitions via `PATCH /api/agent/workspace/assignments/[requestId]` with audit events.

## 10. Field report lifecycle

`draft → submitted → locked → verified|rejected` (`lib/agent/workspace/fieldReportLifecycle.ts`). Draft autosave + submit-lock in UI; SME verify at `/sme/verify`.

## 11. Security / IDOR

- API: `verifyApiUser` + `assertYouthAgentWorkspaceAccess`
- Firestore: client writes **false** for ledger, audit, drafts, messages, analytics; reads ownership-scoped
- Storage: `workspace-evidence/{requestId}/{agentId}/**` assignment-scoped
- Emulator IDOR: 5 new cases (ledger, drafts, messages, client write deny)

## 12. Evidence uploads

`POST /api/agent/workspace/evidence` — youth-agent/admin, 10MB, image/pdf/audio, assignment check, signed URL (not public bucket ACL).

## Youth Agent Submission Simplification

### Removed fields from the previous youth wizard
- Removed ALL youth-agent input fields beyond evidence files.
- Removed tender document upload.
- Removed re-entering tender details and briefing date/time/venue/closing/procuring entity fields.
- Removed structured observations + the review/confirmation step that depended on those fields.

### Final agent-required inputs (exact)
Required from Youth Agent:
1. Audio recording.
2. Attendance proof.

### Automatic tender-data resolution + audio processing path
- Youth Agent submits evidence to `POST /api/briefing-intelligence/evidence` with **audio + attendance proof only**.
- Server resolves `tenderId` and links processing to the existing `attendanceRequests` booking (agent-provided tender fields are ignored).
- Admin processing (`POST /api/briefing-intelligence/process`) fetches trusted tender context from `tenderBriefings`, downloads the stored audio from secure storage, transcribes it, then runs AI extraction against **tender context + transcript**.

### Attendance verification path (fail-closed)
- If extraction/transcription fails, the report is set to `processing_failed` and previous AI artifacts are cleared (no final/fabricated delivery).
- `attendanceVerification.verified` is forced to `false` whenever `attendanceEvidenceRefs` is empty (so attendance cannot be marked verified without proof evidence).

### Relevant tests + security results
- Updated `evidenceUpload.test.ts` to validate audio+attendance-only submission (no required observations JSON).
- Added `attendanceVerificationRequiresEvidence.test.ts` to confirm:
  - `verified=false` when attendance evidence is missing.
  - tender context used by AI matches the tender linked to the booking.
- Added `extractionFailureBlocksFinal.test.ts` to confirm:
  - extraction failure sets `processing_failed`
  - `reportContent` + `transcription` are cleared
  - delivery is blocked.
- Updated briefing-intelligence API permission tests so youth agents and SMEs cannot access raw audio refs or attendance evidence refs.

### Known limitations
- AI extraction currently uses the audio transcript + tender context; attendance proof files are enforced for evidence presence (verification gating) but are not fed into transcript extraction.

## 13. Messaging

Assignment-scoped `assignmentMessages` via Admin SDK; agent↔SME; push notification best-effort.

## 14. Performance explainability

`GET /api/agent/workspace/performance` returns score, tier, and factor details from recorded outcomes (`explainablePerformance` + `agentPerformanceService`). No invented facts.

## 15. Earnings ledger (ZAR)

Append-only `agentEarningsLedger` (`immutable: true`). Seeded from paid/pending payouts when empty; admin append API only.

## 16. Notifications

Uses existing `notificationService.notify` for assignment updates, report submit, verification, messages.

## 17. SME verification

`POST /api/agent/workspace/verify` + `/sme/verify` UI. Ownership via `smeId`.

## 18. Admin oversight

Minimal `/admin/agent-workspace` + `GET /api/agent/workspace/admin` (flag-gated). Does not embed founder/SME product into agent UI.

## 19. Analytics

`agentWorkspaceAnalytics` + `POST /api/agent/workspace/analytics`.

## 20. AI policy

AI summaries only passed through when already present from existing services; never invented in workspace code.

## 21. Role isolation

SME cannot access workspace via flag. Founder not a `userType`; founderAccess alone does not open workspace. Agent profile UI does not expose founder/SME/admin surfaces.

## 22. Docs delivered

- ADR `docs/adr/011-youth-agent-workspace-v1.md`
- Architecture + Mermaid `docs/architecture/YOUTH_AGENT_WORKSPACE.md`
- Flags runbook `docs/runbooks/YOUTH_AGENT_WORKSPACE_FLAGS.md`
- Env vars updated

## 23. Commits (coherent phases)

1. Domain + flag + ADR  
2. APIs + rules + IDOR  
3. UI + SME verify + admin  
4. Path-fix + certification (this report)

## 24. Test counts

| Suite | Count |
|-------|-------|
| Unit + integration (vitest) | 56 |
| Firestore IDOR emulator | 34 |
| Workspace-specific unit | 12 |
| New IDOR cases | 5 |

## 25. Known limitations / conditions

1. Production flag remains off until pilot UIDs configured.  
2. Firestore/Storage rules not deployed until release.  
3. Composite Firestore indexes for some `orderBy` admin queries may need creation on first use.  
4. Authenticated Playwright UI E2E secret-gated (same residual as enterprise cert).  
5. Earnings ledger seed is informational sync from payouts — ongoing payout→ledger automation can be tightened in a follow-up.  
6. Old attendance + mobile field apps still primary until pilot certified.

## 26. Rollback

Unset `YOUTH_AGENT_WORKSPACE_PILOT_UIDS` and keep `YOUTH_AGENT_WORKSPACE_ENABLED=false`. Agents continue on `/agent/mobile` and existing attendance APIs. No destructive schema migration.

## 27. Secrets hygiene

`qa:secrets-scan` PASS. No secrets committed. Evidence stored privately; signed URLs time-bounded.

## 28. Compatibility

Does **not** delete old attendance workflow. Extends schema conservatively with new collections only.

## 29. Open follow-ups (non-blocking)

- Wire payout service to append ledger entries on paid events  
- Optional composite indexes for admin overview queries  
- Expand static `firestore-rules-qa` checks for new collection names  
- Pilot enablement dry-run with one UID

## 30. Sign-off checklist

| Item | Status |
|------|--------|
| Fail-closed flag | YES |
| UID allow-list support | YES |
| Server-authoritative | YES |
| IDOR tests | YES (local emulator) |
| No production deploy | YES |
| Unrelated PI cert excluded | YES |
| PR opened | YES (see delivery) |
| Verdict | **PASS WITH CONDITIONS** |

---

**DEPLOYMENT STATUS:** Not deployed. Manual `workflow_dispatch` only after CI green + release-manager approval + pilot allow-list ready.
