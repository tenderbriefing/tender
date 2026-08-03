# Environment Variables — Tender Briefing

Never commit real secret values. Rotate via Google Secret Manager / hosting env.

| Name | Purpose | Required | Secret? | Format | Owner | Failure impact |
|------|---------|----------|---------|--------|-------|----------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase web | prod | No | string | Frontend | Auth broken |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase web | prod | No | domain | Frontend | Auth broken |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase web / JWT aud | prod | No | project id | Platform | Auth/API broken |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Storage | prod | No | bucket | Frontend | Uploads fail |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | FCM | prod | No | id | Frontend | Push degraded |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase web | prod | No | id | Frontend | Auth broken |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | Analytics | optional | No | G-… | Frontend | Analytics off |
| `NEXT_PUBLIC_SITE_URL` | Canonical site / PayFast URLs | prod | No | URL | Platform | Wrong return URLs |
| `NEXT_PUBLIC_ATTENDANCE_FEE_LABEL` | Display fee label | optional | No | string | Product | Label drift |
| `ATTENDANCE_FEE_CENTS` | Server charge amount | optional (defaults 24900) | No | int cents | Payments | Wrong fee if mis-set |
| `PAYFAST_MERCHANT_ID` | PayFast merchant | prod payments | Yes | string | Payments | Checkout fails |
| `PAYFAST_MERCHANT_KEY` | PayFast key | prod payments | Yes | string | Payments | Checkout fails |
| `PAYFAST_PASSPHRASE` | ITN/signature | prod payments | Yes | string | Payments | ITN reject |
| `PAYFAST_SANDBOX` | Sandbox mode | optional | No | true/false | Payments | Wrong PayFast host |
| `WHATSAPP_WEBHOOK_ENABLED` | Enable WhatsApp webhook | optional | No | true/false | Comms | 503 in prod if false |
| `WHATSAPP_VERIFY_TOKEN` | Meta verify | if WhatsApp on | Yes | string | Comms | Verify fails |
| `WHATSAPP_APP_SECRET` | HMAC signature | prod WhatsApp | Yes | string | Comms | Unsigned rejected |
| `SYNC_SECRET` | Sync/automation auth | ops | Yes | string | Ops | Sync denied |
| `SMOKE_TEST_PASSWORD` | Smoke scripts | CI/smoke only | Yes | string | QA | Smoke cannot run |
| `FOUNDER_USER_INTELLIGENCE_ENABLED` | Founder UI flag | optional | No | true/false | Founder | Feature hidden |
| `PROCUREMENT_INTELLIGENCE_ENABLED` | Server gate for PI Phase 1 API | optional (default false) | No | true/false | Product/Platform | API 503 when false |
| `NEXT_PUBLIC_PROCUREMENT_INTELLIGENCE_ENABLED` | Client UI panel visibility (build-time) | optional (default false) | No | true/false | Product | Panel hidden when false |
| `PROCUREMENT_INTELLIGENCE_PILOT_UIDS` | Comma-separated approved SME Firebase Auth UIDs; empty = deny-all | optional | Prefer secret | uid,uid | Product/Ops | SME PI forbidden when empty |

Pilot enablement procedure: `docs/runbooks/PROCUREMENT_INTELLIGENCE_FLAGS.md`.

## Rotation

1. Create new secret version in Secret Manager.
2. Update Cloud Run / Cloud Build mount.
3. Redeploy.
4. Invalidate old version after smoke pass.
