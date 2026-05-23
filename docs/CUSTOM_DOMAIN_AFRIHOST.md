# Custom domain: www.tenderbriefing.co.za (Afrihost + Firebase Hosting → Cloud Run)

Production Cloud Run (source of truth for Scheduler and sync):

| Field | Value |
|-------|--------|
| Service | `tenderbriefing` |
| Region | `africa-south1` |
| Project | `tenderbriefing-34679` |
| Direct URL | https://tenderbriefing-xzgs5uw5ta-bq.a.run.app |

Registered domain: **tenderbriefing.co.za** (Afrihost)  
Preferred public URL: **https://www.tenderbriefing.co.za**

Cloud Run **domain mapping** is not available in `africa-south1`. Use **Firebase Hosting** to terminate TLS and proxy all paths to Cloud Run.

---

## Architecture

Firebase Hosting **cannot** rewrite to Cloud Run in `africa-south1` (API error: region not supported). Production stays in Johannesburg; Hosting uses a thin **edge proxy** in `europe-west1` that forwards to the real service.

```text
Browser → www.tenderbriefing.co.za (DNS → Firebase Hosting)
       → rewrite ** → Cloud Run tenderbriefing-hosting-proxy (europe-west1)
       → forwards HTTPS → tenderbriefing (africa-south1)
       → Firestore / APIs / Next.js

Cloud Scheduler → Cloud Run africa-south1 URL directly (unchanged)
```

| Service | Region | Role |
|---------|--------|------|
| `tenderbriefing` | `africa-south1` | Production app (source of truth) |
| `tenderbriefing-hosting-proxy` | `europe-west1` | Firebase Hosting rewrite target only |

Redeploy proxy after changing production URL:

```bash
gcloud builds submit --config cloudbuild-hosting-proxy.yaml \
  --project=tenderbriefing-34679 --region=europe-west1
```

`firebase.json` hosting config:

```json
{
  "hosting": {
    "public": "public",
    "rewrites": [
      {
        "source": "**",
        "run": {
          "serviceId": "tenderbriefing-hosting-proxy",
          "region": "europe-west1"
        }
      }
    ]
  }
}
```

The `public/` folder only holds a minimal `index.html` fallback; the live app is served from Cloud Run via rewrites.

---

## Phase 1 — Deploy edge proxy + Firebase Hosting

```bash
cd "/Users/billionaire/Desktop/Tender briefing"

# 1) Edge proxy (europe-west1 → africa-south1 production URL)
gcloud builds submit --config cloudbuild-hosting-proxy.yaml \
  --project=tenderbriefing-34679 --region=europe-west1

# 2) Hosting rewrites to the proxy
firebase login
firebase use tenderbriefing-34679
firebase deploy --only hosting --project tenderbriefing-34679
```

**Deploy status (2026-05-23):** Hosting deploy succeeded.  
**Hosting URL:** https://tenderbriefing-34679.web.app  
**Proxy service:** `tenderbriefing-hosting-proxy` in `europe-west1`

Default Firebase Hosting URLs (always use console for current values):

| URL | Purpose |
|-----|---------|
| https://tenderbriefing-34679.web.app | Primary Hosting URL |
| https://tenderbriefing-34679.firebaseapp.com | Alternate Hosting URL |

Verify proxy after deploy:

```bash
curl -sS -o /dev/null -w "%{http_code}" https://tenderbriefing-34679.web.app/
curl -sS https://tenderbriefing-34679.web.app/api/sync/status
curl -sS -o /dev/null -w "%{http_code}" https://tenderbriefing-34679.web.app/tenders
```

Expect HTTP 200 (or 307 to sign-in) and JSON from `/api/sync/status`.

---

## Phase 2 — Add custom domain in Firebase Console

1. Open [Firebase Console → Hosting](https://console.firebase.google.com/project/tenderbriefing-34679/hosting)
2. **Add custom domain**
3. Enter: `www.tenderbriefing.co.za`
4. Copy **exact** DNS records from the wizard (do not use generic examples below until you compare)

### Afrihost DNS instruction table (fill from Firebase wizard)

After Firebase shows records, complete this table and apply in **ClientZone → Domains → tenderbriefing.co.za → DNS Management**:

| Host / Name | Type | Value | TTL | Action |
|-------------|------|-------|-----|--------|
| _(from Firebase, e.g. `www`)_ | _(CNAME or A)_ | _(exact target Firebase shows)_ | 3600 (or default) | **Add** |
| _(apex if Firebase asks)_ | _(A / AAAA)_ | _(exact IPs)_ | 3600 | **Add** only if using apex on Firebase |

**Records to remove if conflicting**

| Host / Name | Why |
|-------------|-----|
| Existing `www` CNAME/A | Only one record set per host |
| Old parking / previous host A records on `@` or `www` | Prevents Firebase verification |
| Duplicate CNAME to another provider | SSL verification fails |

**Propagation**

| Stage | Typical duration |
|-------|------------------|
| DNS propagation | 15 minutes – 4 hours (up to 48h rare) |
| Firebase domain verification | After DNS resolves |
| Managed SSL certificate | 15 minutes – 24 hours after verification |

Hosting → Custom domains → status must show **Connected** and certificate **Active** before relying on HTTPS.

---

## Phase 3 — Root domain (`tenderbriefing.co.za`)

### Option A — Afrihost redirect (preferred when available)

1. Afrihost ClientZone → domain → **Redirect** or **Forwarding**
2. Redirect `http://tenderbriefing.co.za` and `https://tenderbriefing.co.za` → `https://www.tenderbriefing.co.za`
3. Keep only Firebase `www` CNAME (or records) as instructed

Pros: simple, one certificate on `www`.  
Cons: apex may not serve the app directly (redirect only).

### Option B — Apex on Firebase Hosting

1. Firebase Hosting → **Add custom domain** → `tenderbriefing.co.za`
2. Add **only** the A / AAAA records Firebase displays for apex
3. Do not guess IPs — use console output

Pros: apex serves the same Hosting → Cloud Run stack.  
Cons: more DNS records; must not conflict with Afrihost mail (MX) records.

**Keep MX and SPF** for email if you use Afrihost mail on the same zone.

---

## Phase 4 — Firebase Authentication authorized domains

1. [Authentication → Settings → Authorized domains](https://console.firebase.google.com/project/tenderbriefing-34679/authentication/settings)
2. **Add domain:**
   - `www.tenderbriefing.co.za`
   - `tenderbriefing.co.za`
3. **Keep** (do not remove):
   - `localhost`
   - `tenderbriefing-34679.firebaseapp.com`
   - `tenderbriefing-34679.web.app`
   - `tenderbriefing-xzgs5uw5ta-bq.a.run.app` (if listed or add for direct Run testing)

Without this, browser sign-in returns `auth/unauthorized-domain` on the custom hostname.

---

## Phase 5 — SEO / environment

`NEXT_PUBLIC_SITE_URL=https://www.tenderbriefing.co.za` is set in:

- `env.example`
- `.env.local.example`
- `cloudbuild.yaml` (Cloud Run deploy)
- `app/layout.tsx` and `app/sitemap.ts` (fallback default)

Optional explicit Cloud Run env update:

```bash
gcloud run services update tenderbriefing \
  --region=africa-south1 \
  --project=tenderbriefing-34679 \
  --update-env-vars=NEXT_PUBLIC_SITE_URL=https://www.tenderbriefing.co.za
```

Redeploy via Cloud Build if you change build-time public env vars.

---

## Phase 6 — What not to change

- Cloud Scheduler jobs should keep targeting the **Cloud Run URL** (or internal path) unless you deliberately test Hosting
- Firestore sync, OCDS pipeline, and backend logic stay on Cloud Run
- Firebase Hosting is a **proxy**, not a static export of the Next app

---

## Verification checklist

| Check | URL |
|-------|-----|
| Hosting home | https://tenderbriefing-34679.web.app/ |
| Hosting tenders | https://tenderbriefing-34679.web.app/tenders |
| Hosting API | https://tenderbriefing-34679.web.app/api/sync/status |
| Cloud Run direct | https://tenderbriefing-xzgs5uw5ta-bq.a.run.app/tenders |
| Custom domain (after DNS) | https://www.tenderbriefing.co.za/tenders |

DNS debug:

```bash
dig www.tenderbriefing.co.za CNAME +short
dig tenderbriefing.co.za A +short
```

---

## Related documentation

- `docs/SECURITY_ROTATION_CHECKLIST.md` — rotate credentials after git exposure
- `docs/CI_CD_SETUP.md` — GitHub Actions when PAT has `workflow` scope
- `docs/GITHUB_PUSH.md` — repository remote and push notes
