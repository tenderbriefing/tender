# Firebase Hosting setup report

Project: `tenderbriefing-34679`  
Date: 2026-05-23

---

## Summary

| Item | Status |
|------|--------|
| `firebase.json` with `public: public` | Done |
| Cloud Run rewrite via Hosting | Done (via `europe-west1` proxy) |
| Direct rewrite to `africa-south1` | **Not supported** by Firebase Hosting API |
| `firebase deploy --only hosting` | **Success** |
| Custom domain DNS | **Pending** — add in Firebase Console, then Afrihost |

---

## Hosting URLs

| URL | Purpose |
|-----|---------|
| https://tenderbriefing-34679.web.app | Primary Firebase Hosting URL |
| https://tenderbriefing-34679.firebaseapp.com | Alternate Hosting URL |
| https://tenderbriefing-xzgs5uw5ta-bq.a.run.app | Production Cloud Run (Scheduler / ops) |
| https://tenderbriefing-hosting-proxy-xzgs5uw5ta-ew.a.run.app | Edge proxy (Hosting rewrite target) |

---

## Why europe-west1 proxy?

Deploy error when targeting `africa-south1` directly:

```text
Cloud Run region `africa-south1` is not supported.
```

Production remains in `africa-south1`. The proxy (`hosting-proxy/server.js`) forwards all requests to the production `*.run.app` URL. See `cloudbuild-hosting-proxy.yaml`.

---

## Verification (run on your Mac)

```bash
HOST=https://tenderbriefing-34679.web.app
RUN=https://tenderbriefing-xzgs5uw5ta-bq.a.run.app

curl -sS -o /dev/null -w "Hosting / -> %{http_code}\n" "$HOST/"
curl -sS -o /dev/null -w "Hosting /tenders -> %{http_code}\n" "$HOST/tenders"
curl -sS "$HOST/api/sync/status"

curl -sS -o /dev/null -w "Cloud Run /tenders -> %{http_code}\n" "$RUN/tenders"
```

Expect HTTP 200 (or 307 to auth) and JSON from `/api/sync/status`.

---

## Custom domain — DNS (fill from Firebase Console)

1. [Firebase Hosting → Add custom domain](https://console.firebase.google.com/project/tenderbriefing-34679/hosting)
2. Enter `www.tenderbriefing.co.za`
3. Copy **exact** records into Afrihost ClientZone

| Host / Name | Type | Value | TTL | Action |
|-------------|------|-------|-----|--------|
| _(from Firebase wizard)_ | _(CNAME or A)_ | _(exact value)_ | 3600 | Add |
| Conflicting old `www` records | — | — | — | Remove |

**Do not** use generic examples until they match the wizard.

| Stage | Typical time |
|-------|----------------|
| DNS propagation | 15 min – 4 h |
| SSL active | 15 min – 24 h after DNS |

---

## Root domain

**Preferred:** Afrihost redirect `tenderbriefing.co.za` → `https://www.tenderbriefing.co.za`

**Alternative:** Add apex in Firebase Hosting and use Firebase-provided A/AAAA records only.

---

## Firebase Auth authorized domains

[Authentication → Settings → Authorized domains](https://console.firebase.google.com/project/tenderbriefing-34679/authentication/settings)

Add:

- `www.tenderbriefing.co.za`
- `tenderbriefing.co.za`

Keep: `localhost`, `tenderbriefing-34679.firebaseapp.com`, `tenderbriefing-34679.web.app`, Cloud Run hostname if used for testing.

---

## SEO / env

`NEXT_PUBLIC_SITE_URL=https://www.tenderbriefing.co.za` in:

- `env.example`, `.env.local.example`
- `cloudbuild.yaml`
- `app/layout.tsx`, `app/sitemap.ts`

---

## Related docs

- `docs/CUSTOM_DOMAIN_AFRIHOST.md` — Afrihost + architecture
- `docs/SECURITY_ROTATION_CHECKLIST.md` — credential rotation
- `docs/CI_CD_SETUP.md` — GitHub Actions when PAT has `workflow` scope

---

## Remaining actions

1. Add custom domain in Firebase Console and configure Afrihost DNS
2. Add Auth authorized domains
3. Run verification curls locally
4. Confirm Cloud Scheduler still targets **africa-south1** Cloud Run URL (not Hosting)
5. Rotate credentials per security checklist
6. Optional: enable GitHub Actions workflow (`docs/CI_CD_SETUP.md`)
