# Security Standard — Tender Briefing

## Authentication

- Firebase ID tokens verified at edge (middleware) and Admin SDK (`verifyApiUser`) on handlers.
- Suspended / missing profile / invalid role → deny.
- Privileged roles never assigned from client input (`serverProfileBootstrap` strips elevation fields).

## Authorisation

- Role checks: `sme` | `youth-agent` | `admin`.
- Ownership: SME owns `smeId`; agents own assignment/notification scope; admins audited.
- Prefer shared helpers in `lib/security/accessControl.ts` and `verifyApiUser`.

## Tenant isolation

- SME A must never read/write SME B attendance, payments, briefings, or workspace docs.
- Agents must not access unrelated SME records.
- Firestore rules + Admin SDK paths must both enforce.

## Secrets

- Server secrets: PayFast passphrase, merchant key, Twilio tokens, sync secrets, service accounts.
- Client-safe only: `NEXT_PUBLIC_*` Firebase web config and display labels.
- No hardcoded production credentials; production Firebase config requires env (fail closed).

## Webhooks

- PayFast ITN: signature → PayFast validate → merchant → amount → idempotency.
- WhatsApp: production fail-closed unless verification configured; do not claim secure until verified.

## API validation

- Validate params/bodies; reject malformed payloads.
- Never accept client payment amounts for attendance fee.

## Rate limiting

- Edge/in-memory limiter is **best-effort** on multi-instance Cloud Run.
- Apply to public tenders, support, login-adjacent, payment creation, webhooks where practical.
- Document need for Redis/Cloud Armor for enterprise DDoS/rate control.

## Logging & PII

- Structured event logs; redact secrets and unnecessary PII.
- Audit privileged actions via append-only `auditLogs` (client write denied).

## Headers

- HSTS, CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, frame protections via `next.config.js`.

## Incident response

1. Contain (revoke tokens / disable webhook / feature-flag).
2. Preserve logs and audit events.
3. Assess blast radius (tenants, payments).
4. Remediate and rotate secrets if exposed.
5. Document timeline in ops notes.
