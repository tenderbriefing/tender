# CI/CD setup (GitHub Actions → Firebase + Cloud Run)

GitHub Actions deploy workflow lives at `.github/workflows/deploy.yml`. On each push to `master`/`main` it deploys Firebase (rules, indexes, storage, hosting), Cloud Run (`cloudbuild.yaml`), the europe-west1 hosting proxy, then verifies production URLs.

**Requires** repository secret `FIREBASE_SERVICE_ACCOUNT` and a push token with **`workflow`** scope.

---

## Prerequisites

- Repository: https://github.com/tenderbriefing/tender
- GCP project: `tenderbriefing-34679`
- Cloud Run service: `tenderbriefing` in `africa-south1`
- Firebase CLI project linked (`.firebaserc`)

---

## Step 1 — Create a GitHub personal access token (PAT)

1. GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained** (or classic).
2. Repository access: **tenderbriefing/tender** only.
3. Permissions:
   - **Contents**: Read and write
   - **Workflows**: Read and write (required to push `.github/workflows/deploy.yml`)
4. Generate and store the token securely (password manager). Do not commit it.

Authenticate locally:

```bash
gh auth login
# or configure git to use the PAT for HTTPS pushes
```

---

## Step 2 — Add GitHub repository secret

1. GitHub → **tenderbriefing/tender** → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret**
   - Name: `FIREBASE_SERVICE_ACCOUNT`
   - Value: full JSON of a deploy service account (least privilege: Firebase Admin, Cloud Build Editor, Cloud Run Admin, Secret Manager Accessor as needed)

Use a dedicated SA (e.g. `github-deploy@tenderbriefing-34679.iam.gserviceaccount.com`), not your personal user key.

---

## Step 3 — Workflow file

Already in the repo: `.github/workflows/deploy.yml`. To re-copy from template:

```bash
cp docs/github-actions-deploy.yml.example .github/workflows/deploy.yml
```

Push must use a PAT or `gh` session with **`workflow`** scope or GitHub will reject the workflow file.

---

## Step 4 — What the workflow does

On push to `main` or `master` (and manual `workflow_dispatch`):

1. **deploy_firebase** — Firestore rules, indexes, Storage rules, Firebase Hosting
2. **deploy_cloud_run** — `gcloud builds submit` with `cloudbuild.yaml` (`africa-south1`)
3. **deploy_hosting_proxy** — `cloudbuild-hosting-proxy.yaml` (`europe-west1` → production Cloud Run)
4. **verify_production** — HTTP checks on `www`, apex, `web.app`, and `/api/integrations/health`

---

## Step 5 — Optional: deploy Hosting in CI

Add a job step after auth:

```yaml
- uses: w9jds/firebase-action@master
  with:
    args: deploy --only hosting --project tenderbriefing-34679 --non-interactive
  env:
    GCP_SA_KEY: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
```

---

## Step 6 — Verify CI

1. Push a small change to `master`
2. GitHub → **Actions** → watch **Deploy TenderBriefing**
3. Confirm Cloud Run revision and Firestore rules deploy
4. Production: `curl -sS https://tenderbriefing-xzgs5uw5ta-bq.a.run.app/api/sync/status`

---

## Manual deploy (current production path)

```bash
firebase deploy --only firestore --project tenderbriefing-34679
firebase deploy --only hosting --project tenderbriefing-34679
gcloud builds submit --config cloudbuild.yaml --project=tenderbriefing-34679 --region=africa-south1
```

---

## Related docs

- `docs/github-actions-deploy.yml.example` — workflow template
- `docs/GITHUB_PUSH.md` — first-time push notes
- `docs/CUSTOM_DOMAIN_AFRIHOST.md` — www + Afrihost DNS
- `docs/SECURITY_ROTATION_CHECKLIST.md` — rotate keys after history exposure
