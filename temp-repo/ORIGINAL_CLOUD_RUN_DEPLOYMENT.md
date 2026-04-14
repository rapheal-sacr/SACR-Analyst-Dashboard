# Original manual Cloud Run deployment (Docker → Artifact Registry)

Use this guide to redeploy **without** GitHub Actions if the CI pipeline fails or the project is not connected to GitHub. The app is a single container (Express + Vite static build) listening on **port 8080** in production.

Replace placeholders:

- `PROJECT_ID` — GCP project ID (e.g. `gen-lang-client-0381622764`)
- `PROJECT_NUMBER` — numeric project number (`gcloud projects describe PROJECT_ID --format='value(projectNumber)'`)
- `REGION` — e.g. `us-central1` (match Artifact Registry location)
- `SERVICE` — e.g. `sacr-dashboard`
- `AR_REPO` — Artifact Registry Docker repo name (e.g. `sacr-docker`)
- `IMAGE` — e.g. `sacr-dashboard`

---

## 1. Prerequisites

- [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) installed locally.
- Docker Desktop (or Docker engine) if building on your machine.

```bash
gcloud auth login
gcloud config set project PROJECT_ID
```

Optional default region (fewer flags later):

```bash
gcloud config set run/region REGION
```

---

## 2. Enable APIs

```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  cloudresourcemanager.googleapis.com \
  serviceusage.googleapis.com \
  --project=PROJECT_ID
```

Enable others if prompted during later steps (e.g. `iamcredentials.googleapis.com` for Workload Identity / IAP).

---

## 3. Artifact Registry (Docker repository)

Create once per region/repo name:

```bash
gcloud artifacts repositories create AR_REPO \
  --repository-format=docker \
  --location=REGION \
  --description="SACR dashboard images" \
  --project=PROJECT_ID
```

Configure Docker to authenticate pushes:

```bash
gcloud auth configure-docker REGION-docker.pkg.dev
```

---

## 4. Build the image (from repo root)

The `Dockerfile` lives at the **monorepo root** (next to `package.json`, `client/`, `server/`). Always build from that directory.

**Apple Silicon (M1/M2/M3):** Cloud Run needs **linux/amd64**. Force platform:

```bash
cd /path/to/SACR-AI-Dashboard

docker build --platform linux/amd64 \
  -t REGION-docker.pkg.dev/PROJECT_ID/AR_REPO/IMAGE:latest \
  .
```

If you omit `--platform` on ARM Macs, deploy may fail with: *Container manifest must support amd64/linux*.

---

## 5. Push the image

```bash
docker push REGION-docker.pkg.dev/PROJECT_ID/AR_REPO/IMAGE:latest
```

---

## 6. Secret Manager (runtime secrets)

Create secrets (example names; use your own naming consistently):

```bash
echo -n "YOUR_VALUE" | gcloud secrets create gemini-api-key --data-file=- --project=PROJECT_ID
echo -n "YOUR_VALUE" | gcloud secrets create supabase-service-role-key --data-file=- --project=PROJECT_ID
echo -n "YOUR_VALUE" | gcloud secrets create cron-secret --data-file=- --project=PROJECT_ID
```

Grant the **Cloud Run runtime** service account access to read secrets. Default runtime SA:

`PROJECT_NUMBER-compute@developer.gserviceaccount.com`

Per secret (repeat for each):

```bash
gcloud secrets add-iam-policy-binding SECRET_NAME \
  --project=PROJECT_ID \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

Or grant at project level (broader):

```bash
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

**Shell tip:** use `serviceAccount:${PROJECT_NUMBER}-compute@...` only if `PROJECT_NUMBER` is a variable. Do **not** write `${764997447178}` around a literal number.

---

## 7. Deploy to Cloud Run

Non-secret configuration belongs in `--set-env-vars`. Sensitive values use `--set-secrets` as `ENV_NAME=secret_name:version`.

**Important:** No space before/after commas in `--set-env-vars` (e.g. `SUPABASE_URL=https://xxx.supabase.co,GOOGLE_SHEETS_ID=...`).

```bash
gcloud run deploy SERVICE \
  --project=PROJECT_ID \
  --image=REGION-docker.pkg.dev/PROJECT_ID/AR_REPO/IMAGE:latest \
  --region=REGION \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --set-env-vars="SUPABASE_URL=https://YOUR_PROJECT.supabase.co,GOOGLE_SHEETS_ID=YOUR_SHEET_ID" \
  --set-secrets="GEMINI_API_KEY=gemini-api-key:latest,SUPABASE_SERVICE_ROLE_KEY=supabase-service-role-key:latest,CRON_SECRET=cron-secret:latest"
```

- **`--allow-unauthenticated`:** Makes the service **public** (org policy may **block** this; see below).
- If deploy warns **Setting IAM policy failed** for `allUsers`, the revision may still succeed; the service might require **Invoker** IAM or **IAP** instead.

Get the live URL:

```bash
gcloud run services describe SERVICE --region=REGION --project=PROJECT_ID --format='value(status.url)'
```

The **SPA** is at the root of that URL (`/`); APIs are under `/api/...` on the same host.

---

## 8. Optional: same deploy without local Docker

From the repo root (where `Dockerfile` exists):

```bash
gcloud run deploy SERVICE \
  --project=PROJECT_ID \
  --source=. \
  --region=REGION \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --set-env-vars="..." \
  --set-secrets="..."
```

Cloud Build builds the image in GCP (still ensure production listens on **8080**).

---

## 9. Access control (common issues)

### Public internet

If policy allows:

```bash
gcloud run services add-iam-policy-binding SERVICE \
  --project=PROJECT_ID \
  --region=REGION \
  --member="allUsers" \
  --role="roles/run.invoker"
```

Many organizations **deny** `allUsers`; then use **per-user Invoker** or **Identity-Aware Proxy (IAP)** on Cloud Run. Signing into Chrome alone does **not** send an identity token to Cloud Run; IAP or `gcloud run services proxy` is needed for private services.

### Developer quick access (private service)

```bash
gcloud run services proxy SERVICE --project=PROJECT_ID --region=REGION
```

Open the printed `localhost` URL while the command runs.

---

## 10. After deploy checklist

- **`GET /health`** on the service URL should return `{"status":"ok"}`.
- **Google Sheets archive:** share the spreadsheet with **`PROJECT_NUMBER-compute@developer.gserviceaccount.com`** (Editor) so `/api/refresh` can append rows.
- **Scheduler:** call **`POST /api/refresh`** with header **`x-cron-secret`** matching **`CRON_SECRET`** (e.g. Cloud Scheduler).
- **Redeploys:** rebuild/push a new image tag (or `:latest` and force new digest), then run the same `gcloud run deploy` with the new `--image=...`. Env vars and secrets on the service are **retained** if you omit those flags (per-revision inheritance).

---

## 11. Related docs in this repo

- **GitHub Actions deploy:** `.github/workflows/deploy-cloud-run.yml` and `.github/GITHUB_DEPLOY_SETUP.md`
- **App env template:** `.env.example` (do not commit real `.env`)

---

## 12. Troubleshooting quick reference

| Symptom | Likely cause |
|--------|----------------|
| `open Dockerfile: no such file` | Ran `docker build` from wrong directory; use repo root. |
| `must support amd64/linux` | Build with `--platform linux/amd64` on ARM Macs. |
| Secret permission denied on deploy | Grant `secretmanager.secretAccessor` to the **runtime** SA on each secret (or project). |
| `allUsers` / IAM policy failed | Org policy blocks public access; use IAP or user/group Invoker. |
| Forbidden in browser (private service) | Need IAP, Invoker on your user, or `gcloud run services proxy`. |

This document reflects the **manual** path used before GitHub Actions; keep values and secret **names** aligned with what you created in GCP.
