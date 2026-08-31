# Engineering Constitution — Tender Briefing

## Purpose

This constitution is the authoritative engineering contract for Tender Briefing. All contributors and automated agents must follow it.

## Architectural principles

1. **One capability, one implementation.** No parallel payment providers, auth stacks, booking lifecycles, or config systems.
2. **Server-authoritative.** Clients never set roles, prices, payment status, assignment, or tenant identity.
3. **Fail closed.** Uncertain identity, permissions, config, or validation → deny.
4. **Preserve validated journeys.** Tenders → Book an agent → attendance request → PayFast R349 → dispatch → `/sme/requests`.
5. **Evidence before change.** Inventory callers, add regression tests, smallest safe change, verify, record.
6. **Zero silent failure.** Critical paths emit structured logs and safe user errors.
7. **Controlled complexity.** No abstractions without ≥2 real use cases. No speculative frameworks.

## Security rules

- Validate authn/authz on every protected server boundary.
- Enforce ownership and role server-side and in Firestore rules.
- Never trust client IDs, roles, amounts, or payment success redirects.
- PayFast ITN (signature + validate + amount + merchant + idempotency) is the only payment truth.
- Secrets live in Secret Manager / env — never in source, logs, or client bundles.
- Webhooks must verify authenticity or fail closed in production.

## Multi-tenant rules

- Treat each SME as a tenant boundary (`smeId` / `auth.uid`).
- Agents only access assigned or notified requests.
- Admins are privileged and audited.
- Cross-tenant reads/writes are defects (P0).

## API standards

- Classify endpoints: public | authenticated | SME | agent | admin | webhook | internal | retired.
- Use typed validation for inputs.
- Standard error shape: `{ error: { code, message, requestId? } }` (migrate incrementally; do not break existing clients silently).
- Retired APIs return intentional **410** (or production 404 via policy) and remain documented.
- Rate-limit abuse-sensitive routes; document in-memory limits as best-effort on multi-instance runtimes.

## Data standards

- Privileged fields are server-only (payment, assignment, roles, verification, founder flags).
- Prefer ISO-8601 timestamps and immutable audit appends.
- Lifecycle transitions go through authoritative transition functions.

## Payment standards

- Sole provider: **PayFast**.
- Fee: **R349.00** (`34900` cents).
- Amount calculated server-side only.
- Client return/cancel URLs are UX only — never mark paid from redirects alone.

## Testing requirements

- Unit tests for validators, signatures, lifecycles, ACL helpers, config.
- Integration / emulator tests for Firestore rules and critical APIs where feasible.
- CI must gate typecheck, lint, unit tests, and build before merge confidence.
- Never weaken tests to pass.

## Observability

- Structured logs for auth, payment, ITN, attendance transitions, PDF access, admin actions.
- Never log secrets, full tokens, passphrases, or unnecessary PII.

## Deployment controls

- No automatic production deploy from unverified local trees in this programme.
- Deploy only from CI-tested commits matching the release SHA.
- Rollback instructions required for every production release.

## Dependency governance

- Justify every new dependency in the PR/ADR.
- Prefer platform-native solutions.
- Upgrade incrementally with release-note review; no blind majors.

## Documentation

- Architecture, env vars, runbooks, and ADRs must match production reality.
- Remove obsolete TenderConnect / Stripe / Yoco product claims from docs.
