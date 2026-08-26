# Push notifications — retired

**Status:** Retired (Batch C founder decision, 2026-08)  
**Decision memo:** `docs/decisions/BATCH_C_INCOMPLETE_CAPABILITIES_DECISION.md`

## Summary

TenderBriefing **does not support push notifications**. The previous surface (501 API stubs, unwired client hooks, unused FCM config) was removed to reduce support risk and misleading UX.

## Supported notification channels

| Channel | Production path |
|---------|-----------------|
| **In-app inbox** | `notificationService.js` → Firestore notifications |
| **Email** | Resend via `transactionalEmailService` / Phase 3H lifecycle |
| **WhatsApp** | Twilio/Meta — **fail-closed** when secrets not mounted |

SMS is **not** implemented. Do not document SMS as a supported channel.

## Retired API routes

All return **410 Gone** with error code `PUSH_NOTIFICATIONS_RETIRED`:

- `POST /api/push-notifications/send`
- `POST /api/push-notifications/subscribe`
- `POST /api/push/register-token`

## Removed runtime surface

- Client hook `hooks/usePushNotifications.ts`
- `lib/services/pushNotificationService.ts`
- `backend/services/pushNotificationService.js`
- `backend/services/integrations/fcmService.js`
- PWA browser notification permission in `MobileFieldBootstrap`
- Native Expo push token acquisition in `mobile-agent-app`

## Historical Firestore data

`users/{uid}.deviceTokens` may contain legacy tokens from earlier register-token calls. **Do not delete production data** in ordinary retirement. New token writes are blocked (410 on register-token).

Optional future cleanup: migration script to archive or strip `deviceTokens` after confirming no downstream readers.

## Environment / secrets

- `FCM_SERVER_KEY` removed from env examples — not required at runtime.
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` remains part of standard Firebase web SDK config; it is **not** used for push delivery after retirement.
- Any `FCM_SERVER_KEY` or FCM secret in Google Secret Manager should be treated as **obsolete** (do not auto-delete without ops approval).

## Reviving push (out of scope)

Requires a new founder-approved product spec: FCM v1 or Expo server integration, end-to-end token registration, idempotent send path, E2E tests, and feature flag — not restoration of 501 stubs.
