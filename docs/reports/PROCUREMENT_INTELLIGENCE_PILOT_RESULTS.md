# Procurement Intelligence Phase 1 — Authenticated Pilot Results

**Verdict:** PASS WITH CONDITIONS  
**Finished UTC:** 2026-08-03T13:16:44Z  
**SAST:** 2026-08-03T15:16:44+02:00

## Runtime (current)

| Field | Value |
|-------|--------|
| Code SHA | `a6d2b922e634efc64e8ebe1b5886f4b46006a087` |
| Tag | `pi-pilot-rules-a6d2b92` |
| Deploy workflow | [30814718880](https://github.com/tenderbriefing/tender/actions/runs/30814718880) |
| Prior pilot deploy | [30812294505](https://github.com/tenderbriefing/tender/actions/runs/30812294505) @ `3c177dd` |
| Build ID (current) | `04107842-040e-4bc0-980f-fdd1bc2d4d04` |
| Final revision | `tenderbriefing-00096-h4h` @ 100% |
| Image digest | `sha256:853b9d5e003f60c7a6f02295a520b031132254032c43ebd4b19642c24e1954d5` |
| Server flag | `false` |
| Client flag | `false` |
| Pilot UID source | GSM `procurement-intelligence-pilot-uids` |
| Pilot UID count | **2** |

## Identities (masked)

| Role | Account | UID mask | Source |
|------|---------|----------|--------|
| Pilot A | ops-smoke-admin@… | `DT64…ag53` | existing internal QA |
| Pilot B | ops-smoke-sme@… | `dGkf…s9e2` | existing SME QA |
| Control C | ops-smoke-sme-control@… | `p0ox…z2P2` | synthetic (`cleanupTag=pi-phase1-pilot-synthetic`) |

## Acceptance summary

| Gate | Result |
|------|--------|
| Unauth PI API | 401 |
| Pilot A/B API | 200 (eligibility, fit, checklist; `definitiveEligible=false`) |
| Pilot B bounded sample | **8/8** HTTP 200 |
| Control C API | **403** |
| Agent role | **401** |
| Missing tender | **404** |
| Checklist progress own read/write | **PASS** (after rules fix) |
| Cross-tenant progress | **DENIED** both directions |
| Revoke (placeholder UID) | Pilot **403**; flags stayed false |
| Restore (2 UIDs) | Pilot **200**; Control still **403** |

## Residuals

1. Full browser UI / Playwright production matrix not re-run (API + client SDK certified).
2. Structural fact harness — not full PDF OCR adjudication.
3. GSM rejects empty payloads — revoke uses non-matching placeholder UID.
4. Synthetic Control C tagged for cleanup after pilot window.

## Cleanup

- Synthetic control: `cleanupTag=pi-phase1-pilot-synthetic`
- Local gitignored secrets/results only — never commit UIDs/passwords
