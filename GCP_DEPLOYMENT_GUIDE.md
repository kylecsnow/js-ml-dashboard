# Deploying js-ml-dashboard to kylecsnow.com via Google Cloud Platform

A step-by-step migration guide from AWS (ECR + App Runner) to GCP, written for a
GCP-beginner who is comfortable with the AWS side. Assumption: you run every
command yourself, on the machine that has Docker (the one that currently builds
`kylecsnow/ml-dashboard:latest`).

Run the commands in **one shell session** so the `PROJECT_ID` / `REGION` exports
below stick. If you open a new terminal, export them again.

---

## TL;DR — the recommendation

**Use Cloud Run.** It is GCP's direct App Runner equivalent:

- Push the **same Docker image** to **Artifact Registry** (GCP's ECR).
- Deploy it as a **Cloud Run service** (GCP's App Runner).
- Point **kylecsnow.com** at it (DNS is managed at **Porkbun**, unchanged).
- **Zero code changes required** in this repo.

Why Cloud Run and not the alternatives:

| GCP option | Verdict |
|---|---|
| **Cloud Run** | ✅ Best fit. Runs your existing Docker image, no servers, scales to zero (cheaper than App Runner for a personal site), free tier likely covers all your traffic. |
| Cloud Run Functions / Cloud Functions | ❌ Serverless *functions*, not container hosting — wrong model for this app. |
| App Engine | Possible, but a different runtime model; more rework than Cloud Run. |
| GKE (Kubernetes) | ❌ Massively overkill — you'd be learning an entire orchestration platform for one container. |

### Concept mapping (your existing AWS mental model → GCP)

| AWS (current) | GCP (new) |
|---|---|
| AWS account | GCP **project** (a namespace with its own billing) |
| ECR repository | **Artifact Registry** repository |
| App Runner service | **Cloud Run service** |
| App Runner "Configure service" → env vars | `--set-env-vars` / Secret Manager |
| Custom domain on App Runner | Cloud Run **domain mapping** + DNS records at Porkbun |
| CloudWatch logs | Cloud Run → **Logs** tab (or `gcloud run services logs read`) |
| IAM role for App Runner callers | Not needed for a public site (`--allow-unauthenticated`). Cloud Run still has a default **runtime** service account; you only touch it for secrets. |
| CloudFront / ACM certificate | Automatic, Google-managed — once domain mapping + DNS are correct |

### What I verified about your current setup (why this works with zero code changes)

- `Dockerfile` builds **one image** containing the Next.js frontend (port 8777)
  and the FastAPI backend (port 8000); `start.sh` runs both.
- `frontend/next.config.mjs` rewrites `/api/*` → `http://127.0.0.1:8000/api/*`
  **server-side**, so the browser only ever talks to port 8777. Same-origin
  means **CORS is not involved in production** — the `localhost:8777`
  allowlist in `backend/main.py` is irrelevant once deployed.
- Only one env var is actually read by code: `GROQ_API_KEY`
  (`backend/routers/chat.py`). `OPENAI_API_KEY` sits in `.env` but is unused
  — you don't need to port it. Optional `LANGSMITH_*` from the README is also
  unused unless you want chat tracing.
- Nothing persists to disk in production (the `schemas.db` volume in
  `docker-compose.yml` is local-dev only) — Cloud Run is equally stateless, so
  behavior parity.
- `kylecsnow.com` NS records are at **Porkbun**; the apex currently has an A
  record (`52.20.212.203`) that is your App Runner endpoint.
- Your image is ~2.1 GB. Cloud Run's image limit is 10 GB, so size is fine —
  the push is slow once, and cold starts pull that whole image. Artifact
  Registry's free storage tier is 0.5 GB, so you will pay a few cents/month
  to store it.

---

## Prerequisites

### 1. Google account + billing

Sign in at <https://console.cloud.google.com> with your personal Google
account. Create a **billing account** (credit card) and claim the
**$300 / 90-day new-customer credit** if you are eligible.

Creating a billing account on your Google login is **not** enough by itself.
You still have to **link that billing account to the project** in step 3b
below, or Artifact Registry and Cloud Run will refuse to enable.

### 2. gcloud CLI (GCP's `aws` CLI)

This install is the **only OS-dependent step** in the whole guide — pick the
block for your machine. Everything after it (project, docker push, deploy,
DNS) is identical on both.

**🍎 macOS (Apple Silicon or Intel) — via Homebrew.** No `sudo` needed;
Homebrew handles the `PATH`.

```bash
# one-time: install Homebrew first if you don't have it (most Macs do)
# /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

brew install --cask gcloud-cli
gcloud --version          # prints a version → good
```

**🐧 Linux (Debian / Ubuntu) — via the apt repo.** Uses `sudo`. Verified
against the official Google docs. The **old one-line `install.sh` URL is dead
— do not use it.**

```bash
# 1. one-time prereqs
sudo apt-get update
sudo apt-get install ca-certificates gnupg curl

# 2. import the Google Cloud public key
curl https://packages.cloud.google.com/apt/doc/apt-key.gpg \
  | sudo gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg

# 3. add the gcloud package source
echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" \
  | sudo tee -a /etc/apt/sources.list.d/google-cloud-sdk.list

# 4. update + install
sudo apt-get update && sudo apt-get install google-cloud-cli
gcloud --version          # prints a version → good
```

*Other distros (RHEL/Fedora/CentOS, older Debian):* Google ships a
`yum`/`dnf` variant on <https://cloud.google.com/sdk/docs/install>. If you're
on a non-Ubuntu box, tell me the distro and I'll paste the exact block.

### 3. Create a project, link billing, enable APIs

Do project creation in one place — CLI or console, not both.

```bash
gcloud auth login

# Project IDs are *globally* unique across all of GCP. If create fails with
# "already exists" / "project ID not available", change PROJECT_ID to
# something like kylecsnow-ml-dashboard and use that value for the rest of
# this guide (image URLs include the project ID).
export PROJECT_ID=js-ml-dashboard
export REGION=us-east1

gcloud projects create "$PROJECT_ID" --name "js-ml-dashboard"
gcloud config set project "$PROJECT_ID"
```

> GCP beginners: in the **console**, the top-left dropdown is the project
> switcher. Make sure it shows **this** `$PROJECT_ID` whenever you work in GCP
> — most "it can't find my thing" confusion comes from the wrong project
> being selected.

**3b. Link billing to the new project** (required — `projects create` does
not do this):

```bash
gcloud billing accounts list
# copy the ACCOUNT_ID (looks like 0X0X0X-0X0X0X-0X0X0X)

gcloud billing projects link "$PROJECT_ID" \
  --billing-account=YOUR_ACCOUNT_ID
```

**3c. Enable the APIs this deploy uses** (also required — a new project has
them off):

```bash
gcloud services enable \
  artifactregistry.googleapis.com \
  run.googleapis.com
```

Wait until that command finishes (a minute or two). If it errors about
billing, 3b did not stick.

`gcloud auth application-default login` is **not** needed for this guide.
That is for local client libraries. Docker push and `gcloud run deploy` use
the user credentials from `gcloud auth login`.

### 4. Pick one region and use it everywhere: `us-east1`

`us-east1` is **Moncks Corner, South Carolina** — a large, well-supported
region, and one of the regions where Cloud Run **domain mapping** is
available.

It is **not** Northern Virginia. GCP's N. Virginia region (the geographic
cousin of AWS `us-east-1`) is `us-east4`. Either works for this app; this
guide uses `us-east1` because domain mapping is supported there and every
command below already names it. Do not mix regions later (registry in one
place, service in another) — that adds latency and cross-region egress.

---

## Step 1 — Push the image to Artifact Registry

`gcloud auth configure-docker` handles the registry login (the ECR
`get-login-password` dance, but simpler). The argument is a **hostname**,
not a region name.

**First time only — Docker login + create the repository:**

```bash
gcloud auth configure-docker "${REGION}-docker.pkg.dev"
gcloud artifacts repositories create js-ml-dashboard \
  --repository-format=DOCKER \
  --location="$REGION"
```

`us-east1` alone is wrong here. Docker would register a helper for the host
`us-east1`, then `docker push` to `us-east1-docker.pkg.dev` would fail with
unauthorized / denied.

**Then build, tag, and push (every deploy):**

Cloud Run only runs **`linux/amd64`**. `docker-compose.yml` already sets
`platform: linux/amd64` for that reason. A plain `docker build` on an
Apple Silicon Mac produces `linux/arm64`, which Cloud Run will reject
(`exec format error`). Always pass `--platform linux/amd64`, including on
Intel Macs and Linux — it is the correct target.

```bash
# Skip the build if you already have an *amd64* image locally
docker build --platform linux/amd64 -t kylecsnow/ml-dashboard:latest .

# Safety check — must print amd64. If it prints arm64, do not push.
docker image inspect kylecsnow/ml-dashboard:latest --format '{{.Architecture}}'

docker tag kylecsnow/ml-dashboard:latest \
  ${REGION}-docker.pkg.dev/${PROJECT_ID}/js-ml-dashboard/app:latest

docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/js-ml-dashboard/app:latest
```

> Artifact Registry image names are
> `<region>-docker.pkg.dev/<project>/<repository>/<image>:<tag>` —
> different shape from ECR's `<acct>.dkr.ecr.<region>.amazonaws.com/...`, so
> don't guess it; copy the pattern above. If you had to change `PROJECT_ID`,
> the URL changes with it.

---

## Step 2 — Deploy the Cloud Run service

One command, and this is also your **redeploy command** (it's idempotent —
re-running it updates the service).

Make sure `GROQ_API_KEY` is in this shell first (`export GROQ_API_KEY=...`
from the repo `.env`).

```bash
gcloud run deploy js-ml-dashboard \
  --image ${REGION}-docker.pkg.dev/${PROJECT_ID}/js-ml-dashboard/app:latest \
  --region "$REGION" \
  --port 8777 \
  --allow-unauthenticated \
  --cpu 1 \
  --memory 2Gi \
  --timeout 300 \
  --set-env-vars GROQ_API_KEY="$GROQ_API_KEY"
```

The documented flag is `--set-env-vars` (not `--set-env`). `--set-env-vars`
**replaces** the whole env-var set on that revision — fine here because
there is only one.

What each non-obvious flag does (these are the ones that bite beginners):

- **`--port 8777`** — Cloud Run sends traffic to this port and sets `PORT`
  to match. The default is `8080`. Your app ignores `PORT` and Next is
  hardcoded to 8777 (`npm run start` / `package.json`), so you **must**
  tell Cloud Run to route to 8777. Forgetting this is the #1 cause of a
  "successful" deploy that returns 503.
- **`--allow-unauthenticated`** — makes the service public (anyone can
  browse it). This is what you want for a public personal site. Without it,
  only signed-in Google users can access the URL. gcloud may prompt to bind
  `allUsers` as `roles/run.invoker`; say yes.
- **`--timeout 300`** — max seconds a single request may run (default 60).
  Your slow endpoints (SHAP over many rows; Next's `proxyTimeout` is 3
  minutes) need more than 60s, so 300 keeps Cloud Run from killing them
  while Next still has a 180s inner timeout.
- **`--set-env-vars GROQ_API_KEY=...`** — the App Runner "add env var in
  Configure service" equivalent. Sourced from your shell so the key isn't
  typed literally.
- **`--cpu 1 --memory 2Gi`** — generous defaults for Next + FastAPI +
  models in RAM. Do not drop to `--cpu 0.5 --memory 1Gi` without testing;
  Cloud Run rejects some CPU/memory pairings, and 1 GiB is tight for this
  image.

At the end, gcloud prints your public URL, shaped like:

```
https://js-ml-dashboard-<random-hash>.us-east1.run.app
```

**Verify before touching DNS:**

1. Open the URL — the dashboard should render.
2. Hit an API route through the frontend (e.g. open a model page).
3. Test the dataset-generator AI chat (this is the `GROQ_API_KEY` path).
4. If something's wrong:

   ```bash
   gcloud run services logs read js-ml-dashboard --region "$REGION" --limit 100
   ```

   Or: console → Cloud Run → `js-ml-dashboard` → **Logs**. That is the
   container's stdout/stderr (uvicorn + Next).

---

## Step 3 — Point kylecsnow.com at it

Cloud Run can serve `kylecsnow.com` in a few ways. Google's **GA /
recommended** production path is a global external HTTPS load balancer in
front of Cloud Run (more moving parts: IP, NEG, backend, cert, forwarding
rule). **Firebase Hosting** in front of Cloud Run is another supported
option.

This guide uses **Cloud Run domain mapping** instead: it is the closest
App Runner equivalent (map a hostname, copy DNS records, Google manages
the cert). It is available in `us-east1`.

Caveats, from [Google's current docs](https://cloud.google.com/run/docs/mapping-custom-domains):

- Domain mapping is **Preview**, region-limited, and Google currently
  describes it as not production-ready (latency). For a personal site that
  is the acceptable tradeoff; if Google ever withdraws it, switch to
  Firebase Hosting or a load balancer without changing the container.
- SSL is automatic **after** ownership verification + the right DNS
  records. Typical wait is ~15 minutes; it can take **up to 24 hours**.
- You cannot bring your own certificate on this path.

**Do not CNAME `www` (or anything else) to the `*.run.app` URL.** That
certificate is for `*.run.app`, not `kylecsnow.com`. Browsers get a name
mismatch, and Cloud Run will not route the `Host` header unless a domain
mapping exists. The CNAME target Google gives you is normally
`ghs.googlehosted.com` — but copy whatever `describe` prints, do not
invent records.

### 3a. Verify you own kylecsnow.com

Ownership verification is a **Search Console TXT record**, and it has to
happen **before** (or as the first part of) mapping. It is not a "click
Verify after adding A records" step at the end.

```bash
gcloud domains verify kylecsnow.com
```

That opens Search Console. Add the **TXT** record it shows at Porkbun
(host `@`). Wait until this lists the domain:

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

Skip the `www` command if you want www to stay broken (as it is on AWS
today).

### 3c. Read the DNS records Google actually wants

```bash
gcloud beta run domain-mappings describe \
  --domain kylecsnow.com \
  --region "$REGION"

gcloud beta run domain-mappings describe \
  --domain www.kylecsnow.com \
  --region "$REGION"
```

You need **every** `resourceRecords` row (`A`, `AAAA`, `CNAME`, plus any
`TXT` still listed). Typical *shape* (confirm against the output; IPs
change):

| Host | Type | Data |
|---|---|---|
| `@` | **A** | several IPv4 addresses (classically `216.239.32.21` / `.34.21` / `.36.21` / `.38.21`) |
| `@` | **AAAA** | matching IPv6 addresses — add these too or some clients never reach you |
| `www` | **CNAME** | `ghs.googlehosted.com.` |

Console equivalent: Cloud Run → **Domain mappings** → Add mapping → pick
the service → **Cloud Run Domain Mappings**. Then ⋮ → **DNS records**.
Prefer the CLI output if the two disagree.

### 3d. Apply them at Porkbun (GCP cannot touch your DNS)

Porkbun → dashboard → `kylecsnow.com` → DNS records:

- **Delete** the old A record `52.20.212.203` (App Runner). If you leave
  it, the old and new sites fight during propagation.
- Delete any leftover parking / ALIAS / conflicting A or CNAME on `@` or
  `www`.
- **Add** every record from 3c. For `www`, the host is `www` and the
  value is whatever Google printed — **not** the `run.app` URL.

### 3e. Wait for the certificate, then test

```bash
gcloud beta run domain-mappings describe \
  --domain kylecsnow.com \
  --region "$REGION"
```

Look for `CertificateProvisioned` / `Ready` true. Then hit
`https://kylecsnow.com` and `https://www.kylecsnow.com`.

DNS TTL can be minutes to a couple of hours. The cert can lag behind DNS.
Do not delete App Runner until both the `run.app` URL **and** the custom
domain work.

> Why the apex uses A/AAAA instead of a CNAME: an apex name cannot be a
> CNAME. Google's mapping IPs are stable, so you do not update DNS on
> future deploys (unlike App Runner, where the endpoint IP can change).

---

## Step 4 — Cut over & stop paying for AWS

1. Let the GCP-served site run for a day; you can even bookmark both the
   `run.app` URL and the domain to compare.
2. When it's good: **App Runner → delete the service** (this is the
   always-on cost center) and delete the ECR repo if you like. Keep the AWS
   account; just stop using it.

---

## Day-2 operations (your App Runner habits → GCP equivalents)

| You want to… | Do this |
|---|---|
| **Redeploy** (after a code change) | Rebuild with `--platform linux/amd64`, re-tag, `docker push`, then re-run the exact `gcloud run deploy` command from Step 2. It updates the existing service. |
| **Change an env var** | `gcloud run services update js-ml-dashboard --region "$REGION" --update-env-vars GROQ_API_KEY=new-value` (`--update-env-vars` patches one key; `--set-env-vars` would wipe any others). |
| **Read logs** | Console → Cloud Run → service → **Logs**. CLI: `gcloud run services logs read js-ml-dashboard --region "$REGION"` |
| **See what's deployed** | `gcloud run services describe js-ml-dashboard --region "$REGION"` |
| **Scale / cold starts** | Default is min-instances 0 (scale to zero). See the gotcha below before turning on a warm instance. |
| **Move the API key to Secret Manager** | See the block under this table. `--set-env-vars` stores the value in service metadata, which is fine for a personal site; Secret Manager is the "proper" path. |

**Warm instance (optional).** `--min-instances 1` alone keeps an instance
resident with CPU throttled while idle (request-based billing). That skips
the 2.1 GB image pull; the first request still pays a short unthrottle.
To keep CPU allocated the whole time you also need instance-based billing:

```bash
gcloud run services update js-ml-dashboard \
  --region "$REGION" \
  --min-instances 1 \
  --no-cpu-throttling
```

That second form is true always-on and costs on the order of **tens of
dollars/month** at 1 vCPU / 2Gi, not $10. Leave min-instances at 0 unless
cold starts bother you.

**Secret Manager (optional).** Enable the API, create the secret, grant the
Cloud Run runtime service account access, then point the service at it:

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
above is the reliable version. Removing the env var after the secret is
attached avoids setting the same key twice. On later deploys, omit
`--set-env-vars GROQ_API_KEY=...` or you will put the plaintext value back.

---

## Gotchas & known differences vs App Runner

1. **Cold starts are real.** With min-instances 0, the first request after
   idle has to pull ~2.1 GB and boot Next + FastAPI. That is often **well
   over 20–60s**; Cloud Run gives the instance **4 minutes** to start
   listening. App Runner has cold starts too, but Cloud Run's
   scale-to-zero is more aggressive. See Day-2 for `--min-instances 1`.
2. **`--port 8777` is mandatory** (see Step 2). Every future deploy needs
   it too — if you copy-paste an old command and drop it, you'll get a 503.
3. **`--platform linux/amd64` is mandatory** (especially on Apple Silicon).
   Check with `docker image inspect … --format '{{.Architecture}}'` before
   pushing.
4. **`gcloud auth configure-docker` takes `${REGION}-docker.pkg.dev`**
   (e.g. `us-east1-docker.pkg.dev`), not the bare region name `us-east1`.
5. **Statelessness is parity, not a regression.** `schemas.db` written by
   the dataset-generator in production is ephemeral (same as App Runner).
   If you ever want durable schemas/models, that's a Cloud SQL / GCS
   project — out of scope here.
6. **Cold-start retries:** Cloud Run may retry a request that times out
   during boot. Harmless for a personal site; your endpoints are mostly
   idempotent GETs (the dataset-generator POSTs are the exception — another
   reason the optional warm instance is nice).
7. **Optional cleanup you can skip:** `backend/main.py` runs uvicorn with
   `reload=True` in production — it works (it works on App Runner today)
   but burns a little CPU watching files. If you ever touch that file, set
   `reload=False` for prod.
8. **CORS:** no change needed today (same-origin in prod). If you ever
   split frontend and backend onto different hosts, add that host to
   `allow_origins` in `main.py`.
9. **Project/region consistency:** registry, service, and domain mapping
   should all stay in `$REGION` (`us-east1` in this guide). Mixing regions
   "works" but adds latency and cross-region egress.
10. **If a deploy misbehaves:** `gcloud run services logs read
    js-ml-dashboard --region "$REGION"` (container output) and
    `gcloud run operations list --region "$REGION"` (deploy operations).
    This is the equivalent of App Runner's service logs page.

---

## Cost expectations

- **$300 credit** (if you claimed it) covers the first 90 days of eligible
  usage.
- **Steady state with min-instances 0:** Cloud Run's free tier (a couple
  million requests/mo + generous CPU-seconds + a chunk of egress) will
  almost certainly cover a personal site. Artifact Registry storage for a
  2.1 GB image is a few cents/month over the 0.5 GB free storage tier.
  Treat it as **~$0/mo**, not a hard zero.
- **With `--min-instances 1 --no-cpu-throttling`:** on the order of **tens
  of dollars/month** at 1 vCPU / 2Gi, because you pay for the instance
  sitting there. `--min-instances 1` *without* `--no-cpu-throttling` is
  cheaper (idle rate) and still avoids the image pull.
- **Comparison:** App Runner bills for always-on time + requests even with
  zero traffic, so GCP should be equal or cheaper at min-instances 0.

---

## Full command cheat-sheet (in order)

> The gcloud CLI *install* is the only OS-dependent part — see
> **Prerequisites #2** (🍎 macOS / 🐧 Linux). Everything below is identical
> on both. Use **one shell** so the exports survive.

```bash
# ── one-time setup (gcloud CLI already installed, per Prereq #2) ─────
gcloud auth login

export PROJECT_ID=js-ml-dashboard    # change this if project create says the ID is taken
export REGION=us-east1

gcloud projects create "$PROJECT_ID" --name "js-ml-dashboard"   # skip if it already exists
gcloud config set project "$PROJECT_ID"

gcloud billing accounts list
gcloud billing projects link "$PROJECT_ID" --billing-account=YOUR_ACCOUNT_ID

gcloud services enable artifactregistry.googleapis.com run.googleapis.com

gcloud auth configure-docker "${REGION}-docker.pkg.dev"
gcloud artifacts repositories create js-ml-dashboard \
  --repository-format=DOCKER --location="$REGION"                # skip if it already exists

# ── every deploy ───────────────────────────────────────────────
export GROQ_API_KEY=...   # from the repo .env, if not already in the shell

docker build --platform linux/amd64 -t kylecsnow/ml-dashboard:latest .
docker image inspect kylecsnow/ml-dashboard:latest --format '{{.Architecture}}'   # must be amd64

docker tag kylecsnow/ml-dashboard:latest \
  ${REGION}-docker.pkg.dev/${PROJECT_ID}/js-ml-dashboard/app:latest
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/js-ml-dashboard/app:latest

gcloud run deploy js-ml-dashboard \
  --image ${REGION}-docker.pkg.dev/${PROJECT_ID}/js-ml-dashboard/app:latest \
  --region "$REGION" \
  --port 8777 \
  --allow-unauthenticated \
  --cpu 1 --memory 2Gi \
  --timeout 300 \
  --set-env-vars GROQ_API_KEY="$GROQ_API_KEY"

# ── custom domain (after the run.app URL works) ────────────────
gcloud domains verify kylecsnow.com          # Search Console TXT at Porkbun first
gcloud domains list-user-verified

gcloud beta run domain-mappings create \
  --service js-ml-dashboard --domain kylecsnow.com --region "$REGION"
gcloud beta run domain-mappings create \
  --service js-ml-dashboard --domain www.kylecsnow.com --region "$REGION"

gcloud beta run domain-mappings describe --domain kylecsnow.com --region "$REGION"
gcloud beta run domain-mappings describe --domain www.kylecsnow.com --region "$REGION"
# at Porkbun: delete A 52.20.212.203; add *exactly* the A/AAAA/CNAME rows printed
# (www CNAME is ghs.googlehosted.com — never the *.run.app URL)
```
