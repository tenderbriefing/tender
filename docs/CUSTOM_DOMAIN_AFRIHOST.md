# Custom domain: www.tenderbriefing.co.za

Production Cloud Run service (primary):

- **Service:** `tenderbriefing`
- **Region:** `africa-south1`
- **Project:** `tenderbriefing-34679`
- **Live URL:** https://tenderbriefing-xzgs5uw5ta-bq.a.run.app

Registered domain: **www.tenderbriefing.co.za** (Afrihost)

---

## Important: africa-south1 and Cloud Run domain mapping

Google’s **Cloud Run domain mapping** (preview) does **not** list `africa-south1` as a supported region. Your service runs in `africa-south1`, so you have two practical options:

| Option | Best for |
|--------|----------|
| **A. Firebase Hosting → Cloud Run rewrite** (recommended for this project) | Same Firebase project, simple DNS, managed SSL |
| **B. Global external HTTPS load balancer** | Full control, CDN, apex + www |

This guide covers **Option A** (Firebase Hosting) and **Option B** (Console domain mapping if Google enables it for your project).

---

## Option A — Firebase Hosting (recommended)

`firebase.json` is configured to proxy all traffic to Cloud Run:

```json
"rewrites": [{ "source": "**", "run": { "serviceId": "tenderbriefing", "region": "africa-south1" } }]
```

### Step 1 — Deploy Hosting configuration

```bash
cd "/Users/billionaire/Desktop/Tender briefing"
firebase login
firebase use tenderbriefing-34679
firebase deploy --only hosting --project tenderbriefing-34679
```

### Step 2 — Connect custom domain in Firebase Console

1. Open [Firebase Console → Hosting](https://console.firebase.google.com/project/tenderbriefing-34679/hosting)
2. Click **Add custom domain**
3. Enter: `www.tenderbriefing.co.za`
4. Follow the wizard — Firebase shows **exact DNS records** (do not guess)

Typical records Firebase provides (verify in console):

| Host / Name | Type | Value | TTL |
|-------------|------|-------|-----|
| `www` | CNAME | `tenderbriefing-34679.web.app` or similar Firebase target | 3600 |

For apex `tenderbriefing.co.za`, Firebase may show **A** records — use only what the console displays.

### Step 3 — Afrihost ClientZone DNS

1. Log in to [Afrihost ClientZone](https://clientzone.afrihost.com)
2. Open **Domains** → **tenderbriefing.co.za** → **DNS Management**
3. **Remove** conflicting records for `www` (old CNAME/A) if present
4. **Add** the records from Firebase Hosting (exact host, type, value)
5. Save — propagation often **15 minutes–4 hours** (up to 48h in rare cases)

### Step 4 — SSL

Firebase provisions a managed certificate after DNS propagates. Status in Hosting → Custom domains.

### Step 5 — Root domain redirect (optional)

In Afrihost, either:

- Firebase apex setup (if offered), or
- **Redirect** `tenderbriefing.co.za` → `https://www.tenderbriefing.co.za` via Afrihost redirect tool, or
- A record(s) exactly as Firebase/Google specifies for apex

---

## Option B — Cloud Run domain mapping (if available)

Only works if Google supports mapping for your project/region. Install beta CLI:

```bash
gcloud components install beta
gcloud domains list-user-verified --project=tenderbriefing-34679
gcloud domains verify tenderbriefing.co.za
```

Create mapping (no `--region` on create for fully managed — check current docs):

```bash
gcloud beta run domain-mappings create \
  --service=tenderbriefing \
  --domain=www.tenderbriefing.co.za \
  --project=tenderbriefing-34679
```

Get **exact** DNS records:

```bash
gcloud beta run domain-mappings describe \
  --domain=www.tenderbriefing.co.za \
  --project=tenderbriefing-34679
```

Use every record under `resourceRecords` in Afrihost. Common (not guaranteed):

| Host | Type | Value |
|------|------|-------|
| `www` | CNAME | `ghs.googlehosted.com` |

Apex may require **A** / **AAAA** from the describe output only.

---

## Firebase Authentication — authorized domains

After the custom domain is live:

1. [Firebase Console → Authentication → Settings → Authorized domains](https://console.firebase.google.com/project/tenderbriefing-34679/authentication/settings)
2. **Add domain:**
   - `www.tenderbriefing.co.za`
   - `tenderbriefing.co.za`
3. Keep existing:
   - `tenderbriefing-34679.firebaseapp.com`
   - `localhost` (development)

Without this, sign-in on the custom domain may fail with `auth/unauthorized-domain`.

---

## Environment variable (Cloud Run)

Set on the Cloud Run service for correct SEO/metadata:

```bash
gcloud run services update tenderbriefing \
  --region=africa-south1 \
  --project=tenderbriefing-34679 \
  --update-env-vars=NEXT_PUBLIC_SITE_URL=https://www.tenderbriefing.co.za
```

The default in code is already `https://www.tenderbriefing.co.za` if the env var is unset.

---

## Verification commands

```bash
# DNS (after Afrihost update)
dig www.tenderbriefing.co.za CNAME +short
dig tenderbriefing.co.za A +short

# Cloud Run domain mapping status (if using Option B)
gcloud beta run domain-mappings describe \
  --domain=www.tenderbriefing.co.za \
  --project=tenderbriefing-34679

# Production health (always works)
curl -sS https://tenderbriefing-xzgs5uw5ta-bq.a.run.app/api/sync/status
```

Browser:

- https://www.tenderbriefing.co.za (after DNS + SSL)
- https://tenderbriefing-xzgs5uw5ta-bq.a.run.app (fallback)

---

## Records to remove at Afrihost (if conflicting)

Remove old `www` or `@` records pointing to:

- Previous hosting provider
- Parking page IPs
- Duplicate CNAMEs for the same host

Only one CNAME per `www` host.

---

## Timeline expectations

| Step | Typical time |
|------|----------------|
| DNS propagation | 15 min – 4 hours |
| SSL certificate | 15 min – 24 hours after DNS |
| Firebase Auth domain | Immediate after save |

---

## What we did not change

- Cloud Run service name or region
- Firestore sync / Scheduler
- No secrets committed to git
