# Multi-stage production Dockerfile for TerraPulse AI

# Stage 1: Build Frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# Stage 2: Python Backend & Final Image
FROM python:3.11-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend ./backend
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist
COPY --from=frontend-builder /app/frontend/dist ./backend/static_dist

# Copy bundled data samples and trained models
COPY data/sample_parquet ./data/sample_parquet
COPY data/Derived/models ./data/Derived/models

# Ensure writable runtime data directories exist
RUN mkdir -p /app/data/Derived/models /app/data/MOD13C2_Parquet

EXPOSE 8000

ENV APP_HOST=0.0.0.0
ENV APP_PORT=8000
ENV APP_ENV=production

WORKDIR /app/backend
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
