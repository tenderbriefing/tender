# Security credential rotation checklist

TenderBriefing previously had credentials in local git history before a history rewrite and GitHub push. Treat any value that was ever committed as **compromised** and rotate it even if the public repo no longer contains it.

Do **not** paste real secrets into tickets, chat, or git. Use Secret Manager, `.env.local` (gitignored), and GitHub encrypted secrets only.

---

## 1. OpenAI API key

| Item | Detail |
|------|--------|
| **Where to rotate** | [OpenAI API keys](https://platform.openai.com/api-keys) — revoke old key, create new |
| **Update after rotation** | Google Secret Manager secret `openai-api-key`; local `.env.local` `OPENAI_API_KEY` |
| **Redeploy** | Cloud Run if the service reads the key from env at build/runtime; run `node scripts/save-openai-key.js` with `OPENAI_API_KEY` set (script reads from env only) |
| **Verify** | `POST /api/ai/chat` or AI test page; check Cloud Run logs for auth errors |

---

## 2. Gmail OAuth client secret

| Item | Detail |
|------|--------|
| **Where to rotate** | [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials?project=tenderbriefing-34679) — OAuth 2.0 Client ID used for Gmail |
| **Update after rotation** | Secret Manager `gmail-client-secret`; `.env.local` `GMAIL_CLIENT_SECRET`; redeploy if baked into env |
| **Redeploy** | Cloud Run service `tenderbriefing` (`africa-south1`) if env vars changed |
| **Verify** | Gmail test route or send-notification flow; no `invalid_client` in logs |

---

## 3. Firebase / Google service account key (server)

| Item | Detail |
|------|--------|
| **Where to rotate** | GCP → IAM → Service Accounts → Keys — **delete** old key, **add** new JSON key |
| **Update after rotation** | Local `service-account.json` (gitignored); Cloud Run service account attachment (prefer workload identity, no key on Run); GitHub Actions secret `FIREBASE_SERVICE_ACCOUNT` if CI is enabled |
| **Redeploy** | `gcloud builds submit --config cloudbuild.yaml --project=tenderbriefing-34679 --region=africa-south1` |
| **Verify** | `GET /api/health/firestore`; production smoke script; Firestore sync status |

---

## 4. Other Google Cloud service account keys

| Item | Detail |
|------|--------|
| **Where to rotate** | Same as §3 for any SA that appeared in old docs (`tenderbriefing-472813`, legacy Firebase projects, calendar SA, etc.) |
| **Update after rotation** | `GOOGLE_APPLICATION_CREDENTIALS` path; Secret Manager calendar/private-key secrets if used |
| **Redeploy** | Cloud Run + any Cloud Functions / Scheduler jobs using that identity |
| **Verify** | Calendar sync, Drive/Maps features if enabled |

---

## 5. Secret Manager values copied into docs or scripts

| Item | Detail |
|------|--------|
| **Where to rotate** | [Secret Manager](https://console.cloud.google.com/security/secret-manager?project=tenderbriefing-34679) — add **new version** for each exposed secret |
| **Secrets to review** | `firebase-api-key`, `gmail-client-id`, `gmail-client-secret`, `google-maps-api-key`, `openai-api-key`, any custom secrets |
| **Update after rotation** | Cloud Run env or app code that loads secrets at runtime; run `node scripts/setup-secret-manager.js` with env vars set (no hardcoded values) |
| **Verify** | `/secrets-test` (dev only), maps/Gmail features in staging |

---

## 6. GitHub personal access token (PAT)

| Item | Detail |
|------|--------|
| **Where to rotate** | GitHub → Settings → Developer settings → Personal access tokens — revoke old, create new with required scopes |
| **Scopes needed for CI** | `repo`, `workflow` (to push `.github/workflows/deploy.yml`) |
| **Update after rotation** | macOS Keychain / `gh auth login` / git credential helper |
| **Verify** | `git push origin master` without errors |

---

## 7. Firebase Web API key (client)

| Item | Detail |
|------|--------|
| **Note** | Browser Firebase API keys are restricted by domain, not fully secret — still rotate if exposed with weak restrictions |
| **Where to rotate** | Firebase Console → Project settings → General → Web API key (or create new app) |
| **Update after rotation** | `.env.local` `NEXT_PUBLIC_FIREBASE_*`; Cloud Build `--set-env-vars` if set at build time |
| **Redeploy** | Cloud Run build (Next.js embeds `NEXT_PUBLIC_*` at build) |
| **Verify** | Sign-in on production URL |

---

## Post-rotation production verification

Run after all critical rotations:

```bash
# Cloud Run (source of truth — Scheduler should keep using this URL)
curl -sS https://tenderbriefing-xzgs5uw5ta-bq.a.run.app/api/sync/status

# Firebase Hosting proxy (after deploy + custom domain)
curl -sS https://tenderbriefing-34679.web.app/api/sync/status
curl -sS https://www.tenderbriefing.co.za/api/sync/status
```

Browser:

- Sign-in on `www.tenderbriefing.co.za` (after Auth authorized domains)
- `/tenders` lists live Firestore data
- Admin sync / Scheduler unchanged (still hits Cloud Run URL if configured that way)

---

## What not to do

- Do not commit `.env.local`, `service-account.json`, or PATs
- Do not re-add real keys to markdown or setup scripts
- Do not change Cloud Scheduler target to Hosting unless you intentionally want the proxy path (Hosting → europe-west1 proxy → Run is fine for browser traffic; Scheduler should stay on direct **africa-south1** Cloud Run URL)

Current scheduler job `tenderbriefing-sync-every-15min` is in location `europe-west1` but should call the production Run `/api/sync/run` URL — verify with:

```bash
gcloud scheduler jobs describe tenderbriefing-sync-every-15min \
  --location=europe-west1 --project=tenderbriefing-34679 \
  --format='value(httpTarget.uri)'
```

---

## Completion log

Use this table when rotating:

| # | Credential | Rotated (date) | Updated in SM / env | Redeployed | Verified |
|---|------------|----------------|---------------------|------------|----------|
| 1 | OpenAI | | | | |
| 2 | Gmail OAuth secret | | | | |
| 3 | Firebase SA key | | | | |
| 4 | Other GCP SA keys | | | | |
| 5 | Secret Manager versions | | | | |
| 6 | GitHub PAT | | | | |
| 7 | Firebase Web API key | | | | |
