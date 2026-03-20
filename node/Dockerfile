FROM node:20-alpine AS builder

ARG COOLIFY_URL
ARG COOLIFY_FQDN
ARG ADMIN_API_KEY
ARG NODE_PORT
ARG DB_PASSWORD
ARG POSTGRES_PORT
ARG REDIS_PORT
ARG DATABASE_URL
ARG REDIS_URL
ARG DEFAULT_RATE_LIMIT
ARG WEBHOOK_TIMEOUT_MS
ARG WEBHOOK_MAX_RETRIES
ARG SCRAPE_TIMEOUT
ARG ALLOWED_ORIGINS
ARG COOLIFY_BUILD_SECRETS_HASH
ARG PYTHON_PORT
ARG PYTHON_API_URL
ARG SERVICE_URL_NODE
ARG SERVICE_FQDN_NODE
ARG REDIS_URL

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

RUN mkdir -p dist/db && cp src/db/schema.sql dist/db/

FROM node:20-slim

ARG COOLIFY_URL
ARG COOLIFY_FQDN
ARG ADMIN_API_KEY
ARG NODE_PORT
ARG DB_PASSWORD
ARG POSTGRES_PORT
ARG REDIS_PORT
ARG DATABASE_URL
ARG REDIS_URL
ARG DEFAULT_RATE_LIMIT
ARG WEBHOOK_TIMEOUT_MS
ARG WEBHOOK_MAX_RETRIES
ARG SCRAPE_TIMEOUT
ARG ALLOWED_ORIGINS
ARG COOLIFY_BUILD_SECRETS_HASH
ARG PYTHON_PORT
ARG PYTHON_API_URL
ARG SERVICE_URL_NODE
ARG SERVICE_FQDN_NODE
ARG REDIS_URL

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 \
    libxkbcommon0 \
    libgbm1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libxdamage1 \
    libxrandr2 \
    libpango-1.0-0 \
    libcairo2 \
    libxcomposite1 \
    libdrm2 \
    libxcb1 \
    libx11-6 \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

RUN npx playwright install chromium

COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production

EXPOSE 7650

CMD ["node", "dist/index.js"]
