"""FastAPI scraper application."""
import asyncio
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, HttpUrl
from typing import Optional, List, Dict, Any

from src.stealth_async import create_stealth_browser, close_stealth_browser
from src.extractor import SuperExtractor

app = FastAPI(title="ScrapEngine Python")
super_extractor = SuperExtractor()

class ScrapeRequest(BaseModel):
    url: HttpUrl
    schema_type: str = "JobPosting"

class ExtractRequest(BaseModel):
    url: HttpUrl

@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}

@app.post("/extract")
async def extract(request: ExtractRequest) -> Dict:
    playwright, browser, context = await create_stealth_browser()
    
    try:
        page = await context.new_page()
        await asyncio.sleep(1)
        
        response = await page.goto(str(request.url), wait_until="domcontentloaded", timeout=30000)
        
        if response and response.status >= 400:
            raise HTTPException(status_code=response.status, detail=f"HTTP {response.status}")
        
        await asyncio.sleep(2)
        
        result = await super_extractor.extract(page)
        result['url'] = str(request.url)
        result['status_code'] = response.status if response else None
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        await close_stealth_browser(playwright, browser)

@app.post("/scrape")
async def scrape(request: ScrapeRequest) -> List[dict]:
    valid_types = ["JobPosting", "Product", "NewsArticle", "Event"]
    if request.schema_type not in valid_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid schema_type. Must be one of: {valid_types}"
        )
    
    playwright, browser, context = await create_stealth_browser()
    
    try:
        page = await context.new_page()
        
        await asyncio.sleep(1)
        
        response = await page.goto(str(request.url), wait_until="domcontentloaded", timeout=30000)
        
        if response and response.status >= 400:
            raise HTTPException(status_code=response.status, detail=f"HTTP {response.status}")
        
        await asyncio.sleep(2)
        
        result = await super_extractor.extract(page)
        
        schemas = result.get('schemas', [])
        classification = result.get('classification', {})
        
        if schemas:
            return [result]
        
        if result.get('content', {}).get('paragraphs'):
            return [{
                "title": result.get('title', ''),
                "description": result.get('description', ''),
                "category": classification.get('page_type', 'Generic'),
                "text": result.get('content', {}).get('text_raw', ''),
                "url": str(request.url),
            }]
        
        return []
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        await close_stealth_browser(playwright, browser)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7651)
