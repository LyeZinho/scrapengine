"""Agnostic extractor with JSON-LD, microdata, and heuristics."""
import json
from typing import List, Dict, Any
from playwright.sync_api import Page

def extract_json_ld(page: Page) -> List[Dict[str, Any]]:
    """Extract JSON-LD structured data."""
    json_ld_scripts = page.query_selector_all('script[type="application/ld+json"]')
    
    results = []
    for script in json_ld_scripts:
        try:
            content = script.inner_text()
            data = json.loads(content)
            
            # Handle @graph (multiple items)
            if isinstance(data, dict) and '@graph' in data:
                results.extend(data['@graph'])
            elif isinstance(data, list):
                results.extend(data)
            else:
                results.append(data)
        except json.JSONDecodeError:
            continue
    
    return results

def filter_by_type(data: List[Dict], schema_type: str) -> List[Dict]:
    """Filter JSON-LD by schema type."""
    filtered = []
    for item in data:
        item_type = item.get('@type', '')
        if isinstance(item_type, list):
            if schema_type in item_type:
                filtered.append(item)
        elif item_type == schema_type:
            filtered.append(item)
    return filtered

def extract_all(page: Page, schema_type: str) -> List[Dict[str, Any]]:
    """Main extraction function with fallback priority."""
    # Priority 1: JSON-LD
    json_ld_data = extract_json_ld(page)
    filtered = filter_by_type(json_ld_data, schema_type)
    if filtered:
        return filtered
    
    # Priority 2: Microdata (basic implementation)
    microdata = page.evaluate('''() => {
        const items = document.querySelectorAll('[itemscope]');
        return Array.from(items).map(item => {
            const result = {};
            const props = item.querySelectorAll('[itemprop]');
            props.forEach(prop => {
                result[prop.getAttribute('itemprop')] = prop.textContent.trim();
            });
            return result;
        });
    }''')
    if microdata:
        return microdata
    
    return []
