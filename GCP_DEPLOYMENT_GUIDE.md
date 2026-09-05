# Deploying js-ml-dashboard on Google Cloud Run

End-to-end instructions for hosting this repo on Cloud Run and serving it at
`kylecsnow.com`. Written for someone who can run Docker locally and is new to
GCP. An AWS App Runner mental model helps for the mapping table below, but is
not required.

Run every command in **one shell session** so the `PROJECT_ID` / `REGION`
exports stick. In a new terminal, export them again **and** re-run
`gcloud config set project "$PROJECT_ID"`. `gcloud` only knows a project after
it is set in that shell.

---

## What you will have when finished

- The same Docker image this repo already builds (`js-ml-dashboard-app:latest`)
  pushed to **Artifact Registry**.
- A public **Cloud Run** service (Next.js on port 8777, FastAPI on port 8000
  inside the container).
- Optional: `kylecsnow.com` / `www.kylecsnow.com` pointed at that service.
  DNS stays at **Porkbun**; Google provisions the certificate.

Cloud Run is the right GCP product for this app: one container, one public URL,
scale-to-zero when idle. Cloud Functions are the wrong model. App Engine is
more rework. GKE is orchestration you do not need. A always-on Compute Engine
VM would also run the image, but you would pay for idle time and manage TLS
yourself.

| AWS (if you have used App Runner) | GCP |
|---|---|
| AWS account | GCP **project** |
| ECR | **Artifact Registry** |
| App Runner service | **Cloud Run** service |
| App Runner env vars | `--set-env-vars` / Secret Manager |
| Custom domain on App Runner | Cloud Run **domain mapping** + Porkbun DNS |
| CloudWatch logs | Cloud Run **Logs** tab, or `gcloud run services logs read` |
| CloudFront / ACM | Google-managed certificate after domain mapping |

---

## How the container runs

The `Dockerfile` builds **one image** with both processes:

| Process | Port | Role |
|---|---|---|
| FastAPI (`python main.py --no-reload`) | 8000 | `/api/*` and `/health` |
| Next.js (`npm run start`) | 8777 | Pages + server-side rewrite of `/api/*` → `http://127.0.0.1:8000/api/*` |

The browser only talks to port **8777**. Cloud Run also sends public traffic to
**8777** (`--port 8777`). FastAPI is localhost-only inside the container.

The image start script:

1. Starts FastAPI with `--no-reload` (local `python main.py` still defaults to
   reload).
2. Waits until `http://127.0.0.1:8000/health` succeeds (up to 90 seconds).
3. Starts Next.js.

That wait is required on Cloud Run. Cloud Run marks an instance ready as soon
as port 8777 accepts connections, then may **throttle CPU** when no request is
in flight. If Next listens before FastAPI binds 8000, every `/api/*` rewrite
fails with `ECONNREFUSED 127.0.0.1:8000` and the browser sees a plaintext
`Internal Server Error` (empty model dropdown, broken dataset-generator chat).
Always-on hosts (local Docker, App Runner) hide this because CPU stays
allocated.

Nothing in production persists to disk. The `schemas.db` volume in
`docker-compose.yml` is local-dev only.

Required runtime env vars (same names as local `.env` / App Runner):

| Variable | Required | Purpose |
|---|---|---|
| `GROQ_API_KEY` | Yes, for AI chat | Dataset-generator assistant |
| `LANGSMITH_API_KEY` | Optional | LLM tracing |
| `LANGSMITH_TRACING` | Optional | Set `true` to enable tracing |

`OPENAI_API_KEY` in `.env` is unused. CORS `allow_origins` in `backend/main.py`
lists `localhost:8777` only; that does not matter in production because the
browser is same-origin with Next.

The image is ~2.1 GB. Cloud Run’s limit is 10 GB. Artifact Registry’s free
storage tier is 0.5 GB, so image storage is a few cents per month.

---

## Prerequisites

### 1. Google account and billing

Sign in at <https://console.cloud.google.com>. Create a **billing account**
(credit card) and claim the **$300 / 90-day new-customer credit** if eligible.

A billing account on the Google login is not enough. The project must be
**linked** to that account in step 3d, or Artifact Registry and Cloud Run will
refuse to enable.

### 2. gcloud CLI

This is the only OS-dependent step. After install, every later command is the
same.

**macOS (Apple Silicon or Intel) — Homebrew:**

```bash
# Install Homebrew first if needed:
# /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

brew install --cask gcloud-cli
gcloud --version
```

**Linux (Debian / Ubuntu):**

```bash
sudo apt-get update
sudo apt-get install ca-certificates gnupg curl

curl https://packages.cloud.google.com/apt/doc/apt-key.gpg \
  | sudo gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg

echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" \
  | sudo tee -a /etc/apt/sources.list.d/google-cloud-sdk.list

sudo apt-get update && sudo apt-get install google-cloud-cli
gcloud --version
```

Other distros: <https://cloud.google.com/sdk/docs/install>.

### 3. Project, CLI config, billing, APIs

`gcloud` does not inherit the project selected in the Cloud Console. Skipping
`export PROJECT_ID` + `gcloud config set project` produces `could not parse
resource []` and `Failed to find attribute [project]`.

**3a. Log in (same shell you will deploy from):**

```bash
gcloud auth login
# "Your current project is [None]" is expected until 3c
```

**3b. Create the project:**

Project IDs are globally unique. `gcloud projects create` sets the ID;
`--name` is only a label. If `js-ml-dashboard` is taken, pick another ID
(for example `kylecsnow-ml-dashboard`) and use **that** ID everywhere below.
Image URLs include it.

```bash
export PROJECT_ID=js-ml-dashboard
gcloud projects create "$PROJECT_ID" --name "js-ml-dashboard"
```

Confirm with `gcloud projects list` — use the **PROJECT_ID** column, not NAME.

**3c. Point this shell at that project:**

```bash
export PROJECT_ID=js-ml-dashboard
export REGION=us-east1
gcloud config set project "$PROJECT_ID"
gcloud config get-value project    # must print the ID, not (unset)
```

Repeat this in every new terminal. `gcloud auth login` does not restore it.

**3d. Link billing and enable APIs:**

```bash
gcloud billing accounts list
# copy the ACCOUNT_ID (looks like 0X0X0X-0X0X0X-0X0X0X)

gcloud billing projects link "$PROJECT_ID" \
  --billing-account=YOUR_ACCOUNT_ID

gcloud services enable \
  artifactregistry.googleapis.com \
  run.googleapis.com
```

Wait until enable finishes (a minute or two). A billing error means the
project is not linked yet.

`gcloud auth application-default login` is not needed here. Docker push and
`gcloud run deploy` use credentials from `gcloud auth login`.

### 4. Region: `us-east1`

This guide uses **`us-east1`** (Moncks Corner, South Carolina). Cloud Run
**domain mapping** is available there. GCP’s Northern Virginia region is
`us-east4`, not `us-east1`. Either region can host the service; do not mix
them (registry in one region, service in another) — that adds latency and
cross-region egress.

---

## Step 1 — Push the image to Artifact Registry

`gcloud auth configure-docker` logs Docker into the registry. The argument is
a **hostname**, not a bare region name.

**First time only — Docker login and create the repository:**

```bash
gcloud auth configure-docker "${REGION}-docker.pkg.dev"
gcloud artifacts repositories create js-ml-dashboard \
  --repository-format=DOCKER \
  --location="$REGION"
```

`us-east1` alone is wrong here. Docker would register a helper for the host
`us-east1`, then `docker push` to `us-east1-docker.pkg.dev` would fail with
unauthorized / denied.

**Build, tag, and push (every deploy):**

`docker compose` names the local image **`js-ml-dashboard-app:latest`**
(service `app`). Cloud Run only runs **`linux/amd64`**.
`docker-compose.yml` already sets `platform: linux/amd64`. A plain
`docker build` on Apple Silicon produces `linux/arm64`, which Cloud Run
rejects (`exec format error`). If you build without Compose, pass
`--platform linux/amd64`.

`docker compose up --build` builds the image and starts it locally so you can
smoke-test (`http://localhost:8777`, model dropdown, dataset-generator chat)
before pushing. Stop with `Ctrl+C`, then `docker compose down` if you want
the containers removed. The image name is still `js-ml-dashboard-app:latest`.

```bash
docker compose up --build

# Must print amd64. If it prints arm64, do not push.
docker image inspect js-ml-dashboard-app:latest --format '{{.Architecture}}'

docker tag js-ml-dashboard-app:latest \
  ${REGION}-docker.pkg.dev/${PROJECT_ID}/js-ml-dashboard/app:latest

docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/js-ml-dashboard/app:latest
```

Artifact Registry names look like
`<region>-docker.pkg.dev/<project>/<repository>/<image>:<tag>`. If
`PROJECT_ID` changed, the URL changes with it.

---

## Step 2 — Deploy the Cloud Run service

This command creates the service or updates it. Re-running it is the redeploy
path.

Put the keys in the shell first (copy from `.env`; do not type secrets into
the command line history if you can avoid it):

```bash
export GROQ_API_KEY=...
export LANGSMITH_API_KEY=...
export LANGSMITH_TRACING=true
```

`LANGSMITH_*` may be empty / omitted if you do not want tracing. `GROQ_API_KEY`
must be set or the dataset-generator assistant returns an error after the
backend is up.

This deploy uses 2 vCPU / 4 GiB, max 25 instances, concurrency 100, and
**min 0** so idle time is near $0. Do **not** add `--no-cpu-throttling`
(that bills 2 vCPU 24/7, about $110/mo).

```bash
gcloud run deploy js-ml-dashboard \
  --image ${REGION}-docker.pkg.dev/${PROJECT_ID}/js-ml-dashboard/app:latest \
  --region "$REGION" \
  --port 8777 \
  --allow-unauthenticated \
  --cpu 2 \
  --memory 4Gi \
  --timeout 300 \
  --concurrency 100 \
  --min-instances 0 \
  --max-instances 25 \
  --set-env-vars "GROQ_API_KEY=${GROQ_API_KEY},LANGSMITH_API_KEY=${LANGSMITH_API_KEY},LANGSMITH_TRACING=${LANGSMITH_TRACING}"
```

The flag is `--set-env-vars` (not `--set-env`). A single `--set-env-vars A=1,B=2`
**replaces** the whole set. `--update-env-vars` later patches one key.

What the less obvious flags do:

- **`--port 8777`** — Cloud Run sends traffic here and sets `PORT` to match.
  The default is `8080`. Next is hardcoded to 8777. Forgetting this is the
  usual cause of a “successful” deploy that returns 503.
- **`--allow-unauthenticated`** — public site. Without it, only signed-in
  Google users can load the URL. gcloud may prompt to bind `allUsers` as
  `roles/run.invoker`; say yes.
- **`--timeout 300`** — max seconds per request (default 60). Slow endpoints
  (SHAP over many rows) plus Next’s 180s `proxyTimeout` need more than 60s.
- **`--cpu 2 --memory 4Gi`** — sized for this image (same ballpark as a
  typical App Runner config for this app).
- **`--min-instances 0 --max-instances 25 --concurrency 100`** — scale to
  zero when idle. The first request after idle is a cold start (image pull +
  FastAPI + Next). Use `--min-instances 1` later if that bothers you
  (~$35–40/mo at this size).
- **`--set-env-vars …`** — Cloud Run does **not** read the image’s `.env`.
  Keys must be set on the service.

gcloud prints a URL like:

```
https://js-ml-dashboard-<hash>.us-east1.run.app
```

**Verify on that URL before changing DNS.**

1. Open the homepage — the dashboard should render.
2. Confirm the model dropdown populates (homepage “Select a model”). That
   is `GET /api/models` through Next. A working response looks like JSON:
   `{"models":["pharma-tablets_RF", ...]}`.
3. Send a message on the dataset-generator AI assistant (`GROQ_API_KEY`).
4. If pages load but `/api/*` returns `Internal Server Error` or logs show
   `ECONNREFUSED 127.0.0.1:8000`, FastAPI never became ready. Check that the
   image includes the `/health` wait in the start script, then read logs:

   ```bash
   gcloud run services logs read js-ml-dashboard --region "$REGION" --limit 200
   ```

   For a wider window (startup tracebacks are easy to miss in the last 100
   request lines):

   ```bash
   gcloud logging read \
     'resource.type="cloud_run_revision" AND resource.labels.service_name="js-ml-dashboard"' \
     --project "$PROJECT_ID" --limit 200 --freshness=2d \
     --format='value(timestamp,textPayload,jsonPayload.message)'
   ```

   Console path: Cloud Run → `js-ml-dashboard` → **Logs**. There is no SSH /
   `docker exec` on Cloud Run; logs and a local `docker run` of the same
   image are the inspection tools.

A FastAPI-missing-key error is JSON (`{"detail":"GROQ_API_KEY ..."}`). A
plaintext `Internal Server Error` means Next could not reach port 8000 at all.

---

## Step 3 — Point kylecsnow.com at Cloud Run

Google’s fully supported production path is a global HTTPS load balancer in
front of Cloud Run (more parts: IP, NEG, backend, cert, forwarding rule).
Firebase Hosting in front of Cloud Run is another option.

This guide uses **Cloud Run domain mapping**: map a hostname, copy DNS
records, Google manages the cert. It is available in `us-east1`.

From [Google’s domain-mapping docs](https://cloud.google.com/run/docs/mapping-custom-domains):

- Domain mapping is **Preview**, region-limited, and Google currently
  describes it as not production-ready (latency). For a personal site that
  tradeoff is acceptable. If Google withdraws it, switch to Firebase Hosting
  or a load balancer without changing the container.
- SSL is automatic **after** ownership verification and the correct DNS
  records. Typical wait is ~15 minutes; it can take **up to 24 hours**.
- You cannot bring your own certificate on this path.

**Do not CNAME `www` (or anything else) to the `*.run.app` URL.** That
certificate is for `*.run.app`, not `kylecsnow.com`. Browsers get a name
mismatch, and Cloud Run will not route the `Host` header unless a domain
mapping exists. The CNAME target Google gives you is normally
`ghs.googlehosted.com` — copy whatever `describe` prints.

### 3a. Verify domain ownership

Ownership is a Search Console TXT record. It must exist **before** you can
create the mapping. `gcloud domains verify` opens that flow; it does not
buy a domain.

```bash
gcloud domains verify kylecsnow.com
```

Add the **TXT** record at Porkbun (host `@`). Wait until this lists the
domain:

```bash
gcloud domains list-user-verified
```

### 3b. Create the domain mappings

Apex and `www` are separate mappings.

```bash
gcloud beta run domain-mappings create \
  --service js-ml-dashboard \
  --domain kylecsnow.com \
  --region "$REGION"

gcloud beta run domain-mappings create \
  --service js-ml-dashboard \
  --domain www.kylecsnow.com \
  --region "$REGION"
```

Skip the `www` command if that hostname should not be mapped.

### 3c. Read the DNS records Google wants

```bash
gcloud beta run domain-mappings describe \
  --domain kylecsnow.com \
  --region "$REGION"

gcloud beta run domain-mappings describe \
  --domain www.kylecsnow.com \
  --region "$REGION"
```

Add **every** `resourceRecords` row (`A`, `AAAA`, `CNAME`, plus any `TXT`
still listed). Typical *shape* (confirm against the output; IPs change):

| Host | Type | Data |
|---|---|---|
| `@` | **A** | several IPv4 addresses (often `216.239.32.21` / `.34.21` / `.36.21` / `.38.21`) |
| `@` | **AAAA** | matching IPv6 addresses — omit these and some clients never reach the site |
| `www` | **CNAME** | `ghs.googlehosted.com.` |

Copy from `describe`, not from memory. An apex name cannot be a CNAME, which
is why Google uses A/AAAA there. Those mapping IPs are stable, so later
deploys do not require DNS edits.

### 3d. Apply them at Porkbun

Porkbun cannot be edited by `gcloud`. Porkbun → dashboard → `kylecsnow.com`
→ DNS records:

- Delete any old App Runner (or parking) **A** / **ALIAS** / conflicting
  **CNAME** on `@` or `www`. Leaving an old A record (for example
  `52.20.212.203`) makes the old and new sites fight during propagation.
- Add every record from 3c. For `www`, the host is `www` and the value is
  whatever Google printed — **not** the `run.app` URL.

### 3e. Wait for the certificate, then test

```bash
gcloud beta run domain-mappings describe \
  --domain kylecsnow.com \
  --region "$REGION"
```

Look for `CertificateProvisioned` / `Ready` true. Then open
`https://kylecsnow.com` and `https://www.kylecsnow.com`.

DNS TTL can be minutes to a couple of hours. The cert can lag behind DNS.
If an App Runner service is still live, do not delete it until both the
`run.app` URL **and** the custom domain work.

---

## Step 4 — Stop paying for a previous AWS host (if any)

1. Keep the Cloud Run `run.app` URL and the custom domain bookmarked until
   both look correct for a day.
2. Then delete the App Runner service (that is the always-on cost) and the
   ECR repository if it is no longer needed. The AWS account can stay; it
   just should not be serving this site.

---

## Day-2 operations

| Task | Command / place |
|---|---|
| **Redeploy** after a code change | `docker compose up --build`, smoke-test locally, confirm `amd64`, re-tag, `docker push`, re-run the Step 2 `gcloud run deploy` (include `--port 8777` and env vars every time). |
| **Change one env var** | `gcloud run services update js-ml-dashboard --region "$REGION" --update-env-vars GROQ_API_KEY=new-value` (`--set-env-vars` would wipe the others). |
| **Read logs** | Console → Cloud Run → service → **Logs**. CLI: `gcloud run services logs read js-ml-dashboard --region "$REGION"` |
| **Follow logs** | `gcloud run services logs tail js-ml-dashboard --region "$REGION"` |
| **See what is deployed** | `gcloud run services describe js-ml-dashboard --region "$REGION"` |
| **Warm instance** | `--min-instances 1` (~$35–40/mo). Do not add `--no-cpu-throttling` (~$110/mo). |
| **Move the API key to Secret Manager** | Block below. `--set-env-vars` in service metadata is fine for a personal site. |

**Warm instance (optional)** if cold starts are too slow. This bills idle
CPU + memory; it is not the $110 always-allocated-CPU option:

```bash
gcloud run services update js-ml-dashboard \
  --region "$REGION" \
  --min-instances 1
```

**Secret Manager (optional):**

```bash
gcloud services enable secretmanager.googleapis.com

printf '%s' "$GROQ_API_KEY" | gcloud secrets create groq-api-key \
  --replication-policy=automatic \
  --data-file=-

PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
gcloud secrets add-iam-policy-binding groq-api-key \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud run services update js-ml-dashboard \
  --region "$REGION" \
  --set-secrets GROQ_API_KEY=groq-api-key:latest

gcloud run services update js-ml-dashboard \
  --region "$REGION" \
  --remove-env-vars GROQ_API_KEY
```

`--set-secrets` sometimes auto-grants the IAM binding; the explicit binding
above is the reliable version. After the secret is attached, omit
`--set-env-vars GROQ_API_KEY=...` on later deploys or the plaintext value
comes back.

---

## Troubleshooting

1. **Cold starts.** `--min-instances 0` means the first request after idle
   pulls ~2+ GB and boots FastAPI + Next — often 20–60s or more. Cloud Run
   allows **4 minutes** to start listening. Fix: `--min-instances 1`.
2. **`--port 8777` is mandatory** on every deploy. Dropping it yields 503.
3. **`linux/amd64` is mandatory**, especially on Apple Silicon. Inspect
   architecture before push.
4. **`gcloud auth configure-docker` takes `${REGION}-docker.pkg.dev`**
   (for example `us-east1-docker.pkg.dev`), not the bare region `us-east1`.
5. **`$PROJECT_ID` must be set in this shell.** Empty project → `could not
   parse resource []` or `Failed to find attribute [project]`.
6. **UI works, APIs do not.** Pages are Next. `/api/*` is a rewrite to
   FastAPI. `ECONNREFUSED 127.0.0.1:8000` means the start script’s `/health`
   gate failed or the image is old (backend started after Next, or uvicorn
   ran with `reload=True` and never bound). `/health` is **not** rewritten
   (only `/api/*` is), so `https://…/health` on the public URL is a Next 404
   even when FastAPI is healthy. Check `/api/models` instead.
7. **Chat JSON-parse error** (`Unexpected token 'I', "Internal S"...`) is
   the browser parsing plaintext `Internal Server Error` — same backend-down
   failure, not a Groq JSON body.
8. **Missing `GROQ_API_KEY`** (backend *is* up) returns JSON
   `{"detail":"GROQ_API_KEY environment variable is not set."}`. Set the
   var on the Cloud Run service; it is not copied from App Runner or `.env`.
9. **`schemas.db` in production is ephemeral** (same as App Runner). Durable
   schemas/models would be Cloud SQL / GCS — out of scope here.
10. **Cold-start retries.** Cloud Run may retry a request that times out
    during boot. Most endpoints are idempotent GETs; dataset-generator POSTs
    are the exception.
11. **CORS** needs no change while frontend and backend share one host. If
    they are ever split, add the frontend origin to `allow_origins` in
    `main.py`.
12. **Keep registry, service, and domain mapping in `$REGION`.**
13. **Deploy operations:** `gcloud run operations list --region "$REGION"`.

---

## Cost expectations

- **This guide’s config (2 vCPU / 4 GiB, min 0):** near-zero traffic →
  **~$0–1/mo**. Free tier covers rare requests; Artifact Registry storage
  is a few cents (0.5 GB free, then $0.10/GB). The tradeoff is cold starts.
- **$300 credit** (if claimed) is more than enough to try this.
- **`--min-instances 1`** (no `--no-cpu-throttling`): **~$35–40/mo** even
  at zero traffic (idle CPU + memory). App Runner min-1 is often cheaper
  because it bills provisioned memory only.
- **`--min-instances 1 --no-cpu-throttling`:** **~$110/mo**. Do not use it.

---

## Command cheat-sheet (in order)

The gcloud install is the only OS-dependent part (Prerequisites §2). Use
**one shell** so the exports survive.

```bash
# ── one-time setup (gcloud already installed) ──────────────────
gcloud auth login

export PROJECT_ID=js-ml-dashboard    # change if this ID is taken
export REGION=us-east1

gcloud projects create "$PROJECT_ID" --name "js-ml-dashboard"   # skip if it exists
gcloud config set project "$PROJECT_ID"
gcloud config get-value project                                 # must print the ID

gcloud billing accounts list
gcloud billing projects link "$PROJECT_ID" --billing-account=YOUR_ACCOUNT_ID

gcloud services enable artifactregistry.googleapis.com run.googleapis.com

gcloud auth configure-docker "${REGION}-docker.pkg.dev"
gcloud artifacts repositories create js-ml-dashboard \
  --repository-format=DOCKER --location="$REGION"                # skip if it exists

# ── every deploy ───────────────────────────────────────────────
export GROQ_API_KEY=...
export LANGSMITH_API_KEY=...
export LANGSMITH_TRACING=true

docker compose up --build    # smoke-test localhost:8777, then Ctrl+C
docker image inspect js-ml-dashboard-app:latest --format '{{.Architecture}}'   # must be amd64

docker tag js-ml-dashboard-app:latest \
  ${REGION}-docker.pkg.dev/${PROJECT_ID}/js-ml-dashboard/app:latest
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/js-ml-dashboard/app:latest

gcloud run deploy js-ml-dashboard \
  --image ${REGION}-docker.pkg.dev/${PROJECT_ID}/js-ml-dashboard/app:latest \
  --region "$REGION" \
  --port 8777 \
  --allow-unauthenticated \
  --cpu 2 --memory 4Gi \
  --timeout 300 \
  --concurrency 100 \
  --min-instances 0 --max-instances 25 \
  --set-env-vars "GROQ_API_KEY=${GROQ_API_KEY},LANGSMITH_API_KEY=${LANGSMITH_API_KEY},LANGSMITH_TRACING=${LANGSMITH_TRACING}"

# ── custom domain (after the run.app URL works) ────────────────
gcloud domains verify kylecsnow.com
gcloud domains list-user-verified

gcloud beta run domain-mappings create \
  --service js-ml-dashboard --domain kylecsnow.com --region "$REGION"
gcloud beta run domain-mappings create \
  --service js-ml-dashboard --domain www.kylecsnow.com --region "$REGION"

gcloud beta run domain-mappings describe --domain kylecsnow.com --region "$REGION"
gcloud beta run domain-mappings describe --domain www.kylecsnow.com --region "$REGION"
# at Porkbun: remove old A/ALIAS/CNAME conflicts; add exactly the A/AAAA/CNAME rows printed
# (www CNAME is ghs.googlehosted.com — never the *.run.app URL)
```
