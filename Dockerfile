# Multi-stage Dockerfile for NorthEastRiskAI
# Compatible with Hugging Face Spaces (16GB Free Tier), Koyeb, Render, and Local Docker

# ── Stage 1: Build Frontend ──────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

# ── Stage 2: Python Backend Runtime ──────────────────────────────────────────
FROM python:3.11-slim
WORKDIR /app

# Install minimal system tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install production Python dependencies
COPY requirements-prod.txt .
RUN pip install --no-cache-dir -r requirements-prod.txt

# Copy application artifacts
COPY backend/ ./backend/
COPY ml/ ./ml/
COPY models/ ./models/
COPY data/ ./data/

# Copy built frontend distribution
COPY --from=frontend-builder /app/frontend/.output ./frontend/.output

# Default to Hugging Face Spaces port 7860 (overridable via $PORT)
ENV PORT=7860
EXPOSE 7860 5050

CMD ["sh", "-c", "gunicorn -w 2 -b 0.0.0.0:${PORT:-7860} backend.wsgi:app"]
