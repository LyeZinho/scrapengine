FROM mcr.microsoft.com/playwright/python:v1.40.0-jammy

# Coolify build arguments
ARG COOLIFY_URL
ARG COOLIFY_FQDN
ARG ADMIN_API_KEY
ARG NODE_PORT
ARG DB_PASSWORD
ARG POSTGRES_PORT
ARG REDIS_PORT
ARG DATABASE_URL
ARG REDIS_URL
ARG PYTHON_API_URL
ARG DEFAULT_RATE_LIMIT
ARG WEBHOOK_TIMEOUT_MS
ARG WEBHOOK_MAX_RETRIES
ARG PYTHON_PORT
ARG SCRAPE_TIMEOUT
ARG ALLOWED_ORIGINS
ARG COOLIFY_BUILD_SECRETS_HASH

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 7651

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:7651/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7651"]
