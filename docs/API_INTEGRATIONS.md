# TenderBriefing API integrations

Production integration modules live under `backend/services/integrations/`. Health is aggregated by `backend/services/integrationHealthService.js`.

**Rules**

- Never commit secrets (`.env.local`, `service-account.json`).
- Use environment variables locally; use [Google Secret Manager](https://console.cloud.google.com/security/secret-manager?project=tenderbriefing-34679) in production.
- Missing credentials return `status: missing` — the app does not crash.

---

## Health check

| Endpoint | Auth |
|----------|------|
| `GET /api/integrations/health` | Public (no secret values returned) |

Admin UI: `/admin/integrations`

Local test:

```bash
npm run dev
# another terminal:
npm run test:integrations
# or
curl -sS http://localhost:3000/api/integrations/health | jq '.summary,.integrations[].name,.integrations[].status'
```

---

## 1. WhatsApp Business API

**Purpose:** Notify SMEs and Youth Agents about briefing assignments and status updates.

| Item | Value |
|------|--------|
| **Env** | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_VERIFY_TOKEN` |
| **Secret Manager** | `whatsapp-access-token`, `whatsapp-phone-number-id` (optional naming) |
| **Service** | `backend/services/integrations/whatsappService.js` |
| **Webhooks** | `GET/POST /api/webhooks/whatsapp` |

**Credentials:** [Meta for Developers](https://developers.facebook.com/) → Business app → WhatsApp → API setup.

**Production:** Set webhook URL to `https://www.tenderbriefing.co.za/api/webhooks/whatsapp` (or Cloud Run URL during testing). Verify token must match `WHATSAPP_VERIFY_TOKEN`.

**Methods:** `sendTextMessage()`, `sendTemplateMessage()`

---

## 2. Firebase Storage

**Purpose:** Briefing attendance proof files (`briefing-proofs/{requestId}/`).

| Item | Value |
|------|--------|
| **Env** | `FIREBASE_STORAGE_BUCKET`, `GOOGLE_APPLICATION_CREDENTIALS`, `FIREBASE_PROJECT_ID` |
| **Client env** | `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` |
| **Service** | `backend/services/integrations/firebaseStorageService.js` |
| **Rules** | `storage.rules` (deploy after enabling Storage in console) |

**Setup**

1. Firebase Console → Storage → Get started.
2. `firebase deploy --only storage --project tenderbriefing-34679`
3. Set bucket name in env.

**Note:** Storage is optional until enabled; uploads return `skipped` without throwing.

---

## 3. Google Maps Platform

**Purpose:** Geocoding briefing venues; distance checks for Youth Agent matching (default **50 km** radius).

| Item | Value |
|------|--------|
| **Env** | `GOOGLE_MAPS_API_KEY` |
| **Secret Manager** | `google-maps-api-key` |
| **Service** | `backend/services/integrations/mapsService.js` |
| **Existing API** | `GET /api/maps?action=geocode` (TypeScript client) |

**Credentials:** GCP Console → APIs & Services → enable Geocoding API, Distance Matrix API → Credentials.

**Methods:** `geocodeAddress()`, `calculateDistance()`, `isWithinAgentRadius()`

---

## 4. Firebase Cloud Messaging (FCM)

**Purpose:** Push notifications to browser/mobile clients.

| Item | Value |
|------|--------|
| **Env** | `FCM_SERVER_KEY` (legacy) or Firebase Admin via service account |
| **Service** | `backend/services/integrations/fcmService.js` |
| **Firestore** | `users/{uid}.deviceTokens` (array of strings) |

**Setup:** Firebase Console → Project settings → Cloud Messaging. For web, set `NEXT_PUBLIC_FIREBASE_VAPID_KEY` in client config.

**Method:** `sendPushNotification({ userId, title, body, data })`

---

## 5. Yoco Payments

**Purpose:** Checkout for premium features / agent bookings (future billing flows).

| Item | Value |
|------|--------|
| **Env** | `YOCO_SECRET_KEY`, `YOCO_WEBHOOK_SECRET` |
| **Secret Manager** | `yoco-secret-key`, `yoco-webhook-secret` |
| **Service** | `backend/services/integrations/yocoService.js` |
| **Webhook** | `POST /api/webhooks/yoco` |

**Credentials:** [Yoco Dashboard](https://www.yoco.com/) → Developers → API keys.

**Methods:** `createCheckout()`, webhook signature verification

---

## 6. Google Analytics 4

**Purpose:** Product analytics for procurement funnel events.

| Item | Value |
|------|--------|
| **Env** | `NEXT_PUBLIC_GA_MEASUREMENT_ID` (e.g. `G-XXXXXXXX`) |
| **Frontend** | `lib/services/analyticsService.ts`, `lib/analytics/ga4Events.ts` |

**Events**

| Event | When |
|-------|------|
| `tender_viewed` | Tender detail viewed |
| `attendance_requested` | SME creates attendance request |
| `agent_accepted` | Youth Agent accepts request |
| `report_uploaded` | Briefing report submitted |

**Credentials:** [Google Analytics](https://analytics.google.com/) → Admin → Data streams → Web.

---

## 7. Google Search Console

**Purpose:** Site ownership verification and search performance.

| Item | Value |
|------|--------|
| **Env** | `GOOGLE_SITE_VERIFICATION` (meta tag `content` value only) |
| **App** | `app/layout.tsx` → `metadata.verification.google` |

**Setup:** [Search Console](https://search.google.com/search-console) → Add property → HTML tag method → copy content value into env → redeploy.

---

## 8. OpenAI API

**Purpose:** Tender and briefing summaries (optional; rule-based fallback).

| Item | Value |
|------|--------|
| **Env** | `OPENAI_API_KEY`, `OPENAI_MODEL` (default `gpt-4o-mini`) |
| **Secret Manager** | `openai-api-key` |
| **Service** | `backend/services/integrations/openaiService.js` |
| **Existing** | `backend/services/aiSummaryService.js` (pipeline) |

**Scripts:** `node scripts/save-openai-key.js` (reads `OPENAI_API_KEY` from env only).

**Methods:** `summarizeTender()`, `summarizeBriefingReport()`, prompt templates in `PROMPTS`

---

## 9. Google Calendar API (future)

| Item | Value |
|------|--------|
| **Env** | `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET` |
| **Service** | `backend/services/integrations/calendarService.js` |

Tender briefing dates are already exposed in-app via `backend/services/calendarService.js` (tender events). This module is for OAuth calendar sync later.

---

## 10. Microsoft Graph (future)

| Item | Value |
|------|--------|
| **Env** | `MICROSOFT_GRAPH_CLIENT_ID`, `MICROSOFT_GRAPH_CLIENT_SECRET`, `MICROSOFT_GRAPH_TENANT_ID` |
| **Service** | `backend/services/integrations/microsoftGraphService.js` |

**Credentials:** [Azure Portal](https://portal.azure.com/) → App registrations.

---

## Secret Manager mapping (recommended)

| Secret name | Env variable |
|-------------|----------------|
| `openai-api-key` | `OPENAI_API_KEY` |
| `google-maps-api-key` | `GOOGLE_MAPS_API_KEY` |
| `gmail-client-secret` | (existing Gmail integration) |
| `yoco-secret-key` | `YOCO_SECRET_KEY` |
| `yoco-webhook-secret` | `YOCO_WEBHOOK_SECRET` |

Upload from env (no hardcoded values in scripts):

```bash
export OPENAI_API_KEY=your-key
node scripts/setup-secret-manager.js
```

---

## Local development

1. Copy `.env.local.example` → `.env.local`
2. Fill only the integrations you are testing
3. `npm run dev`
4. Open `/admin/integrations` as an admin user
5. `npm run test:integrations`

---

## Production (Cloud Run)

1. Add secrets in Secret Manager or Cloud Run env vars (Console → Cloud Run → `tenderbriefing` → Edit → Variables).
2. Redeploy only when changing build-time `NEXT_PUBLIC_*` vars:

```bash
gcloud builds submit --config cloudbuild.yaml \
  --project=tenderbriefing-34679 --region=africa-south1
```

3. Hosting proxy and Scheduler are unchanged by integration scaffolding.

---

## Verification checklist

```bash
npm run build
npm run test:integrations   # with dev server running
npm run smoke:production    # Firestore + Cloud Run APIs
curl -sS https://tenderbriefing-xzgs5uw5ta-bq.a.run.app/api/integrations/health
```

Expected: most integrations `missing` until you configure them; no `500` from health endpoint.

---

## File index

```
backend/services/integrations/
  integrationConfig.js
  whatsappService.js
  firebaseStorageService.js
  mapsService.js
  fcmService.js
  yocoService.js
  analyticsService.js
  openaiService.js
  calendarService.js
  microsoftGraphService.js
backend/services/integrationHealthService.js
app/api/integrations/health/route.ts
app/api/webhooks/whatsapp/route.ts
app/api/webhooks/yoco/route.ts
app/admin/integrations/page.tsx
components/admin/IntegrationsDashboard.tsx
```
