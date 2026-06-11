# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — builder
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc g++ libffi-dev libssl-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Install into /install prefix so we can copy cleanly into the runtime stage
RUN pip install --upgrade pip \
 && pip install --no-cache-dir --prefix=/install -r requirements.txt


# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — runtime
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

# Non-root user
RUN addgroup --system app && adduser --system --ingroup app --no-create-home app

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy only runtime source (no test files)
COPY --chown=app:app app/    ./app/
COPY --chown=app:app main.py .

USER app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=25s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

# WORKERS env var lets you override at runtime (default 1)
# NOTE: For multi-worker deployments use gunicorn with uvicorn workers instead of
# uvicorn's built-in --workers flag, which uses fork-based multiprocessing and can
# cause issues with async libraries (motor, beanie) inside containers.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--no-access-log"]
