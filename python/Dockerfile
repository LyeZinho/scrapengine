FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    gnupg \
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
    && rm -rf /var/lib/apt/lists/*

ENV PATH=/home/appuser/.local/bin:$PATH

RUN useradd -m appuser && chown -R appuser:appuser /app

USER appuser

RUN pip install --no-cache-dir --user playwright==1.40.0

RUN playwright install chromium

COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

COPY . .

EXPOSE 7651

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:7651/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7651"]
