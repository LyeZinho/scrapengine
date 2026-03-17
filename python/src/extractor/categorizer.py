from typing import Dict, List, Any
from collections import defaultdict

class Categorizer:
    PAGE_TYPE_PATTERNS = {
        'PAGE_TYPE_ARTICLE': ['article', 'post', 'blog', 'news', 'story', 'editorial'],
        'PAGE_TYPE_PRODUCT': ['product', 'shop', 'buy', 'cart', 'price', 'add to cart', 'checkout'],
        'PAGE_TYPE_LISTING': ['listing', 'search', 'results', 'directory', 'catalog'],
        'PAGE_TYPE_PROFILE': ['profile', 'user', 'member', 'author', 'bio', 'about'],
        'PAGE_TYPE_MEDIA': ['image', 'photo', 'video', 'gallery', 'media', 'watch'],
        'PAGE_TYPE_DOCUMENT': ['pdf', 'doc', 'document', 'download', 'file'],
        'PAGE_TYPE_APPLICATION': ['app', 'tool', 'calculator', 'converter', 'generator'],
    }
    
    DOMAIN_PATTERNS = {
        'DOMAIN_JOB': ['job', 'work', 'hiring', 'career', 'employment', 'vacancies', 'recruit'],
        'DOMAIN_ECOMMERCE': ['shop', 'store', 'buy', 'sale', 'product', 'cart', 'order'],
        'DOMAIN_REALESTATE': ['real estate', 'property', 'house', 'apartment', 'rent', 'mortgage'],
        'DOMAIN_FINANCE': ['finance', 'bank', 'investment', 'stock', 'crypto', 'trading'],
        'DOMAIN_TECH': ['software', 'developer', 'code', 'github', 'programming', 'tech'],
        'DOMAIN_TRAVEL': ['travel', 'hotel', 'flight', 'booking', 'vacation', 'tourism'],
        'DOMAIN_EDUCATION': ['course', 'learn', 'tutorial', 'school', 'university', 'training'],
        'DOMAIN_HEALTH': ['health', 'medical', 'doctor', 'hospital', 'wellness', 'disease'],
        'DOMAIN_SOCIAL': ['social', 'network', 'community', 'forum', 'chat', 'message'],
    }
    
    CONTENT_PATTERNS = {
        'CONTENT_HEADING': ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'title', 'heading'],
        'CONTENT_TEXT': ['p', 'paragraph', 'text', 'description', 'body'],
        'CONTENT_LIST': ['ul', 'ol', 'li', 'list', 'item'],
        'CONTENT_TABLE': ['table', 'tr', 'td', 'th', 'thead', 'tbody'],
        'CONTENT_QUOTE': ['blockquote', 'quote', 'cite'],
        'CONTENT_CODE': ['code', 'pre', 'script', 'function', 'class'],
    }
    
    def __init__(self):
        self.category_scores = defaultdict(float)
    
    def calculate_score(self, text: str, patterns: Dict[str, List[str]]) -> Dict[str, float]:
        text_lower = text.lower()
        scores = {}
        for category, keywords in patterns.items():
            score = sum(1 for kw in keywords if kw in text_lower)
            if score > 0:
                scores[category] = score / len(keywords)
        return scores
    
    def classify_page_type(self, data: Dict[str, Any]) -> Dict[str, float]:
        text = self._combine_text(data)
        return self.calculate_score(text, self.PAGE_TYPE_PATTERNS)
    
    def classify_domain(self, data: Dict[str, Any]) -> Dict[str, float]:
        text = self._combine_text(data)
        return self.calculate_score(text, self.DOMAIN_PATTERNS)
    
    def classify_content(self, data: Dict[str, Any]) -> Dict[str, Any]:
        content_types = {}
        
        if data.get('h1') or data.get('h2') or data.get('h3'):
            content_types['CONTENT_HEADING'] = 1.0
        
        if data.get('paragraphs') and len(data['paragraphs']) > 0:
            content_types['CONTENT_TEXT'] = 1.0
        
        if data.get('lists'):
            content_types['CONTENT_LIST'] = 1.0
        
        if data.get('tables'):
            content_types['CONTENT_TABLE'] = 1.0
        
        if data.get('quotes'):
            content_types['CONTENT_QUOTE'] = 1.0
        
        if data.get('code'):
            content_types['CONTENT_CODE'] = 1.0
        
        return content_types
    
    def _combine_text(self, data: Dict[str, Any]) -> str:
        parts = [
            data.get('title', ''),
            data.get('description', ''),
            data.get('text', ''),
        ]
        parts.extend(data.get('paragraphs', []))
        parts.extend(data.get('h1', []))
        parts.extend(data.get('h2', []))
        return ' '.join(parts)
    
    def classify(self, data: Dict[str, Any]) -> Dict[str, Any]:
        page_type = self.classify_page_type(data)
        domain = self.classify_domain(data)
        content = self.classify_content(data)
        
        top_page_type = max(page_type.items(), key=lambda x: x[1])[0] if page_type else 'PAGE_TYPE_UNKNOWN'
        top_domain = max(domain.items(), key=lambda x: x[1])[0] if domain else 'DOMAIN_GENERIC'
        
        confidence = {
            'page_type': page_type.get(top_page_type, 0),
            'domain': domain.get(top_domain, 0),
        }
        
        return {
            'page_type': top_page_type,
            'domain': top_domain,
            'content_types': list(content.keys()),
            'confidence': confidence,
            'all_page_types': page_type,
            'all_domains': domain,
        }
