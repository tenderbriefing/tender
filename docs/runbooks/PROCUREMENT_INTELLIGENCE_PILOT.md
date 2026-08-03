# Procurement Intelligence — Pilot activation notes

## Preferred posture (Phase 1 authenticated pilot)

- Keep **both** global flags `false`.
- Grant access only via `PROCUREMENT_INTELLIGENCE_PILOT_UIDS` (GSM secret `procurement-intelligence-pilot-uids`).
- UI: SME panel probes the API; shows on **200** for allow-listed users even when `NEXT_PUBLIC_…=false`.

## Identities (masked)

| Role | Account | UID mask | Type |
|------|---------|----------|------|
| Pilot A | ops-smoke-admin@… | `DT64…ag53` | admin / internal QA |
| Pilot B | ops-smoke-sme@… | `dGkf…s9e2` | SME QA |
| Control C | ops-smoke-sme-control@… | `p0ox…z2P2` | synthetic SME (not on allow-list) |

Control C tagged `cleanupTag=pi-phase1-pilot-synthetic` for later cleanup.

## Activate

See `docs/runbooks/PROCUREMENT_INTELLIGENCE_FLAGS.md`.

## Revoke / restore

1. Add empty secret version (or remove UIDs) → redeploy/restart → deny-all.
2. Restore previous secret version with Pilot A+B UIDs → redeploy/restart → pilots restored.
3. Record evidence in certification / pilot results reports (masked only).

## Rollback production app

Preserve: `enterprise-v1.0.0` / `6e65972` / `tenderbriefing-00089-zv9` / digest `sha256:ad6eeb8c8afb86c9ae1aa61d1d3100cbb2c4e7cc190a862236828bceecf898b3`.
