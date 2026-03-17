# ScrapEngine - Complete Documentation

## Table of Contents

1. [Introduction](#introduction)
2. [Architecture](#architecture)
3. [Installation](#installation)
4. [API Reference](#api-reference)
5. [Classification System](#classification-system)
6. [Extraction Pipeline](#extraction-pipeline)
7. [Configuration](#configuration)
8. [Development](#development)
9. [Troubleshooting](#troubleshooting)

---

## Introduction

ScrapEngine is a powerful, agnostic web scraping engine designed to extract maximum data from any website without requiring site-specific configurations. It uses a multi-level classification system to categorize content and employs advanced extraction techniques to minimize data loss.

### Key Capabilities

- **Agnostic Scraping**: Works with any website without custom adapters
- **Intelligent Classification**: Automatically categorizes pages into semantic types
- **Entity Extraction**: Recognizes emails, phones, prices, dates, and more
- **Data Cleaning**: Removes ads, trackers, and developer artifacts
- **Structured Data**: Supports JSON-LD and microdata extraction
- **Metadata Capture**: Extracts OpenGraph, Twitter Cards, and standard meta tags

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     ScrapEngine                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                  Node.js API                        │    │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │    │
│  │  │  REST   │ │ Scheduler│ │  Queue  │ │  Jobs  │  │    │
│  │  │  Routes │ │ Service │ │ Worker  │ │ Service│  │    │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘  │    │
│  └─────────────────────────────────────────────────────┘    │
│                            │                                │
│                            ▼                                │
│  ┌─────────────────────────────────────────────────────┐    │
│  │               Python Scraper Engine                 │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │    │
│  │  │  Playwright │ │   Super     │ │   Normalizer│  │    │
│  │  │   Browser   │ │  Extractor  │ │             │  │    │
│  │  └─────────────┘ └─────────────┘ └─────────────┘  │    │
│  └─────────────────────────────────────────────────────┘    │
│                            │                                │
│              ┌─────────────┼─────────────┐                 │
│              ▼             ▼             ▼                 │
│        ┌─────────┐  ┌─────────┐  ┌─────────┐             │
│        │PostgreSQL│  │  Redis  │  │External │             │
│        │ Database │  │  Queue  │  │   Web   │             │
│        └─────────┘  └─────────┘  └─────────┘             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Components

#### Node.js API (`/node`)

- **REST API**: Exposes endpoints for scraping jobs and source management
- **Job Scheduler**: Manages scraping schedules and triggers
- **Queue Worker**: Processes jobs from Redis queue
- **Database Service**: PostgreSQL integration for storing sources and jobs

#### Python Scraper (`/python`)

- **Stealth Browser**: Playwright-based headless browser with stealth features
- **Super Extractor**: Main extraction engine (see below)
- **Normalizer**: Converts extracted data to standard schemas

### Super Extractor Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                  Super Extractor Pipeline                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │    Stage 1   │───▶│    Stage 2   │───▶│    Stage 3   │ │
│  │    Raw       │    │   Clean &     │    │ Classify &   │ │
│  │   Extract   │    │   Dedupe      │    │  Cluster     │ │
│  └──────────────┘    └──────────────┘    └──────────────┘ │
│         │                   │                   │            │
│         ▼                   ▼                   ▼            │
│  • JSON-LD           • Remove ads         • Correlation    │
│  • Microdata         • Remove trackers     • Multi-label    │
│  • CSS selectors    • Remove dev junk     • Entity extract │
│  • Meta tags        • Deduplicate        • Confidence     │
│  • OpenGraph        • Normalize          • Categories     │
│  • Twitter Cards                                             │
│  • Links                                                     │
│  • Images                                                    │
│  • Text                                                      │
│  • Tables                                                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Installation

### Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- 4GB RAM available
- Ports 3000, 8001, 5434, 6382 available

### Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/scrapengine.git
cd scrapengine

# Start all services
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f
```

### Services

| Service | Internal Port | External Port | Purpose |
|---------|---------------|---------------|---------|
| node | 3000 | 3000 | REST API |
| python | 8000 | 8001 | Scraper Engine |
| postgres | 5432 | 5434 | Database |
| redis | 6379 | 6382 | Queue |

---

## API Reference

### Base URL

```
http://localhost:3000 (Node API)
http://localhost:8001 (Python API - Direct scraping)
```

### Endpoints

#### GET /health

Health check for Python API.

**Response:**
```json
{
  "status": "ok"
}
```

#### POST /extract

Extract complete page data with classification.

**Request:**
```json
{
  "url": "https://example.com"
}
```

**Response:**
```json
{
  "url": "https://example.com",
  "status_code": 200,
  "meta": {
    "title": "Page Title",
    "description": "Page description",
    "keywords": "keyword1, keyword2",
    "author": "Author Name",
    "robots": "index,follow",
    "canonical": "https://example.com/page",
    "og_title": "OpenGraph Title",
    "og_description": "OpenGraph Description",
    "og_image": "https://example.com/image.jpg",
    "og_type": "website",
    "og_url": "https://example.com/page",
    "og_site_name": "Site Name",
    "twitter_card": "summary_large_image",
    "twitter_image": "https://example.com/twitter-image.jpg"
  },
  "title": "Page Title",
  "description": "Page description",
  "content": {
    "headings": {
      "h1": ["Main Heading"],
      "h2": ["Subheading 1", "Subheading 2"],
      "h3": ["Subsubheading"]
    },
    "paragraphs": [
      "First paragraph...",
      "Second paragraph..."
    ],
    "lists": [
      ["Item 1", "Item 2", "Item 3"]
    ],
    "tables": [
      {
        "headers": ["Col1", "Col2"],
        "rows": [["Val1", "Val2"]]
      }
    ],
    "text_raw": "Full raw text content..."
  },
  "entities": {
    "emails": ["contact@example.com"],
    "phones": ["+1-555-123-4567"],
    "prices": ["$99.99", "€49.99"],
    "dates": ["2024-01-15", "January 15, 2024"],
    "urls": ["https://example.com/link"],
    "hashtags": ["#topic"],
    "mentions": ["@username"]
  },
  "media": {
    "images": [
      {
        "src": "https://example.com/image.jpg",
        "alt": "Image description",
        "title": "Image title"
      }
    ]
  },
  "structure": {
    "breadcrumbs": ["Home", "Category", "Page"]
  },
  "links": {
    "all": [{"text": "Link", "href": "https://..."}],
    "internal": [...],
    "external": [...]
  },
  "schemas": [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": "Article Title"
    }
  ],
  "classification": {
    "page_type": "PAGE_TYPE_ARTICLE",
    "domain": "DOMAIN_TECH",
    "content_types": ["CONTENT_HEADING", "CONTENT_TEXT"],
    "confidence": {
      "page_type": 0.85,
      "domain": 0.92
    },
    "all_page_types": {
      "PAGE_TYPE_ARTICLE": 0.5,
      "PAGE_TYPE_MEDIA": 0.3
    },
    "all_domains": {
      "DOMAIN_TECH": 0.8,
      "DOMAIN_EDUCATION": 0.2
    }
  },
  "quality": {
    "word_count": 1250,
    "paragraph_count": 15,
    "heading_count": 8,
    "image_count": 5,
    "link_count": 42,
    "has_schema": true
  }
}
```

#### POST /scrape

Legacy endpoint for schema-specific scraping.

**Request:**
```json
{
  "url": "https://example.com",
  "schema_type": "JobPosting"
}
```

**Supported schema_types:**
- `JobPosting`
- `Product`
- `NewsArticle`
- `Event`

---

## Classification System

### Page Types

The system classifies pages into the following types based on content analysis:

| Type | Description | Keywords |
|------|-------------|----------|
| `PAGE_TYPE_ARTICLE` | News, blog posts | article, post, blog, news, story |
| `PAGE_TYPE_PRODUCT` | E-commerce | product, shop, buy, cart, checkout |
| `PAGE_TYPE_LISTING` | Search results | listing, search, results, directory |
| `PAGE_TYPE_PROFILE` | User profiles | profile, user, member, author |
| `PAGE_TYPE_MEDIA` | Media galleries | image, photo, video, gallery |
| `PAGE_TYPE_DOCUMENT` | Files | pdf, doc, document, download |
| `PAGE_TYPE_APPLICATION` | Web tools | app, tool, calculator, converter |
| `PAGE_TYPE_UNKNOWN` | Unclassified | (fallback) |

### Domain Categories

| Category | Keywords |
|----------|----------|
| `DOMAIN_JOB` | job, work, hiring, career, employment, vacancies, recruit |
| `DOMAIN_ECOMMERCE` | shop, store, buy, sale, product, cart, order |
| `DOMAIN_REALESTATE` | real estate, property, house, apartment, rent, mortgage |
| `DOMAIN_FINANCE` | finance, bank, investment, stock, crypto, trading |
| `DOMAIN_TECH` | software, developer, code, github, programming |
| `DOMAIN_TRAVEL` | travel, hotel, flight, booking, vacation, tourism |
| `DOMAIN_EDUCATION` | course, learn, tutorial, school, university, training |
| `DOMAIN_HEALTH` | health, medical, doctor, hospital, wellness |
| `DOMAIN_SOCIAL` | social, network, community, forum, chat |
| `DOMAIN_GENERIC` | (fallback) |

### Content Types

| Type | Description |
|------|-------------|
| `CONTENT_HEADING` | h1, h2, h3, h4, h5, h6 elements |
| `CONTENT_TEXT` | Paragraphs and text blocks |
| `CONTENT_LIST` | Ordered and unordered lists |
| `CONTENT_TABLE` | HTML tables |
| `CONTENT_QUOTE` | Blockquotes |
| `CONTENT_CODE` | Code snippets |

### Confidence Scoring

Each classification includes a confidence score (0.0 to 1.0):

```json
{
  "confidence": {
    "page_type": 0.85,
    "domain": 0.92
  }
}
```

The `all_page_types` and `all_domains` fields contain scores for all categories, allowing for multi-label classification.

---

## Extraction Pipeline

### Stage 1: Raw Extraction

Extracts all available data from the page:

1. **JSON-LD**: Structured data in `<script type="application/ld+json">`
2. **Microdata**: HTML5 microdata attributes
3. **Meta Tags**: Standard and custom meta tags
4. **OpenGraph**: Facebook OpenGraph tags
5. **Twitter Cards**: Twitter Card metadata
6. **HTML Content**: Headings, paragraphs, lists, tables
7. **Links**: All anchor elements with href, text, title
8. **Images**: Image elements with src, alt, title
9. **Breadcrumbs**: Navigation breadcrumbs
10. **Main Text**: Full text content from article/main elements

### Stage 2: Cleaning & Deduplication

1. **Remove Ads**: Filters out advertisement content
2. **Remove Trackers**: Removes analytics and tracking scripts
3. **Remove Dev Junk**: Removes development artifacts
4. **Deduplicate**: Eliminates duplicate links and text
5. **Normalize**: Standardizes formatting

### Stage 3: Classification

1. **Entity Extraction**: Identifies emails, phones, prices, dates
2. **Page Type Classification**: Determines the type of page
3. **Domain Classification**: Identifies the domain/category
4. **Content Type Detection**: Identifies what content types exist
5. **Confidence Scoring**: Calculates confidence for each classification

---

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# API Ports (use alternatives if defaults are taken)
NODE_PORT=3000
PYTHON_PORT=8001
POSTGRES_PORT=5434
REDIS_PORT=6382

# Database
DB_PASSWORD=scrap123
DATABASE_URL=postgresql://scrapengine:scrap123@localhost:5434/scrapengine
REDIS_URL=redis://localhost:6382

# Python API
PYTHON_API_URL=http://localhost:8001

# Node API
NODE_ENV=development
```

### Docker Compose Override

To override ports, create `docker-compose.override.yml`:

```yaml
services:
  node:
    ports:
      - "9000:3000"
  python:
    ports:
      - "9001:8000"
```

---

## Development

### Local Development

#### Python

```bash
cd python

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
# or: venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt

# Install Playwright browsers
playwright install chromium
playwright install-deps

# Run the server
python main.py
```

#### Node.js

```bash
cd node

# Install dependencies
npm install

# Run in development mode
npm run dev

# Or build and run
npm run build
npm start
```

### Running Tests

```bash
# Test the extract endpoint
curl -X POST http://localhost:8001/extract \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.bbc.com/news"}'

# Test health
curl http://localhost:8001/health
```

---

## Troubleshooting

### Common Issues

#### Port Already in Use

If ports are already in use, the system will automatically try alternative ports. Check the logs:

```bash
docker compose logs
```

#### Playwright Browser Not Found

Rebuild the Python container:

```bash
docker compose build python
docker compose up -d python
```

#### Database Connection Failed

Ensure PostgreSQL is running:

```bash
docker compose ps
docker compose logs postgres
```

#### Memory Issues

Increase Docker memory limit to at least 4GB.

### Debug Mode

Enable debug logging in the Python code:

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

---

## License

MIT License - See LICENSE file for details.
