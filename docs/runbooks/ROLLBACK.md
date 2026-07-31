# Rollback Runbook

## Last known good

Record the production SHA before each deploy. Programme baseline pre-work: `27a5463`.

## Application rollback (Cloud Run + Hosting)

1. Identify last known good git SHA.
2. Re-run GitHub Actions deploy from that SHA **or** `gcloud run services update-traffic` / redeploy prior Cloud Build revision.
3. If Firestore rules were changed and are unsafe: `firebase deploy --only firestore:rules` from the last-good commit.
4. Do **not** delete payment or attendance documents to “fix” state.

```bash
git fetch origin
git checkout <last-known-good-sha>
# Prefer CI deploy workflow on that SHA rather than local ad-hoc deploy
```

## Data considerations

- Payment `paid` marks are authoritative after ITN — rolling back code does not reverse money movement.
- Prefer compensating actions (refunds via PayFast merchant tools + admin status) over deleting records.

## Validation after rollback

1. `GET https://www.tenderbriefing.co.za/api/health/firestore`
2. SME sign-in + tenders list
3. Create attendance request (sandbox if needed)
4. Confirm `/api/bookings` still 410
5. Confirm WhatsApp webhook behaviour matches intended enablement
