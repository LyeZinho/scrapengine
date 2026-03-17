"""FastAPI scraper application."""
import asyncio
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, HttpUrl
from typing import Optional, List
from playwright.sync_api import sync_playwright

from src.stealth import create_stealth_browser, close_stealth_browser
from src.extractor import extract_all
from src.normalizer import normalize_batch

app = FastAPI(title="ScrapEngine Python")

class ScrapeRequest(BaseModel):
    url: HttpUrl
    schema_type: str = "JobPosting"

class JobOutput(BaseModel):
    title: str
    company: Optional[str] = None
    description: Optional[str] = None
    url: Optional[str] = None
    location: Optional[str] = None
    remote: bool = False
    job_type: Optional[str] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None

@app.get("/health")
async def health() -> dict:
    """Health check endpoint."""
    return {"status": "ok"}

@app.post("/scrape", response_model=List[JobOutput])
async def scrape(request: ScrapeRequest) -> List[dict]:
    """Scrape a URL and extract structured data."""
    # Validate schema_type
    valid_types = ["JobPosting", "Product", "NewsArticle"]
    if request.schema_type not in valid_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid schema_type. Must be one of: {valid_types}"
        )
    
    playwright, browser, context = create_stealth_browser()
    
    try:
        page = context.new_page()
        
        # Add human-like delay
        await asyncio.sleep(1)
        
        # Navigate to URL
        response = page.goto(str(request.url), wait_until="domcontentloaded", timeout=30000)
        
        if response and response.status >= 400:
            raise HTTPException(status_code=response.status, detail=f"HTTP {response.status}")
        
        # Wait a bit for dynamic content
        await asyncio.sleep(2)
        
        # Extract data using agnostic extractor
        raw_data = extract_all(page, request.schema_type)
        
        # Normalize to standard schema
        jobs = normalize_batch(raw_data, str(request.url))
        
        return [job.model_dump() for job in jobs]
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        close_stealth_browser(playwright, browser)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
