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

## 4. Push notifications (retired)

**Status:** **Retired** (Batch C, 2026-08). Do not configure FCM for TenderBriefing.

| Item | Value |
|------|--------|
| **Supported channels** | In-app inbox, Resend email, WhatsApp (fail-closed) |
| **Legacy routes** | `POST /api/push-notifications/send`, `POST /api/push-notifications/subscribe`, `POST /api/push/register-token` → **410 Gone** (`PUSH_NOTIFICATIONS_RETIRED`) |
| **Historical data** | `users/{uid}.deviceTokens` may exist — **read-only**; no new writes |
| **Doc** | `docs/operations/PUSH_NOTIFICATIONS_RETIRED.md` |

---

## 5. PayFast Payments

**Purpose:** R349.00 ZAR attendance support fee when an SME requests Youth Agent attendance at a compulsory briefing. Requests stay hidden from agents until `paymentStatus` is `paid`.

| Item | Value |
|------|--------|
| **Env** | `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY / PAYFAST_PASSPHRASE`, `NEXT_PUBLIC_ATTENDANCE_FEE_CENTS` (default `34900`), `NEXT_PUBLIC_ATTENDANCE_FEE_LABEL` (default `R349.00`) |
| **Secret Manager** | `payfast-merchant-id`, `payfast-passphrase` |
| **Service** | `backend/services/integrations/payfastService.js`, `backend/services/payments/attendancePaymentService.js` |
| **API** | `POST /api/payments/payfast/create-checkout`, `POST /api/payments/payfast/confirm` |
| **Webhook** | `POST /api/webhooks/payfast` → `https://www.tenderbriefing.co.za/api/webhooks/payfast` |

**Credentials:** [PayFast Dashboard](https://www.payfast.com/) → Developers → API keys (test or live).

**Flow:** SME submits request → `paymentStatus: pending` → redirect to PayFast hosted checkout → webhook or return URL sets `paid` → agents notified.

**CSP:** Hosted checkout POSTs to `www.payfast.co.za` / `sandbox.payfast.co.za`, then PayFast redirects to `payment.payfast.io`. Chrome enforces `form-action` across that redirect chain — `next.config.js` must allow exact `https://payment.payfast.io` or checkout appears to “do nothing” after the continuing-payment toast.

**Full setup:** [PAYFAST_PAYMENTS_SETUP.md](./PAYFAST_PAYMENTS_SETUP.md)

**Methods:** `createCheckout()`, `getCheckout()`, webhook signature verification

If `PAYFAST_MERCHANT_ID` is missing, checkout APIs return `503` with `PAYFAST_NOT_CONFIGURED` (app does not crash).

---

## 5b. Resend (welcome emails)

**Purpose:** One-time welcome emails after SME / Youth Agent registration.

| Item | Value |
|------|--------|
| **Env** | `RESEND_API_KEY` (required to send), `RESEND_FROM_EMAIL` (optional plain env) |
| **Secret Manager** | `Resend_API` → Cloud Run env `RESEND_API_KEY` via `cloudbuild.yaml` |
| **Service** | `lib/services/welcomeEmail.ts` |
| **API** | `POST /api/auth/welcome-email` |

**Credentials:** [Resend](https://resend.com/) → API Keys. Verify `tenderbriefing.co.za`.

**Production:** Existing GSM secret is named `Resend_API` (exact casing). Grant the Cloud Run SA accessor and redeploy:

```bash
bash scripts/resend-secret-manager-setup.sh
gcloud builds submit --config cloudbuild.yaml \
  --project=tenderbriefing-34679 --region=africa-south1
```

If `RESEND_API_KEY` is missing, welcome send is skipped with a warning — registration still succeeds.

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

**Purpose:** Site ownership verification and search performance (HTML meta tag only — no Indexing API credentials in this repository).

| Item | Value |
|------|--------|
| **Env** | `GOOGLE_SITE_VERIFICATION` (meta tag `content` value only) |
| **App** | `app/layout.tsx` → `metadata.verification.google` |

**Setup:** [Search Console](https://search.google.com/search-console) → Add property → HTML tag method → copy content value into env → redeploy.

**Re-index / sitemap:** There is **no** authorised Google Indexing API or Search Console API client in this repo. After SEO-affecting deploys, request indexing and (re)submit `https://www.tenderbriefing.co.za/sitemap.xml` manually in Search Console.

---

## 8. OpenAI API

**Purpose:** Tender and briefing summaries (optional; rule-based fallback).

| Item | Value |
|------|--------|
| **Env** | `OPENAI_API_KEY`, `OPENAI_MODEL` (default `gpt-4o-mini`) |
| **Secret Manager** | `Open_ai_Secret_Key` (mounted as env `OPENAI_API_KEY`) |
| **Service** | `backend/services/integrations/openaiService.js` |
| **Existing** | `backend/services/aiSummaryService.js` (pipeline) |

**Scripts:** `node scripts/save-openai-key.js` (reads `OPENAI_API_KEY` from env only).

**Methods:** `summarizeTender()`, `summarizeBriefingReport()`, prompt templates in `PROMPTS`

---

## 8b. Speechmatics Batch (briefing STT)

**Purpose:** Sole briefing audio transcription provider. Report extraction / meeting minutes still use OpenAI when enabled.

| Item | Value |
|------|--------|
| **Env** | `SPEECHMATICS_API_KEY`, optional `SPEECHMATICS_API_URL`, `SPEECHMATICS_LANGUAGE`, `SPEECHMATICS_OPERATING_POINT` |
| **Provider flag** | `BRIEFING_INTELLIGENCE_PROVIDER=speechmatics` (default; only `speechmatics` or `mock` allowed) |
| **Secret Manager** | `Speechmatic_api` (mounted as `SPEECHMATICS_API_KEY`) |
| **Service** | `lib/briefing-intelligence/speechmaticsTranscriptionProvider.ts` |

**Scripts:** `SPEECHMATICS_API_KEY=... node scripts/save-speechmatics-key.js`

**Whisper:** Retired — `BRIEFING_INTELLIGENCE_PROVIDER=openai|whisper` fails loudly. See `docs/reports/WHISPER_TRANSCRIPTION_RETIREMENT.md`.

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
| `Open_ai_Secret_Key` | `OPENAI_API_KEY` |
| `google-maps-api-key` | `GOOGLE_MAPS_API_KEY` |
| `gmail-client-secret` | (existing Gmail integration) |
| `payfast-merchant-id` | `PAYFAST_MERCHANT_ID` |
| `payfast-passphrase` | `PAYFAST_MERCHANT_KEY / PAYFAST_PASSPHRASE` |
| `Resend_API` | `RESEND_API_KEY` |

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
  payfastService.js
  analyticsService.js
  openaiService.js
  calendarService.js
  microsoftGraphService.js
backend/services/integrationHealthService.js
app/api/integrations/health/route.ts
app/api/webhooks/whatsapp/route.ts
app/api/webhooks/payfast/route.ts
app/admin/integrations/page.tsx
components/admin/IntegrationsDashboard.tsx
```
