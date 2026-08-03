# Procurement Intelligence Phase 1 — Authenticated Pilot Results

**Verdict:** PASS WITH CONDITIONS  
**Finished UTC:** 2026-08-03T12:30:26Z  
**SAST:** 2026-08-03T14:30:26+02:00

## Runtime

| Field | Value |
|-------|--------|
| Code SHA | `3c177dd73595f3325672626603dbae4e06fd2063` |
| Tag | `pi-pilot-3c177dd` |
| Deploy workflow | [30812294505](https://github.com/tenderbriefing/tender/actions/runs/30812294505) |
| CI | [30812281032](https://github.com/tenderbriefing/tender/actions/runs/30812281032) success |
| Build ID | `9625b2fd-aefc-474e-bdbc-007117841557` |
| Final revision | `tenderbriefing-00095-g97` @ 100% |
| Image digest | `sha256:fd66ab379a202aec3f182a0479f3eae96b073c8bcef21d7f29532a079627b866` |
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

Auth method used for certification: Firebase Admin **custom token** → Identity Toolkit exchange (no passwords in logs).

## Acceptance summary

| Gate | Result |
|------|--------|
| Unauth PI API | 401 |
| Pilot B API (8 tenders) | **8/8** HTTP 200 |
| Control C API | **8/8** HTTP 403 |
| Forged bearer | 401 |
| Structured-fact checks | **88.9%** pass rate |
| Checklist progress write (pilot) | PASS |
| Control denied while pilot progress exists | PASS (403) |
| Revoke (placeholder UID secret) | 200 → **403** in ~5.3s (`tenderbriefing-00094-2rr`) |
| Restore (2 UID secret) | 403 → **200** in ~8.9s (`tenderbriefing-00095-g97`) |
| Flags during revoke | both remained `false` |
| Control after restore | still 403 |
| API latency (pilot sample) | avg **2738** ms · p50 **2595** · p95 **3511** |

## Residuals

1. Full browser UI / Google IdP / keyboard a11y matrix not re-run as Playwright against production (API-authenticated path certified).
2. Pilot B emailVerified=false in Auth (still usable via custom token / password flows).
3. Fact-check harness is structural (fields + safe eligibility language), not full PDF OCR vs issuer document adjudication.
4. Eligibility labels are machine enums (e.g. `likely_ineligible`); UI copy must remain non-definitive.
5. GSM rejects empty payloads — revoke uses non-matching placeholder UID then restore real list.

## Cleanup

- Synthetic control account tagged `pi-phase1-pilot-synthetic`.
- Local gitignored: `.qa-pi-pilot-uids.secret`, `.qa-pi-pilot-identity-registry.json`, `.qa-pi-pilot-cert-results.json`, `.qa-pi-revoke-restore.json`.
