##############################
########## FRONTEND ##########
##############################
FROM node:20-slim AS frontend

WORKDIR /app/frontend
COPY frontend/ ./
RUN npm ci
RUN npm run build && rm -rf .next/cache


#############################
########## BACKEND ##########
#############################
FROM node:20-slim AS backend

RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY pyproject.toml ./

WORKDIR /app/backend
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

WORKDIR /app
RUN python3 -m venv venv
RUN . venv/bin/activate && pip install --no-cache-dir -r backend/requirements.txt
RUN . venv/bin/activate && python3 -m pip install --no-deps .


#############################
########## RUNTIME ##########
#############################
FROM node:20-slim

RUN apt-get update && apt-get install -y \
    python3 \
    libxrender1 \
    libxext6 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=backend /app/venv /app/venv
COPY --from=backend /app/backend /app/backend

WORKDIR /app/frontend
COPY --from=frontend /app/frontend/.next/standalone ./
COPY --from=frontend /app/frontend/.next/static ./.next/static
COPY --from=frontend /app/frontend/public ./public

COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

EXPOSE 8000 8777
ENV PORT=8777
ENV HOSTNAME=0.0.0.0

WORKDIR /app
CMD ["/app/start.sh"]
