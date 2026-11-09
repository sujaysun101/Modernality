# ============================================================================
# Lumina Studio — Production Container for Google Cloud Run
# Supports FastAPI + WebSockets (Gemini 3.8 Live) + ffmpeg (Gemini Omni 1.1 Flash)
# ============================================================================
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080 \
    HOST=0.0.0.0

WORKDIR /app

# Install system dependencies (ffmpeg for Gemini Omni 1.1 Flash video audio processing)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install uv for fast, deterministic dependency installation
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy dependency definitions first for layer caching
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# Copy application source
COPY backend ./backend
COPY frontend ./frontend
COPY main.py ./

# Ensure writable data directories for non-root execution on Cloud Run
RUN mkdir -p /app/data/uploads /app/data/media /app/data/kits && chmod -R 777 /app/data

EXPOSE 8080

CMD ["uv", "run", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8080", "--ws", "websockets"]
