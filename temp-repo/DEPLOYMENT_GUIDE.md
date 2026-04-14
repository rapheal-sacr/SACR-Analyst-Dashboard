# SACR AI Dashboard — deployment guide

This document describes how this application was deployed to **Google Cloud Run**, which settings matter, and what precautions were applied. **Section 14** is a **copy-paste command reference** (manual deploy, secrets, IAM, IAP, health checks). The GitHub **WIF** bootstrap script is still only in [`.github/GITHUB_DEPLOY_SETUP.md`](./.github/GITHUB_DEPLOY_SETUP.md) because it is long; section **14.14** links to it and gives the follow-up `describe` command.

---

## Related documents

| Document | Purpose |
|----------|---------|
| [`ORIGINAL_CLOUD_RUN_DEPLOYMENT.md`](./ORIGINAL_CLOUD_RUN_DEPLOYMENT.md) | Manual path: Docker build → Artifact Registry → `gcloud run deploy` (no GitHub). |
| [`.github/GITHUB_DEPLOY_SETUP.md`](./.github/GITHUB_DEPLOY_SETUP.md) | One-time **Workload Identity Federation** + GitHub Actions secrets. |
| [`.github/workflows/deploy-cloud-run.yml`](./.github/workflows/deploy-cloud-run.yml) | CI workflow that runs on push to **`main`**. |

---

## 1. Architecture (what runs where)

- **Single Cloud Run service** serves:
  - **Static SPA** (Vite production build from `client/dist`) and `index.html` fallback.
  - **Express API** under `/api/*` on the **same origin** as the UI.
- **Region used:** `us-central1` (Iowa), aligned with **Artifact Registry** in the same region to avoid cross-region image pulls.
- **Container:** Node 20, `pnpm build` at image build time; runtime **`CMD`** runs `node dist/index.js` from `server` with **`PORT=8080`** (Cloud Run’s default convention).

**Precaution:** Do not point the production container at `PORT=4000` unless Cloud Run is configured to match; the provided `Dockerfile` uses **8080**.

---

## 2. Environment variables and secrets

### Runtime configuration (Cloud Run)

| Variable | Where stored | Notes |
|----------|----------------|------|
| `GEMINI_API_KEY` | **Secret Manager** → mounted as env | Required for AI generation. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret Manager** | Server-only; never expose to the browser. |
| `CRON_SECRET` | **Secret Manager** | Validates `POST /api/refresh` (`x-cron-secret` header). |
| `SUPABASE_URL` | Plain env on Cloud Run | No trailing spaces in `--set-env-vars` (comma-separated pairs). |
| `GOOGLE_SHEETS_ID` | Plain env | Used when `/api/refresh` archives old snapshots to Sheets. |
| `NODE_ENV` | Set in **Dockerfile** to `production` | Enables production behavior (e.g. CORS default, `/api/generate` lock). |
| `CLIENT_ORIGIN` | Optional | If set, should be the public HTTPS origin of the Cloud Run URL (no trailing slash). Often omitted when same-origin SPA + API. |
| `GEMINI_DEBUG_LOG` | Optional | Set to `1` only for extra Gemini logging in `server/src/lib/gemini.ts`; omit in production unless debugging. |
| `PORT` | Set by **Cloud Run** | Usually **8080**; the production Dockerfile sets `8080`. Do not rely on local `.env` `PORT=4000` in Cloud Run. |

**Typical Secret Manager IDs** (resource names in GCP — map to env vars via `--set-secrets` on Cloud Run):

| Secret Manager name | Becomes env var |
|---------------------|------------------|
| `gemini-api-key` | `GEMINI_API_KEY` |
| `supabase-service-role-key` | `SUPABASE_SERVICE_ROLE_KEY` |
| `cron-secret` | `CRON_SECRET` |

**GitHub Actions only** (not used by the Node app at runtime; stored under **Settings → Secrets → Actions**):

| Secret | Purpose |
|--------|---------|
| `GCP_PROJECT_ID` | Deploy/push image to the right project. |
| `GCP_SERVICE_ACCOUNT` | Deploy SA email (WIF). |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Full WIF provider resource name. |

The doc never stores **values** for API keys, `CRON_SECRET`, or Supabase keys — only names and where to configure them.

Local development uses **`.env`** (gitignored); see [`.env.example`](./.env.example).

**Precaution:** Never commit `.env` or service account JSON. Production secrets stay in **Secret Manager**; GitHub Actions does **not** need Gemini/Supabase keys—only permission to **deploy** and push images.

### Granting Secret Manager access

The **Cloud Run runtime** identity (default: `PROJECT_NUMBER-compute@developer.gserviceaccount.com`) must have **`roles/secretmanager.secretAccessor`** on each secret (or at project level). Without this, deploy fails with permission errors on secret versions.

**Precaution:** In shell IAM bindings, use `serviceAccount:${PROJECT_NUMBER}-compute@...` with a real variable or literal number—**not** invalid syntax like `${764997447178}` around digits, which expands empty in bash.

---

## 3. Security choices applied

### `POST /api/generate` disabled in production

- **Behavior:** If `NODE_ENV === "production"`, the handler returns **403** and does not call Gemini or write to Supabase.
- **Why:** That route had **no** shared secret; a public Cloud Run URL would allow unauthenticated abuse and cost.
- **Local / backfill:** Local `pnpm dev` does not set `NODE_ENV` to `production`, so `/api/generate` remains available for development. **Backfill** uses `server/src/scripts/backfill.ts` and does **not** depend on this HTTP route.

### `POST /api/refresh` (cron)

- Protected by header **`x-cron-secret`** matching **`CRON_SECRET`**.
- Intended for **Cloud Scheduler** (or manual curl with the secret), not for browsers.

### CORS

- Production default in code allows flexible origin handling when `CLIENT_ORIGIN` is unset; tightening to a single origin is optional (see server CORS config).
- **Note:** CORS is **not** a substitute for locking down expensive or sensitive endpoints.

### GitHub Actions

- Uses **Workload Identity Federation** (no long-lived JSON key in the repo).
- Deploy SA has **Artifact Registry write**, **Cloud Run admin**, and **Service Account User** on the runtime SA so revisions can be created. See [`.github/GITHUB_DEPLOY_SETUP.md`](./.github/GITHUB_DEPLOY_SETUP.md).

---

## 4. Container image: build and platform

### Dockerfile location

Build context must be the **repository root** (where the root `Dockerfile`, `pnpm-workspace.yaml`, `client/`, and `server/` live).

### `linux/amd64` (critical on Apple Silicon)

Cloud Run expects **amd64** images. Docker on **M1/M2/M3** often produces **arm64** by default, which causes errors such as *Container manifest must support amd64/linux*.

**Precaution:** Always build with:

```bash
docker build --platform linux/amd64 -t IMAGE_REF .
```

The GitHub Actions workflow uses **`--platform linux/amd64`** explicitly; **ubuntu-latest** runners are amd64, but the flag keeps the intent obvious.

### `.dockerignore`

Reduces build context size and avoids copying secrets or junk into the image. Keep `.env` out of images (also gitignored).

---

## 5. Artifact Registry

- **Format:** Docker.
- **Host:** `REGION-docker.pkg.dev` (e.g. `us-central1-docker.pkg.dev`).
- **Typical image name in this project:**  
  `us-central1-docker.pkg.dev/PROJECT_ID/sacr-docker/sacr-dashboard:TAG`

**Precaution:** `gcloud auth configure-docker REGION-docker.pkg.dev` is required on any machine that runs `docker push`.

---

## 6. Cloud Run deploy (manual summary)

Full command templates and troubleshooting: [`ORIGINAL_CLOUD_RUN_DEPLOYMENT.md`](./ORIGINAL_CLOUD_RUN_DEPLOYMENT.md).

Important flags used:

- **`--region=us-central1`**
- **`--port=8080`**
- **`--set-env-vars`** for non-secrets (no space before/after commas).
- **`--set-secrets`** as `ENV_NAME=secret_name:version` (often `:latest` while iterating).
- **`--allow-unauthenticated`:** Attempts to allow public **Invoker**; **many organizations block `allUsers`**, so this step may **warn or fail** while the revision still deploys.

**Precaution:** Redeploying with **only** `--image=...` (as in GitHub Actions) generally **inherits** existing env and secret bindings on the service—no need to repeat every secret on each CI run.

---

## 7. Access control: IAM, org policy, and IAP

### What went wrong with “public” access

- Granting **`allUsers`** the **Cloud Run Invoker** role is the standard way to make a service public.
- **Organization policy** often **denies** `allUsers`, producing *permitted customer* / IAM errors.

### Private service + browser

- A normal Chrome session does **not** send a Google **identity token** to an arbitrary `*.run.app` URL, so **“logged into Google”** alone does not satisfy **private** Cloud Run IAM.

### Identity-Aware Proxy (IAP) on Cloud Run

- **IAP** was enabled on the Cloud Run service so users get a **Google sign-in** page, then access the app.
- **Service Usage API** and related APIs must be enabled for `gcloud` / IAP setup (errors if `serviceusage.googleapis.com` was disabled).
- **IAP service agent** (`service-PROJECT_NUMBER@gcp-sa-iap.iam.gserviceaccount.com`) needs **`roles/run.invoker`** on the service.
- **End users** need **`roles/iap.httpsResourceAccessor`** (Console: *IAP-secured Web App User*) on **this Cloud Run resource**, e.g. via:

  ```bash
  gcloud iap web add-iam-policy-binding \
    --project=PROJECT_ID --region=REGION \
    --resource-type=cloud-run --service=SERVICE_NAME \
    --member="user:someone@domain.com" \
    --role="roles/iap.httpsResourceAccessor"
  ```

**Precaution:** The **`attribute.repository`** condition on the GitHub WIF provider must match `owner/repo` exactly—it does not affect IAP user list; it only affects **Actions** authentication.

### Developer access without IAP in browser

```bash
gcloud run services proxy SERVICE_NAME --project=PROJECT_ID --region=REGION
```

Useful when debugging before IAP users are fully configured.

---

## 8. CI/CD: GitHub Actions → Cloud Run

- **Trigger:** Push to **`main`** (see workflow file).
- **Concurrency:** One deploy at a time per ref; newer run cancels an in-flight one.
- **Steps:** Checkout → authenticate via WIF → `gcloud` + Docker login → build/push image tagged with **`GITHUB_SHA`** and **`latest`** → `gcloud run deploy` with the commit SHA image.

**Secrets required in GitHub:** `GCP_PROJECT_ID`, `GCP_SERVICE_ACCOUNT`, `GCP_WORKLOAD_IDENTITY_PROVIDER`.

Setup once: [`.github/GITHUB_DEPLOY_SETUP.md`](./.github/GITHUB_DEPLOY_SETUP.md).

**Precaution:** If the workflow is green but the site misbehaves, verify **Cloud Run** still has correct env/secrets from the **first** manual deploy; the pipeline only updates the image unless you extend the workflow.

---

## 9. Google Sheets archiving

- **`/api/refresh`** calls logic that can append rows to a spreadsheet before old snapshots are deleted from Supabase.
- The **runtime service account** (`PROJECT_NUMBER-compute@developer.gserviceaccount.com` by default) must have access to the sheet—typically **share the spreadsheet** with that email (Editor).

---

## 10. Scheduled refresh (production)

- Use **Cloud Scheduler** (or similar) to **`POST`** the service URL **`/api/refresh`** with header **`x-cron-secret: <CRON_SECRET>`**.
- Schedule in **America/New_York** if the product requirement is a fixed Eastern time (account for **DST** vs fixed UTC cron).

### Critical notes from production setup (do not skip)

- **Auth mode:** Use **OIDC token** on the Scheduler HTTP target when Cloud Run is behind IAP.
- **OIDC service account:** use `sacr-scheduler@PROJECT_ID.iam.gserviceaccount.com` (or equivalent dedicated caller SA).
- **Audience format:** for IAP custom OAuth, Scheduler `oidcToken.audience` must be the OAuth client ID **without** `http://` or `https://` and without path.  
  Example: `764997447178-xxxx.apps.googleusercontent.com` (correct) vs `http://7649...apps.googleusercontent.com` (wrong).
- **Required IAM 1:** Scheduler caller SA must have `roles/iap.httpsResourceAccessor` on the Cloud Run IAP resource.
- **Required IAM 2:** Cloud Scheduler service agent `service-PROJECT_NUMBER@gcp-sa-cloudscheduler.iam.gserviceaccount.com` must have `roles/iam.serviceAccountTokenCreator` on the Scheduler caller SA.
- **Required IAM 3:** IAP service agent `service-PROJECT_NUMBER@gcp-sa-iap.iam.gserviceaccount.com` must have `roles/run.invoker` on the Cloud Run service.
- **Timeout tuning:** a 401 means auth is failing; a 504/`DEADLINE_EXCEEDED` means auth succeeded but refresh ran longer than Scheduler attempt deadline (increase Scheduler deadline and Cloud Run request timeout together).
- **Known working test path:** after configuration, use Scheduler **Run now** and verify success in Cloud Scheduler execution logs + Cloud Run logs.
- **Secret hygiene:** if `CRON_SECRET` is ever shared in logs/chat/screenshot, rotate the Secret Manager value and update Scheduler header immediately.

---

## 11. Verification checklist

After any deploy:

| Check | How |
|--------|-----|
| Service URL loads (with IAP if enabled) | Browser |
| Health | `GET /health` → `{"status":"ok"}` |
| API | `GET /api/feeds` returns JSON, not 500 |
| Revision | Cloud Run console or `gcloud run services describe` |
| Actions | GitHub **Actions** tab, latest run green |

---

## 12. Rollback and recovery

- **Cloud Run:** Route traffic to a previous **revision** in the console, or deploy an older image digest/tag.
- **If GitHub Actions is broken:** Use [`ORIGINAL_CLOUD_RUN_DEPLOYMENT.md`](./ORIGINAL_CLOUD_RUN_DEPLOYMENT.md) to build and push from a laptop and run `gcloud run deploy --image=...`.

---

## 13. Quick troubleshooting reference

| Symptom | Likely cause |
|---------|----------------|
| Dockerfile not found | `docker build` run outside repo root. |
| amd64 / manifest error | Build with `--platform linux/amd64` (especially on ARM Macs). |
| Secret permission denied on deploy | Runtime SA lacks `secretmanager.secretAccessor` on secrets. |
| IAM / `allUsers` failed | Org policy; use IAP or per-user/group Invoker. |
| Forbidden in browser (private, no IAP) | No identity token; use IAP, proxy, or Invoker + token flow. |
| `/api/generate` 403 in prod | Expected: disabled when `NODE_ENV=production`. |
| GitHub deploy auth failed | WIF secrets wrong or `attribute.repository` mismatch. |
| Cloud Scheduler `UNAUTHENTICATED` 401 | Usually bad OIDC audience format, missing IAP role, or missing Scheduler service agent token-creator binding. |
| Cloud Scheduler 504 / `DEADLINE_EXCEEDED` | Refresh exceeded Scheduler attempt deadline; increase Scheduler deadline and Cloud Run timeout. |

---

## 14. Runnable command reference (manual deploy & ops)

Replace placeholders: `PROJECT_ID`, `PROJECT_NUMBER`, `REGION` (e.g. `us-central1`), `SERVICE` (e.g. `sacr-dashboard`), `AR_REPO` (e.g. `sacr-docker`), `IMAGE` (e.g. `sacr-dashboard`). Run from a machine with **Docker** and **gcloud** installed.

### 14.1 Auth and project

```bash
gcloud auth login
gcloud config set project PROJECT_ID
```

### 14.2 Enable APIs

```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  cloudresourcemanager.googleapis.com \
  serviceusage.googleapis.com \
  --project=PROJECT_ID
```

For IAP / WIF setup you may also need:

```bash
gcloud services enable \
  iap.googleapis.com \
  iamcredentials.googleapis.com \
  iam.googleapis.com \
  sts.googleapis.com \
  --project=PROJECT_ID
```

### 14.3 Artifact Registry (create once)

```bash
gcloud artifacts repositories create AR_REPO \
  --repository-format=docker \
  --location=REGION \
  --description="SACR dashboard images" \
  --project=PROJECT_ID

gcloud auth configure-docker REGION-docker.pkg.dev --quiet
```

### 14.4 Build and push image (repo root)

```bash
cd /path/to/SACR-AI-Dashboard

export IMAGE="REGION-docker.pkg.dev/PROJECT_ID/AR_REPO/IMAGE"

docker build --platform linux/amd64 -t "${IMAGE}:latest" .
docker push "${IMAGE}:latest"
```

### 14.5 Secret Manager (create secrets)

```bash
echo -n "PASTE_VALUE" | gcloud secrets create gemini-api-key --data-file=- --project=PROJECT_ID
echo -n "PASTE_VALUE" | gcloud secrets create supabase-service-role-key --data-file=- --project=PROJECT_ID
echo -n "PASTE_VALUE" | gcloud secrets create cron-secret --data-file=- --project=PROJECT_ID
```

### 14.6 Grant runtime SA access to secrets

Default Cloud Run runtime SA: `PROJECT_NUMBER-compute@developer.gserviceaccount.com`.

```bash
export PROJECT_NUMBER=$(gcloud projects describe PROJECT_ID --format='value(projectNumber)')
export RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

for SECRET in gemini-api-key supabase-service-role-key cron-secret; do
  gcloud secrets add-iam-policy-binding "$SECRET" \
    --project=PROJECT_ID \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role="roles/secretmanager.secretAccessor"
done
```

Project-wide (broader) alternative:

```bash
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/secretmanager.secretAccessor"
```

### 14.7 Deploy / update Cloud Run (full manual example)

**No space** after commas in `--set-env-vars`.

```bash
export IMAGE="REGION-docker.pkg.dev/PROJECT_ID/AR_REPO/IMAGE:latest"

gcloud run deploy SERVICE \
  --project=PROJECT_ID \
  --image="${IMAGE}" \
  --region=REGION \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --set-env-vars="SUPABASE_URL=https://YOUR_PROJECT.supabase.co,GOOGLE_SHEETS_ID=YOUR_SHEET_ID" \
  --set-secrets="GEMINI_API_KEY=gemini-api-key:latest,SUPABASE_SERVICE_ROLE_KEY=supabase-service-role-key:latest,CRON_SECRET=cron-secret:latest"
```

**Image-only update** (keeps existing env/secrets on the service—same pattern as GitHub Actions):

```bash
gcloud run deploy SERVICE \
  --project=PROJECT_ID \
  --region=REGION \
  --image="REGION-docker.pkg.dev/PROJECT_ID/AR_REPO/IMAGE:TAG_OR_DIGEST"
```

### 14.8 Deploy without local Docker (`--source`)

From repository root:

```bash
gcloud run deploy SERVICE \
  --project=PROJECT_ID \
  --source=. \
  --region=REGION \
  --platform=managed \
  --port=8080 \
  --set-env-vars="SUPABASE_URL=...,GOOGLE_SHEETS_ID=..." \
  --set-secrets="GEMINI_API_KEY=gemini-api-key:latest,..."
```

### 14.9 Optional: public access (`allUsers`)

Often **blocked by organization policy**; if allowed:

```bash
gcloud run services add-iam-policy-binding SERVICE \
  --project=PROJECT_ID \
  --region=REGION \
  --member="allUsers" \
  --role="roles/run.invoker"
```

### 14.10 IAP (after enabling on the service in Console or `gcloud run services update SERVICE --region=REGION --iap`)

IAP service agent needs **Invoker** on Cloud Run (`PROJECT_NUMBER` = numeric project number):

```bash
export PROJECT_NUMBER=$(gcloud projects describe PROJECT_ID --format='value(projectNumber)')

gcloud run services add-iam-policy-binding SERVICE \
  --project=PROJECT_ID \
  --region=REGION \
  --member="serviceAccount:service-${PROJECT_NUMBER}@gcp-sa-iap.iam.gserviceaccount.com" \
  --role="roles/run.invoker"
```

Grant a user sign-in access:

```bash
gcloud iap web add-iam-policy-binding \
  --project=PROJECT_ID \
  --region=REGION \
  --resource-type=cloud-run \
  --service=SERVICE \
  --member="user:someone@example.com" \
  --role="roles/iap.httpsResourceAccessor"
```

List IAP policy:

```bash
gcloud iap web get-iam-policy \
  --project=PROJECT_ID \
  --region=REGION \
  --resource-type=cloud-run \
  --service=SERVICE
```

### 14.11 Service URL and health

```bash
gcloud run services describe SERVICE \
  --project=PROJECT_ID \
  --region=REGION \
  --format='value(status.url)'
```

```bash
curl -sS "https://YOUR_SERVICE_URL/health"
```

### 14.12 Developer proxy (private service)

```bash
gcloud run services proxy SERVICE --project=PROJECT_ID --region=REGION
```

### 14.13 Manual cron test (`/api/refresh`)

```bash
curl -sS -X POST "https://YOUR_SERVICE_URL/api/refresh" \
  -H "x-cron-secret: YOUR_CRON_SECRET_VALUE" \
  -H "Content-Type: application/json"
```

### 14.14 Cloud Scheduler + IAP commands (recommended production path)

Create/update Scheduler job with OIDC + header secret:

```bash
gcloud scheduler jobs create http sacr-daily-refresh \
  --project=PROJECT_ID \
  --location=us-central1 \
  --schedule="0 8 * * *" \
  --time-zone="America/New_York" \
  --uri="https://YOUR_SERVICE_URL/api/refresh" \
  --http-method=POST \
  --headers="Content-Type=application/json,x-cron-secret=YOUR_CRON_SECRET_VALUE" \
  --oidc-service-account-email="sacr-scheduler@PROJECT_ID.iam.gserviceaccount.com" \
  --oidc-token-audience="OAUTH_CLIENT_ID.apps.googleusercontent.com" \
  --attempt-deadline=600s
```

If the job already exists, update it:

```bash
gcloud scheduler jobs update http sacr-daily-refresh \
  --project=PROJECT_ID \
  --location=us-central1 \
  --schedule="0 8 * * *" \
  --time-zone="America/New_York" \
  --uri="https://YOUR_SERVICE_URL/api/refresh" \
  --http-method=POST \
  --headers="Content-Type=application/json,x-cron-secret=YOUR_CRON_SECRET_VALUE" \
  --oidc-service-account-email="sacr-scheduler@PROJECT_ID.iam.gserviceaccount.com" \
  --oidc-token-audience="OAUTH_CLIENT_ID.apps.googleusercontent.com" \
  --attempt-deadline=600s
```

Grant Scheduler service agent permission to mint token as caller SA:

```bash
export PROJECT_NUMBER=$(gcloud projects describe PROJECT_ID --format='value(projectNumber)')

gcloud iam service-accounts add-iam-policy-binding \
  "sacr-scheduler@PROJECT_ID.iam.gserviceaccount.com" \
  --project=PROJECT_ID \
  --member="serviceAccount:service-${PROJECT_NUMBER}@gcp-sa-cloudscheduler.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountTokenCreator"
```

Grant IAP access to Scheduler caller SA:

```bash
gcloud iap web add-iam-policy-binding \
  --project=PROJECT_ID \
  --region=us-central1 \
  --resource-type=cloud-run \
  --service=SERVICE \
  --member="serviceAccount:sacr-scheduler@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/iap.httpsResourceAccessor"
```

Set Cloud Run request timeout to match long refresh jobs:

```bash
gcloud run services update SERVICE \
  --project=PROJECT_ID \
  --region=us-central1 \
  --timeout=600
```

Run job immediately:

```bash
gcloud scheduler jobs run sacr-daily-refresh \
  --project=PROJECT_ID \
  --location=us-central1
```

### 14.15 GitHub Actions → GCP (one-time)

The full **Workload Identity Federation** script (pool, provider, deploy SA, IAM bindings) is long and easy to mistype; it lives in **[`.github/GITHUB_DEPLOY_SETUP.md`](./.github/GITHUB_DEPLOY_SETUP.md)**. After running it, print the provider resource name:

```bash
gcloud iam workload-identity-pools providers describe PROVIDER_ID \
  --project=PROJECT_ID \
  --location=global \
  --workload-identity-pool=POOL_ID \
  --format='value(name)'
```

Store that string and the deploy service account email in **GitHub → Settings → Secrets and variables → Actions** as documented there.

---

## 15. Lessons learned (issue → resolution)

This section captures the exact setup mistakes encountered and the fix that resolved each one.

| Issue observed | Root cause | Resolution that worked |
|----------------|------------|-------------------------|
| Cloud Scheduler logs: `UNAUTHENTICATED` / 401 while calling `/api/refresh` | IAP protected endpoint rejected token | Use Scheduler HTTP target with **OIDC** and a dedicated caller SA (`sacr-scheduler@...`). |
| Scheduler still 401 after OIDC enabled | Missing IAM so Scheduler couldn’t mint token as caller SA | Grant `roles/iam.serviceAccountTokenCreator` on caller SA to `service-PROJECT_NUMBER@gcp-sa-cloudscheduler.iam.gserviceaccount.com`. |
| Scheduler still 401 with OIDC + IAM | IAP audience value wrong format | Set Scheduler `oidcToken.audience` to **OAuth client ID only** (e.g. `...apps.googleusercontent.com`) — no `http://`, `https://`, or path. |
| Could not find OAuth client ID in UI while using Google-managed OAuth | Google-managed mode hides/abstracts details needed for programmatic audience control | Switch IAP app to **Custom OAuth**, configure consent screen, and use the custom client ID in Scheduler audience. |
| Manual `curl` with `gcloud auth print-identity-token --audiences=<SERVICE_URL>` failed | Using user credentials for audience token flow and/or wrong audience type for IAP | For IAP programmatic calls, use service-account-based token flow and IAP client ID audience; easiest production test is Scheduler **Run now**. |
| Manual proxy call to `localhost` returned `Invalid IAP credentials: empty token` | `gcloud run services proxy` path did not satisfy IAP programmatic token requirements for this flow | Prefer Cloud Scheduler OIDC test path for IAP-protected `/api/refresh`. |
| Cloud Scheduler logs: `DEADLINE_EXCEEDED` / 504 | Refresh execution took longer than Scheduler attempt deadline | Increase Scheduler `attemptDeadline` (e.g. `600s`) and Cloud Run request timeout (`--timeout=600`) together. |
| Deploy error: `must support amd64/linux` | ARM image built on Apple Silicon | Build with `docker build --platform linux/amd64 ...`. |
| Deploy warning or failure when making service public | Org policy blocked `allUsers` binding | Keep service private and use IAP/user access instead of public Invoker. |
| Secret-related deploy failures and confusion | Missing Secret Manager access / shell variable formatting mistakes | Grant `secretAccessor` to runtime SA; use valid shell interpolation (`${PROJECT_NUMBER}` variable, not `${123...}` literal). |
| Runtime bugs from env var formatting | Extra whitespace in `--set-env-vars` value list | Keep comma-separated env pairs with **no extra spaces** around commas. |
| Security risk from debugging | `CRON_SECRET` appeared in logs/chat/history | Rotate `cron-secret` in Secret Manager immediately and update Scheduler header. |

### Final known-good scheduler pattern

- URL: `https://<cloud-run-host>/api/refresh`
- Method: `POST`
- Headers: `x-cron-secret: <value>`, `Content-Type: application/json`
- Auth: OIDC with caller SA (`sacr-scheduler@...`)
- Audience: `<custom-oauth-client-id>.apps.googleusercontent.com`
- Attempt deadline: `600s`
- Timezone/schedule: `America/New_York`, `0 8 * * *` (or your chosen schedule)

---

## 16. Summary

This deployment uses **Cloud Run** in **us-central1**, **Artifact Registry** for images, **Secret Manager** for sensitive env, **optional IAP** for browser login when public access is blocked, **GitHub Actions with WIF** for repeatable deploys, and **application-level** hardening (**`/api/generate` off in production**, **`/api/refresh`** protected by secret). Keep **Sheets** shared with the runtime SA and **cron** calling **`/api/refresh`** with the correct header for daily operation.

**Section 14** above is the consolidated **run command** list; **[`ORIGINAL_CLOUD_RUN_DEPLOYMENT.md`](./ORIGINAL_CLOUD_RUN_DEPLOYMENT.md)** remains a focused manual-only walkthrough with extra troubleshooting detail.
