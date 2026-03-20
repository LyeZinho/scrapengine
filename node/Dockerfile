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
ARG PYTHON_API_URL
ARG DEFAULT_RATE_LIMIT
ARG WEBHOOK_TIMEOUT_MS
ARG WEBHOOK_MAX_RETRIES
ARG PYTHON_PORT
ARG SCRAPE_TIMEOUT
ARG ALLOWED_ORIGINS
ARG COOLIFY_BUILD_SECRETS_HASH

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

COPY src/db/schema.sql dist/db/

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
ARG PYTHON_API_URL
ARG DEFAULT_RATE_LIMIT
ARG WEBHOOK_TIMEOUT_MS
ARG WEBHOOK_MAX_RETRIES
ARG PYTHON_PORT
ARG SCRAPE_TIMEOUT
ARG ALLOWED_ORIGINS
ARG COOLIFY_BUILD_SECRETS_HASH

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libicu72 \
    libgconf-2-4 \
    libxss1 \
    fonts-liberation \
    libappindicator3-1 \
    libnss3 \
    libxtst6 \
    xdg-utils \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

RUN npx playwright install chromium

COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production

EXPOSE 7650

CMD ["node", "dist/index.js"]
