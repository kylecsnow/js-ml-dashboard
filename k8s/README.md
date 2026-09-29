# Kubernetes and Helm

## Seting up kubernetes from scratch

Use `k8s/helm` to start the dashboard (Next.js and FastAPI in one image) and a Postgres StatefulSet (`js-ml-dashboard-db`).
The app uses SQLite when `POSTGRES_*` / `DATABASE_URL` are unset (ex: for local development without k8s, or for running the image in the cloud, like with AWS App Runner). The chart sets those vars, so pods use Postgres.
TODO: Ingress is not in the chart yet.

Requires Docker Desktop Kubernetes (or an equivalent local cluster) and Helm.

Secrets are not in the committed `values.yaml`. Copy the overlay and fill every key (Helm `required` rejects empty strings):

```bash
cp k8s/helm/values.local.yaml.example k8s/helm/values.local.yaml
```

Build the local image (`js-ml-dashboard-app:latest`):

```bash
docker compose build
```

Since Docker Desktop Kubernetes cannot see the local image, tag it and push to Docker Hub so the cluster can pull `kylecsnow/js-ml-dashboard:latest`. The Hub repository must be **public**, or the pods need an `imagePullSecret`. If your Hub username is not `kylecsnow`, change the tag below and `workload.image` in `k8s/helm/values.yaml`.

```bash
docker login
docker tag js-ml-dashboard-app:latest kylecsnow/js-ml-dashboard:latest
docker push kylecsnow/js-ml-dashboard:latest
```

Create the `js-ml-dashboard` repository on [hub.docker.com](https://hub.docker.com) first if the push is rejected. The push is about 7GB, so it can take a while.

Then, create a namespace for the app and install the helm chart with:

```bash
kubectl create namespace js-ml-dashboard

helm install js-ml-dashboard ./k8s/helm -n js-ml-dashboard -f k8s/helm/values.yaml -f k8s/helm/values.local.yaml
```

### To apply chart or values changes without tearing the cluster down:

```bash
helm upgrade js-ml-dashboard ./k8s/helm -n js-ml-dashboard -f k8s/helm/values.yaml -f k8s/helm/values.local.yaml
```

Upon first starting up, pods for the frontend/backend will wait for Postgres (`initContainer`, then Python retries while `database.py` loads) before `/health` can succeed. Kubernetes marks the pod Ready when that probe on port 8000 responds.

### Skip Ingress (for now). Instead, open the app with port forwarding:

```bash
kubectl port-forward -n js-ml-dashboard svc/js-ml-dashboard 8777:8777
```

When complete, open [http://localhost:8777](http://localhost:8777).

### To tear it down:

```bash
helm uninstall js-ml-dashboard -n js-ml-dashboard
kubectl delete namespace js-ml-dashboard
```
