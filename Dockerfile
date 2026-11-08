# Multi-stage production Dockerfile for TerraPulse AI
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend ./backend
COPY frontend/dist ./frontend/dist
COPY data ./data

EXPOSE 8000

ENV APP_HOST=0.0.0.0
ENV APP_PORT=8000
ENV APP_ENV=production

WORKDIR /app/backend
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
