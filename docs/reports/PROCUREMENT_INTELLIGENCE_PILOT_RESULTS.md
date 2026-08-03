# Procurement Intelligence Phase 1 — Authenticated Pilot Results

**Verdict:** PASS WITH CONDITIONS  
**Finished UTC:** 2026-08-03T13:17:01Z  
**SAST:** 2026-08-03T15:17:01+02:00

## Runtime (final)

| Field | Value |
|-------|--------|
| Code SHA | `a6d2b922e634efc64e8ebe1b5886f4b46006a087` |
| Tag | `pi-pilot-rules-a6d2b92` |
| Deploy workflow | [30814718880](https://github.com/tenderbriefing/tender/actions/runs/30814718880) |
| Build ID | `04107842-040e-4bc0-980f-fdd1bc2d4d04` |
| Revision | `tenderbriefing-00096-h4h` @ 100% |
| Image digest | `sha256:853b9d5e003f60c7a6f02295a520b031132254032c43ebd4b19642c24e1954d5` |
| Server / client flags | both `false` |
| Pilot UID source | GSM `procurement-intelligence-pilot-uids` |
| Pilot UID count | **2** |
| Prior pilot app SHA | `3c177dd` (PR #10 flags-false allow-list) |
| Rules fix | PR #11 — SME own-read on progress docs |

## Identities (masked)

| Role | Account | UID mask | Source |
|------|---------|----------|--------|
| Pilot A | ops-smoke-admin@… | `DT64…ag53` | existing internal QA |
| Pilot B | ops-smoke-sme@… | `dGkf…s9e2` | existing SME QA |
| Control C | ops-smoke-sme-control@… | `p0ox…z2P2` | synthetic (`cleanupTag=pi-phase1-pilot-synthetic`) |

Auth for certification: Firebase Admin **custom token** → Identity Toolkit (no passwords logged).

## Acceptance (post-final deploy)

| Gate | Result |
|------|--------|
| `/api/health/firestore` | **200** ok (retry after transient curl reset) |
| Unauth PI API | **401** |
| Pilot B API (8 tenders) | **8/8** HTTP 200 |
| Control C API | **8/8** HTTP 403 |
| Fact-check pass rate | **88.9%** |
| API latency | avg **2392** ms · p50 **2446** · p95 **4201** |
| Revoke drill (on `3c177dd` image) | 200 → **403** ~5.3s (`00094-2rr`) |
| Restore drill | 403 → **200** ~8.9s (`00095-g97`); control stayed 403 |
| Flags during revoke | both remained `false` |

## Residuals

1. Full production Playwright browser UI / Google IdP / a11y matrix not re-executed (API-authenticated path certified).
2. Pilot B `emailVerified=false` in Auth.
3. Fact harness is structural (safe language + field presence), not full issuer-PDF adjudication.
4. GSM rejects empty payloads — revoke uses non-matching placeholder UID.
5. One post-deploy health curl saw `Recv failure: Connection reset by peer`; subsequent checks **200**.

## Cleanup

Synthetic control tagged `pi-phase1-pilot-synthetic`. Local gitignored `.qa-pi-*` artifacts hold raw evidence (no commit of UIDs/tokens).
