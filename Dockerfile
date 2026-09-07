##############################
########## FRONTEND ##########
##############################
FROM node:20-slim

COPY --from=ghcr.io/astral-sh/uv:0.8.22 /uv /usr/local/bin/uv

# Install Python and required system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-venv \
    build-essential \
    libxrender1 \
    libxext6 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
# don't keep downlaoded wheels in /root/.cache/uv
ENV UV_NO_CACHE=1
COPY pyproject.toml ./
# install project dependencies only, but skip installing this project as a package, so that dependency installs stay in a cacheable layer of the Docker image 
RUN uv sync --python 3.11 --extra cpu --no-dev --no-install-project

# Copy and install frontend dependencies, then build frontend
WORKDIR /app/frontend
COPY frontend/ ./
RUN npm ci
RUN npm run build


#############################
########## BACKEND ##########
#############################
WORKDIR /app/backend
# COPY backend/ ./
COPY backend/main.py ./
COPY backend/chat/ ./chat/
COPY backend/database.py ./
COPY backend/utils.py ./
COPY backend/modeling.py ./
COPY backend/model_training.py ./
COPY backend/molecule_viz.py ./
COPY backend/datasets/ ./datasets/
COPY backend/models/ ./models/
COPY backend/routers/ ./routers/

WORKDIR /app
RUN uv sync --python 3.11 --extra cpu --no-dev


#############################
########## RUN APP ##########
#############################
# Expose ports
EXPOSE 8000 8777

# Create a start script
RUN echo '#!/bin/bash\n\
. /app/.venv/bin/activate\n\
cd /app/backend && python main.py --no-reload &\n\
backend_pid=$!\n\
for i in $(seq 1 90); do\n\
  if ! kill -0 "$backend_pid" 2>/dev/null; then\n\
    echo "Backend exited before becoming ready" >&2\n\
    exit 1\n\
  fi\n\
  if curl -sf http://127.0.0.1:8000/health >/dev/null; then\n\
    break\n\
  fi\n\
  sleep 1\n\
done\n\
if ! curl -sf http://127.0.0.1:8000/health >/dev/null; then\n\
  echo "Backend did not become ready on :8000" >&2\n\
  exit 1\n\
fi\n\
cd /app/frontend && npm run start' > /app/start.sh && \
chmod +x /app/start.sh

WORKDIR /app
CMD ["/app/start.sh"]
