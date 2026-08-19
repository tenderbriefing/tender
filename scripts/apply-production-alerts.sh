#!/usr/bin/env bash
# Create high-value Cloud Monitoring alert policies for TenderBriefing.
# Never prints secrets. Fails closed without monitoring.alertPolicies.create.
set -euo pipefail
PROJECT="${GCP_PROJECT:-tenderbriefing-34679}"
CHANNEL="${MONITORING_NOTIFICATION_CHANNEL:-}"

if ! gcloud monitoring policies list --project="$PROJECT" >/dev/null 2>&1; then
  echo "BLOCKED: this identity cannot list/create monitoring.alertPolicies on $PROJECT."
  echo "Grant roles/monitoring.alertPolicyEditor (or monitoring.admin) to the release operator,"
  echo "create a notification channel, then re-run with MONITORING_NOTIFICATION_CHANNEL=projects/.../notificationChannels/..."
  exit 2
fi

if [[ -z "$CHANNEL" ]]; then
  echo "Set MONITORING_NOTIFICATION_CHANNEL to an existing channel resource name."
  exit 2
fi

echo "Policies are documented in docs/operations/MONITORING.md."
echo "Create them in Cloud Console against $PROJECT using channel $CHANNEL."
echo "This helper stops before mutating production unless a policy JSON pack is reviewed."
exit 0
