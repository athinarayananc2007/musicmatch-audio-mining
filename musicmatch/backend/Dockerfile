# ─────────────────────────────────────────────────────────────────────────────
# MusicMatch Backend — Dockerfile
# Builds a production-ready Python image for the Flask API server.
# ─────────────────────────────────────────────────────────────────────────────

FROM python:3.11-slim

# Install system dependencies:
#   ffmpeg      — universal audio transcoding (WhatsApp, MPEG, OPUS, AAC, etc.)
#   libsndfile1 — soundfile C library required by librosa
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root application user for security
RUN useradd -m -u 1000 appuser

WORKDIR /app

# Copy dependency manifest first (leverages Docker layer cache)
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY . .

# Create the uploads sandbox directory and give it to appuser
RUN mkdir -p uploads && chown -R appuser:appuser /app

USER appuser

# Expose Flask port
EXPOSE 5000

# Health check — Docker will restart the container if /api/health fails
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/api/health')" \
    || exit 1

# Start the Flask server with gunicorn for production
CMD ["python", "-m", "gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--timeout", "120", "app:app"]
