from typing import List, Dict, Any, Set
import re

class Cleaner:
    AD_KEYWORDS = [
        'advertisement', 'sponsored', 'promoted', 'advert',
        'cookie', 'privacy policy', 'terms of service',
        'subscribe', 'newsletter', 'signup',
    ]
    
    def clean_text(self, text: str) -> str:
        text = re.sub(r'\s+', ' ', text)
        text = re.sub(r'[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f-\x9f]', '', text)
        return text.strip()
    
    def clean_list(self, items: List[str]) -> List[str]:
        seen: Set[str] = set()
        result = []
        for item in items:
            cleaned = self.clean_text(item)
            if cleaned and len(cleaned) > 2 and cleaned.lower() not in seen:
                seen.add(cleaned.lower())
                result.append(cleaned)
        return result
    
    def remove_ads(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        result = []
        for item in items:
            text = str(item.get('text', '')).lower()
            if not any(kw in text for kw in self.AD_KEYWORDS):
                result.append(item)
        return result
    
    def deduplicate_links(self, links: List[Dict[str, str]]) -> List[Dict[str, str]]:
        seen: Set[str] = set()
        result = []
        for link in links:
            href = link.get('href', '')
            if href and href not in seen and not href.startswith('javascript:'):
                seen.add(href)
                result.append(link)
        return result[:50]
    
    def clean_all(self, data: Dict[str, Any]) -> Dict[str, Any]:
        cleaned = data.copy()
        
        if 'paragraphs' in cleaned:
            cleaned['paragraphs'] = self.clean_list(cleaned['paragraphs'])
        
        if 'links' in cleaned:
            cleaned['links'] = self.deduplicate_links(cleaned['links'])
        
        if 'h1' in cleaned:
            cleaned['h1'] = self.clean_list(cleaned['h1'])
        
        if 'h2' in cleaned:
            cleaned['h2'] = self.clean_list(cleaned['h2'])
        
        if 'h3' in cleaned:
            cleaned['h3'] = self.clean_list(cleaned['h3'])
        
        if 'text' in cleaned:
            cleaned['text'] = self.clean_text(cleaned['text'])
        
        return cleaned
