#!/usr/bin/env bash
# Establish the first trusted GitHub Actions identity and Terraform backend.
#
# This script is intentionally generic: all operator values arrive only from
# protected GitHub configuration. It runs exclusively in the manually dispatched
# Bootstrap CI workflow after that workflow checks out trusted main-branch code.
# It must never be run from a workstation.
set -euo pipefail

fail() {
  printf '%s\n' "bootstrap failed: $1" >&2
  exit 1
}

require() {
  local name="$1"
  [[ -n "${!name:-}" ]] || fail "required protected configuration $name is absent"
}

# Do not print command arguments. This keeps project, bucket, identity, and WIF
# values out of public Actions logs even though they are protected configuration.
run_private() {
  "$@" >/dev/null 2>&1 || fail "a bootstrap command did not complete"
}

require GCP_PROJECT
require TF_STATE_BUCKET
require TF_STATE_BUCKET_LOCATION
require TF_SERVICE_ACCOUNT_ID
require WIF_POOL_ID
require WIF_PROVIDER_ID
require WIF_PRINCIPAL_SET
require CLOUDSDK_AUTH_ACCESS_TOKEN

[[ "${GITHUB_REPOSITORY:-}" == "Grit-Chat-App/grit-chat" ]] || fail "unexpected repository"
[[ "${GITHUB_REF:-}" == "refs/heads/main" ]] || fail "bootstrap must run on main"

# Blaze was an explicit product decision. Verify the existing billing link before
# creating anything. The command's value remains in runner memory only.
billing_enabled="$(gcloud billing projects describe "$GCP_PROJECT" --format='value(billingEnabled)' 2>/dev/null || true)"
[[ "$billing_enabled" == "True" ]] || fail "the target project has no active Cloud Billing link"
unset billing_enabled

# These are the APIs the final checked-in roots use. Enabling is idempotent.
run_private gcloud services enable \
  cloudresourcemanager.googleapis.com \
  cloudbilling.googleapis.com \
  serviceusage.googleapis.com \
  storage.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  dns.googleapis.com \
  firebase.googleapis.com \
  firebasehosting.googleapis.com \
  --project="$GCP_PROJECT" --quiet

# The GCS backend must preexist. Object versioning preserves Terraform state
# history; a seven-day soft-delete window protects against accidental object
# deletion. Do not set a bucket retention policy: Terraform's state lock needs to
# delete its lock object as part of normal operation.
if ! gcloud storage buckets describe "gs://${TF_STATE_BUCKET}" --project="$GCP_PROJECT" >/dev/null 2>&1; then
  run_private gcloud storage buckets create "gs://${TF_STATE_BUCKET}" \
    --project="$GCP_PROJECT" \
    --location="$TF_STATE_BUCKET_LOCATION" \
    --uniform-bucket-level-access
fi
run_private gcloud storage buckets update "gs://${TF_STATE_BUCKET}" \
  --project="$GCP_PROJECT" \
  --uniform-bucket-level-access \
  --versioning \
  --soft-delete-duration=7d

service_account_email="${TF_SERVICE_ACCOUNT_ID}@${GCP_PROJECT}.iam.gserviceaccount.com"
if ! gcloud iam service-accounts describe "$service_account_email" --project="$GCP_PROJECT" >/dev/null 2>&1; then
  run_private gcloud iam service-accounts create "$TF_SERVICE_ACCOUNT_ID" \
    --project="$GCP_PROJECT" \
    --display-name="Grit Chat CI Terraform"
fi

# Exact permanent runtime rights for the checked-in roots. None is Owner or
# Editor. The bootstrap user token has broader authority only for this one CI run;
# the permanent identity cannot create users, WIF pools, or project IAM policy.
for role in \
  roles/dns.admin \
  roles/firebasehosting.admin \
  roles/serviceusage.serviceUsageAdmin; do
  run_private gcloud projects add-iam-policy-binding "$GCP_PROJECT" \
    --member="serviceAccount:${service_account_email}" \
    --role="$role" \
    --condition=None \
    --quiet
 done
run_private gcloud storage buckets add-iam-policy-binding "gs://${TF_STATE_BUCKET}" \
  --member="serviceAccount:${service_account_email}" \
  --role=roles/storage.objectAdmin \
  --condition=None \
  --quiet

if ! gcloud iam workload-identity-pools describe "$WIF_POOL_ID" \
  --project="$GCP_PROJECT" --location=global >/dev/null 2>&1; then
  run_private gcloud iam workload-identity-pools create "$WIF_POOL_ID" \
    --project="$GCP_PROJECT" \
    --location=global \
    --display-name="Grit Chat GitHub Actions"
fi

# The provider admits exactly this public repository, only main, and only the
# three permanent workflows that need cloud access. Bootstrap itself uses the
# temporary OAuth token, so it is deliberately not trusted by the permanent WIF
# provider. Updating the provider on subsequent dispatches is what makes this
# script idempotent and keeps its admission condition from drifting.
attribute_mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref"
attribute_condition="assertion.repository=='Grit-Chat-App/grit-chat' && assertion.ref=='refs/heads/main' && (assertion.workflow=='DNS' || assertion.workflow=='Hosting Control Plane' || assertion.workflow=='Site')"
if gcloud iam workload-identity-pools providers describe "$WIF_PROVIDER_ID" \
  --project="$GCP_PROJECT" \
  --location=global \
  --workload-identity-pool="$WIF_POOL_ID" >/dev/null 2>&1; then
  run_private gcloud iam workload-identity-pools providers update-oidc "$WIF_PROVIDER_ID" \
    --project="$GCP_PROJECT" \
    --location=global \
    --workload-identity-pool="$WIF_POOL_ID" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="$attribute_mapping" \
    --attribute-condition="$attribute_condition"
else
  run_private gcloud iam workload-identity-pools providers create-oidc "$WIF_PROVIDER_ID" \
    --project="$GCP_PROJECT" \
    --location=global \
    --workload-identity-pool="$WIF_POOL_ID" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="$attribute_mapping" \
    --attribute-condition="$attribute_condition"
fi

# The trust member is protected configuration. Keeping its full resource form
# outside this public script prevents a project number or WIF resource path from
# reaching a public diff or workflow log.
run_private gcloud iam service-accounts add-iam-policy-binding "$service_account_email" \
  --project="$GCP_PROJECT" \
  --member="$WIF_PRINCIPAL_SET" \
  --role=roles/iam.workloadIdentityUser \
  --condition=None \
  --quiet

# Clear sensitive process values as soon as the cloud work is complete. The
# GitHub secrets are deleted by the supervising parent after the workflow exits.
unset CLOUDSDK_AUTH_ACCESS_TOKEN WIF_PRINCIPAL_SET service_account_email
printf '%s\n' "Bootstrap completed. Inspect resources out of band before arming permanent workflows."
