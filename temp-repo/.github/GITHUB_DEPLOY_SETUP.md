# GitHub Actions → Cloud Run

The workflow `.github/workflows/deploy-cloud-run.yml` runs on every push to **`main`**: builds a **linux/amd64** image, pushes to **Artifact Registry**, and deploys **`sacr-dashboard`** in **`us-central1`**. Existing Cloud Run env vars and Secret Manager bindings stay on the service (only the image tag changes).

## 1. GitHub repository secrets

In GitHub: **Settings → Secrets and variables → Actions → New repository secret**.

| Secret | Value |
|--------|--------|
| `GCP_PROJECT_ID` | `gen-lang-client-0381622764` (your GCP project ID) |
| `GCP_SERVICE_ACCOUNT` | Email of the deploy service account (see below), e.g. `github-actions-deploy@gen-lang-client-0381622764.iam.gserviceaccount.com` |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Full provider resource name (see below), e.g. `projects/764997447178/locations/global/workloadIdentityPools/github-pool/providers/github-provider` |

## 2. One-time: Workload Identity Federation (no JSON keys)

Run in Cloud Shell or your machine (`gcloud` logged in as project Owner or similar). Replace **`OWNER/REPO`** if your GitHub repo path differs (this repo: **`chiaghaizu/sacr-ai-dashboard`**).

```bash
export PROJECT_ID=gen-lang-client-0381622764
export PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
export POOL_ID=github-pool
export PROVIDER_ID=github-provider
export REPO="chiaghaizu/sacr-ai-dashboard"   # GitHub owner/name
export DEPLOY_SA_NAME=github-actions-deploy

gcloud services enable iamcredentials.googleapis.com iam.googleapis.com sts.googleapis.com --project="$PROJECT_ID"

gcloud iam workload-identity-pools create "$POOL_ID" \
  --project="$PROJECT_ID" --location="global" --display-name="GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_ID" \
  --project="$PROJECT_ID" --location="global" --workload-identity-pool="$POOL_ID" \
  --display-name="GitHub" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='$REPO'"

gcloud iam service-accounts create "$DEPLOY_SA_NAME" \
  --project="$PROJECT_ID" --display-name="GitHub Actions Cloud Run deploy"

export DEPLOY_SA="${DEPLOY_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${DEPLOY_SA}" --role="roles/artifactregistry.writer"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${DEPLOY_SA}" --role="roles/run.admin"

gcloud iam service-accounts add-iam-policy-binding "${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --project="$PROJECT_ID" \
  --member="serviceAccount:${DEPLOY_SA}" \
  --role="roles/iam.serviceAccountUser"

gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA" \
  --project="$PROJECT_ID" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/attribute.repository/${REPO}"
```

Copy the **Workload Identity Provider** resource name for the `GCP_WORKLOAD_IDENTITY_PROVIDER` secret:

```bash
gcloud iam workload-identity-pools providers describe "$PROVIDER_ID" \
  --project="$PROJECT_ID" --location="global" --workload-identity-pool="$POOL_ID" \
  --format='value(name)'
```

It should look like: `projects/764997447178/locations/global/workloadIdentityPools/github-pool/providers/github-provider`.

## 3. Push to `main`

After secrets are set, merge or push to **`main`**; check **Actions** for the workflow run.

## Troubleshooting

- **Permission denied on deploy**: Ensure **`roles/iam.serviceAccountUser`** is granted to the deploy SA on **`PROJECT_NUMBER-compute@developer.gserviceaccount.com`** (or whichever account Cloud Run uses as runtime).
- **Attribute condition**: If the workflow fails auth, confirm `REPO` in the condition matches **`owner/repo`** exactly (case-sensitive).
- **Manual deploy** still works with `gcloud run deploy` and the same image URL.
