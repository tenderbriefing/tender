# Push TenderBriefing to GitHub

Repository: https://github.com/tenderbriefing/tender

## Preconditions

- Commit ready on branch `master` (latest: procurement platform ship)
- Secrets **not** tracked (confirmed via `git status --ignored`):
  - `.env.local`
  - `service-account.json`
  - `node_modules/`, `.next/`

## Commands (run on your Mac)

```bash
cd "/Users/billionaire/Desktop/Tender briefing"

git status
git status --ignored | grep -E 'service-account|\.env'

git remote -v
# If missing:
git remote add origin https://github.com/tenderbriefing/tender.git
# If wrong URL:
git remote set-url origin https://github.com/tenderbriefing/tender.git

# Authenticate (private repo) — use one:
# - GitHub CLI: gh auth login
# - SSH: git@github.com:tenderbriefing/tender.git
# - HTTPS + Personal Access Token when prompted

git push -u origin master
```

If the default branch on GitHub is `main`:

```bash
git branch -M main
git push -u origin main
```

## Verify push

```bash
git log origin/master -1 --oneline
# or
git log origin/main -1 --oneline
```

Open: https://github.com/tenderbriefing/tender

## GitHub Actions workflow

The deploy workflow is kept as `docs/github-actions-deploy.yml.example` so the first push can succeed without a PAT `workflow` scope. After push, copy it to `.github/workflows/deploy.yml` and commit using a token with **workflow** permission (or add the file in the GitHub UI).

## GitHub Actions

Workflow template: `docs/github-actions-deploy.yml.example` → `.github/workflows/deploy.yml`

On push to `main` or `master`:

1. Deploy Firestore rules (`firebase deploy --only firestore`)
2. Cloud Build → Cloud Run (`cloudbuild.yaml`)

Required secret: `FIREBASE_SERVICE_ACCOUNT` (JSON key for deploy SA).

## If push fails

| Error | Fix |
|-------|-----|
| `Repository not found` | Create repo, fix org name, or log in with access |
| `Permission denied` | Use PAT or SSH key linked to GitHub account |
| `could not write .git/config` | Run commands in Terminal.app (not restricted sandbox) |
