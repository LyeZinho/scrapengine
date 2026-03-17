# ScrapEngine

A powerful, agnostic web scraping engine with multi-level classification and intelligent data extraction.

## Features

- **Agnostic Extraction**: Extracts data from any website without site-specific configurations
- **Multi-Level Classification**: Automatic categorization into page types, domains, and content types
- **Entity Recognition**: Detects emails, phones, prices, dates, URLs, hashtags, and mentions
- **Smart Cleaning**: Removes ads, trackers, and developer artifacts
- **Deduplication**: Eliminates duplicate content
- **Schema.org Support**: Extracts structured JSON-LD and microdata
- **Rich Metadata**: Captures OpenGraph, Twitter Cards, and meta tags

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     ScrapEngine                             │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐     ┌─────────────┐    ┌─────────────┐     │
│  │  Node.js    │     │   Python    │    │ PostgreSQL  │     │
│  │    API      │◄──► │   Scraper   │    │  Database   │     │
│  │             │     │   Engine    │    │             │     │
│  └─────────────┘     └─────────────┘    └─────────────┘     │
│                             │                               │
│                      ┌──────┴──────┐                        │
│                      │   Redis     │                        │
│                      │    Queue    │                        │
│                      └─────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Docker & Docker Compose
- 4GB RAM minimum

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/scrapengine.git
cd scrapengine

# Start the services
docker compose up -d

# Verify services are running
docker compose ps
```

### Services

| Service | Port | Description |
|---------|------|-------------|
| Node API | 3000 | REST API and job scheduler |
| Python Scraper | 8001 | Web scraping engine |
| PostgreSQL | 5434 | Data storage |
| Redis | 6382 | Job queue |

## API Endpoints

### Extract Full Page Data

```bash
POST /extract
Content-Type: application/json

{
  "url": "https://example.com"
}
```

**Response:**

```json
{
  "url": "https://example.com",
  "meta": {
    "title": "Page Title",
    "description": "Page description",
    "keywords": "keyword1, keyword2",
    "og_title": "OpenGraph Title",
    "og_description": "OpenGraph Description",
    "og_image": "https://example.com/image.jpg",
    "og_type": "website",
    "twitter_card": "summary_large_image"
  },
  "title": "Page Title",
  "description": "Page description",
  "content": {
    "headings": {
      "h1": ["Main Heading"],
      "h2": ["Subheading 1", "Subheading 2"],
      "h3": []
    },
    "paragraphs": ["Paragraph 1", "Paragraph 2"],
    "lists": [["Item 1", "Item 2"]],
    "tables": [],
    "text_raw": "Full article text..."
  },
  "entities": {
    "emails": ["contact@example.com"],
    "phones": ["+1-555-123-4567"],
    "prices": ["$99.99", "€49.99"],
    "dates": ["2024-01-15", "January 15, 2024"],
    "urls": ["https://example.com/page"],
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
    "all": [...],
    "internal": [...],
    "external": [...]
  },
  "schemas": [...],
  "classification": {
    "page_type": "PAGE_TYPE_ARTICLE",
    "domain": "DOMAIN_TECH",
    "content_types": ["CONTENT_HEADING", "CONTENT_TEXT"],
    "confidence": {
      "page_type": 0.85,
      "domain": 0.92
    },
    "all_page_types": {...},
    "all_domains": {...}
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

### Scrape (Legacy)

```bash
POST /scrape
Content-Type: application/json

{
  "url": "https://example.com",
  "schema_type": "JobPosting"
}
```

### Health Check

```bash
GET /health
```

## Classification System

### Page Types

| Type | Description |
|------|-------------|
| `PAGE_TYPE_ARTICLE` | News articles, blog posts |
| `PAGE_TYPE_PRODUCT` | E-commerce product pages |
| `PAGE_TYPE_LISTING` | Search results, directories |
| `PAGE_TYPE_PROFILE` | User/company profiles |
| `PAGE_TYPE_MEDIA` | Images, videos, galleries |
| `PAGE_TYPE_DOCUMENT` | PDFs, downloadable files |
| `PAGE_TYPE_APPLICATION` | Web apps, tools |
| `PAGE_TYPE_UNKNOWN` | Unclassified |

### Domain Categories

| Domain | Keywords |
|--------|----------|
| `DOMAIN_JOB` | job, work, hiring, career, employment |
| `DOMAIN_ECOMMERCE` | shop, buy, cart, price, sale |
| `DOMAIN_REALESTATE` | property, house, apartment, rent |
| `DOMAIN_FINANCE` | bank, investment, stock, crypto |
| `DOMAIN_TECH` | software, developer, code, programming |
| `DOMAIN_TRAVEL` | hotel, flight, booking, vacation |
| `DOMAIN_EDUCATION` | course, learn, tutorial, school |
| `DOMAIN_HEECH` | medical, doctor, hospital, wellness |
| `DOMAIN_SOCIAL` | social, network, forum, community |

### Content Types

| Type | Description |
|------|-------------|
| `CONTENT_HEADING` | Headings (h1-h6) |
| `CONTENT_TEXT` | Paragraphs |
| `CONTENT_LIST` | Ordered/unordered lists |
| `CONTENT_TABLE` | HTML tables |
| `CONTENT_QUOTE` | Blockquotes |
| `CONTENT_CODE` | Code snippets |

## Environment Variables

Create a `.env` file:

```env
# API Ports
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
```

## Development

### Running Locally

```bash
# Install Node dependencies
cd node && npm install

# Install Python dependencies
cd python
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run Node API
cd node && npm run dev

# Run Python API
cd python && python main.py
```

### Building

```bash
# Build all services
docker compose build

# Build specific service
docker compose build python
docker compose build node
```

## Testing

```bash
# Test extract endpoint
curl -X POST http://localhost:8001/extract \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.bbc.com/news"}'

# Test health
curl http://localhost:8001/health
```

## License

MIT License - See LICENSE file for details
