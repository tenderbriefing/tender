# Scheduler auth — OIDC migration design

**Status:** Design accepted; header-secret remains production until OIDC cutover is applied.  
**Date:** 2026-08-08  
**Related:** `scripts/configure-workflow-scheduler.sh`, `/api/automation/run`, `/api/sync/run`

## Current posture (as of audit remediation)

Cloud Scheduler HTTP jobs authenticate with a shared secret header:

```text
x-sync-secret: <SYNC_SECRET from GSM>
```

Pros: simple, already wired, works with public Cloud Run (`--allow-unauthenticated` + app-layer secret).  
Cons: the secret is stored in the Scheduler job configuration (GCP IAM-protected, but still a long-lived shared secret in job metadata).

## Target posture

Cloud Scheduler → Cloud Run with **OIDC service account tokens**:

1. Create (or reuse) a dedicated SA, e.g. `scheduler-automation@PROJECT.iam.gserviceaccount.com`.
2. Grant that SA `roles/run.invoker` on `tenderbriefing` (africa-south1).
3. Update Scheduler jobs to:
   - `OidcToken` with the SA email
   - Audience = Cloud Run service URL (or custom domain if audience matches)
4. Optionally set Cloud Run ingress / IAM so unauthenticated callers cannot hit automation routes even before app checks.
5. Keep `SYNC_SECRET` as a **temporary dual-auth** window: accept OIDC **or** valid `x-sync-secret`, then remove header path after soak.

## Concrete cutover steps (ops)

```bash
# 1) SA
gcloud iam service-accounts create scheduler-automation \
  --project=tenderbriefing-34679 \
  --display-name="TenderBriefing Scheduler Automation"

# 2) Invoker on Cloud Run
gcloud run services add-iam-policy-binding tenderbriefing \
  --region=africa-south1 \
  --project=tenderbriefing-34679 \
  --member="serviceAccount:scheduler-automation@tenderbriefing-34679.iam.gserviceaccount.com" \
  --role="roles/run.invoker"

# 3) Update Scheduler job (example — review URI first)
gcloud scheduler jobs update http tenderbriefing-workflow-automation-hourly \
  --project=tenderbriefing-34679 \
  --location=europe-west1 \
  --uri="https://tenderbriefing-xzgs5uw5ta-bq.a.run.app/api/automation/run" \
  --oidc-service-account-email="scheduler-automation@tenderbriefing-34679.iam.gserviceaccount.com" \
  --oidc-token-audience="https://tenderbriefing-xzgs5uw5ta-bq.a.run.app" \
  --update-headers="Content-Type=application/json" \
  --clear-headers  # then re-add Content-Type only; do not re-embed x-sync-secret
```

## App changes required before removing header secret

1. Middleware / route handler: verify `Authorization: Bearer` Google OIDC token
   (`aud` = service URL, `email` = scheduler SA).
2. Dual-accept `x-sync-secret` during migration (fail closed if neither valid).
3. Update `configure-workflow-scheduler.sh` to emit OIDC config instead of embedding the secret.
4. Rotate `SYNC_SECRET` after header path is deleted.

## Why not applied in this sprint

- Cloud Run is currently `--allow-unauthenticated` for the public Next app; flipping invoker-only without a Hosting/proxy plan would break public traffic.
- OIDC for Scheduler is safe **per-job** when targeting the **direct Cloud Run URL** with SA invoker, while Hosting/proxy continues to serve the public site — but that needs a coordinated ops window and smoke of hourly automation.
- Prefer a dedicated follow-up change with dual-auth soak rather than a same-day flip during certification.

## Residual risk acceptance

Header secret remains acceptable short-term because:

- Secret lives in GSM + Scheduler job (IAM-gated), not in git.
- Automation/sync routes still require the header server-side.
- Rate limits + lease/idempotency mitigate abuse if the secret leaked.

Track cutover under ops backlog; do not weaken current header validation before OIDC is live.
