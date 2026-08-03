# Procurement Intelligence — Feature flag & pilot runbook

## Source of truth

| Concern | Authoritative control |
|---------|----------------------|
| Global enable | Cloud Run env `PROCUREMENT_INTELLIGENCE_ENABLED` (server) |
| Client UI visibility | `NEXT_PUBLIC_PROCUREMENT_INTELLIGENCE_ENABLED` (build/runtime) |
| Pilot allow-list | `PROCUREMENT_INTELLIGENCE_PILOT_UIDS` (comma-separated Firebase Auth UIDs) |
| Emergency kill switch | Set both enable flags to `false` (no redeploy required if env update applied) |
| Percentage rollout | **Not supported — do not add** |
| Authorization | Server API + Firestore rules; do not trust client flags alone |

Code: `lib/procurement/intelligence/featureFlag.ts`, `app/api/procurement/intelligence/[tenderId]/route.ts`.

## Fail-closed rules

- Flags default / production pin: **disabled**.
- Empty `PROCUREMENT_INTELLIGENCE_PILOT_UIDS` ⇒ **deny all SME** access even if enabled.
- Unauthenticated requests ⇒ **401**.
- Never invent pilot UIDs.

## Activate approved pilots (manual)

1. Confirm UIDs from Firebase Auth (approved operators only).
2. Update Cloud Run service env (or Secret Manager binding) for `PROCUREMENT_INTELLIGENCE_PILOT_UIDS`.
3. Set `PROCUREMENT_INTELLIGENCE_ENABLED=true`.
4. Set `NEXT_PUBLIC_PROCUREMENT_INTELLIGENCE_ENABLED=true` only if the panel should render (may require rebuild if baked at image build).
5. Verify: pilot sees panel; non-pilot denied; API deny for non-allow-listed UIDs.
6. Record change in `docs/releases/REGISTRY.md` and re-run pilot certification.

## Deactivate

1. Clear pilot list and/or set enable flags to `false`.
2. Confirm API returns fail-closed for former pilots.
3. Optional: full platform rollback via `docs/runbooks/ROLLBACK.md` to `enterprise-v1.0.0`.
