# Google Secret Manager Setup Guide

## Step 1: Enable Secret Manager API

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/library/secretmanager.googleapis.com?project=tenderbriefing-472813)
2. Click "Enable" to enable the Secret Manager API

## Step 2: Set up IAM Permissions

1. Go to [IAM & Admin](https://console.cloud.google.com/iam-admin/iam?project=tenderbriefing-472813)
2. Find your service account: `tenderbriefing@tenderbriefing-472813.iam.gserviceaccount.com`
3. Click the edit (pencil) icon
4. Add these roles:
   - **Secret Manager Admin** (for creating secrets)
   - **Secret Manager Secret Accessor** (for reading secrets)

## Step 3: Create Secrets Manually

Go to [Secret Manager](https://console.cloud.google.com/security/secret-manager?project=tenderbriefing-472813) and create these secrets:

### Firebase Configuration
- **firebase-api-key**: `YOUR_FIREBASE_API_KEY`
- **firebase-auth-domain**: `tenderbriefing-15d91.firebaseapp.com`
- **firebase-project-id**: `tenderbriefing-15d91`
- **firebase-storage-bucket**: `tenderbriefing-15d91.firebasestorage.app`
- **firebase-messaging-sender-id**: `812914997499`
- **firebase-app-id**: `1:812914997499:web:651a2217f574e8be05d85e`
- **firebase-measurement-id**: `G-1GXKBNS6PG`

### Google Calendar API
- **google-calendar-client-email**: `tenderbriefing@tenderbriefing-472813.iam.gserviceaccount.com`
- **google-calendar-private-key**: (The full private key from your service account)
- **google-calendar-project-id**: `tenderbriefing-472813`
- **google-calendar-client-id**: `116833974948051371357`

### Google Maps API
- **google-maps-api-key**: `YOUR_GOOGLE_MAPS_API_KEY`

### Google Cloud Storage
- **google-cloud-project-id**: `tenderbriefing-472813`
- **google-cloud-storage-bucket**: `tenderbriefing`

### Google Drive API
- **google-drive-api-key**: `dbc96530b2529d5442cf5bb059124031635b46a7`

### Gmail API
- **gmail-api-key**: `dbc96530b2529d5442cf5bb059124031635b46a7`
- **gmail-client-id**: `YOUR_GMAIL_CLIENT_ID.apps.googleusercontent.com`
- **gmail-client-secret**: `YOUR_GMAIL_CLIENT_SECRET`

### eTenders API
- **etenders-api-endpoint**: `https://www.etenders.gov.za/Home/PaginatedTenderOpportunities`
- **etenders-api-headers**: `{"accept":"application/json, text/javascript, */*; q=0.01","accept-language":"en","content-type":"application/json; charset=utf-8","sec-ch-ua":"\"Chromium\";v=\"140\", \"Not=A?Brand\";v=\"24\", \"Google Chrome\";v=\"140\"","sec-ch-ua-mobile":"?0","sec-ch-ua-platform":"\"Windows\"","sec-fetch-dest":"empty","sec-fetch-mode":"cors","sec-fetch-site":"same-origin","x-requested-with":"XMLHttpRequest"}`

### Stripe (Add your actual keys)
- **stripe-publishable-key**: `pk_test_your_stripe_publishable_key_here`
- **stripe-secret-key**: `sk_test_your_stripe_secret_key_here`

### Admin
- **admin-email**: `admin@tenderconnect.co.za`

## Step 4: Test the Setup

After creating all secrets, run:
```bash
node scripts/setup-secrets.js
```

This should now work without permission errors.

## Alternative: Use Environment Variables

If you prefer to use environment variables instead of Secret Manager, create a `.env.local` file with all the above values.
