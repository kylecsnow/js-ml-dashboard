##############################
########## FRONTEND ##########
##############################
FROM node:20-slim

# Install Python and required system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
    libxrender1 \
    libxext6 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY pyproject.toml ./

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
COPY backend/requirements.txt ./
COPY backend/datasets/ ./datasets/
COPY backend/models/ ./models/
COPY backend/routers/ ./routers/

# Create a virtual environment and install Python dependencies
WORKDIR /app
RUN python3 -m venv venv
RUN . venv/bin/activate && pip install --no-cache-dir -r backend/requirements.txt
RUN . venv/bin/activate && python3 -m pip install --no-deps .


#############################
########## RUN APP ##########
#############################
# Expose ports
EXPOSE 8000 8777

# Create a start script
RUN echo '#!/bin/bash\n\
. /app/venv/bin/activate\n\
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
