FROM python:3.11-slim

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

# Install system dependencies required by Playwright
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libatspi2.0-0 \
    libwayland-client0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers (chromium only to save space)
RUN playwright install chromium

COPY . .

EXPOSE 7651

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:7651/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7651"]
