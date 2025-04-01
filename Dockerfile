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
    # libxrender1 \
    # libxext6 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install frontend dependencies, then build frontend
WORKDIR /app/frontend
COPY frontend/ ./
RUN npm install
RUN npm run build


#############################
########## BACKEND ##########
#############################
WORKDIR /app/backend
COPY backend/ ./

# Create a virtual environment and install Python dependencies
RUN python3 -m venv venv
RUN . venv/bin/activate && pip install --no-cache-dir -r requirements.txt


#############################
########## RUN APP ##########
#############################
# Expose ports
EXPOSE 8000 8777

# Create a start script
RUN echo '#!/bin/bash\n\
. /app/backend/venv/bin/activate\n\
cd /app/frontend && npm run start & \n\
cd /app/backend && python main.py' > /app/start.sh && \
chmod +x /app/start.sh

WORKDIR /app
CMD ["/app/start.sh"]
