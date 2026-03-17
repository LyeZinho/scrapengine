import re
from typing import List, Dict, Any

class EntityExtractor:
    EMAIL_PATTERN = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
    PHONE_PATTERN = r'(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{2,4}[-.\s]?\d{2,4}'
    PRICE_PATTERN = r'[\$£€R\$]?\s?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)'
    DATE_PATTERNS = [
        r'\d{1,2}/\d{1,2}/\d{2,4}',
        r'\d{1,2}-\d{1,2}-\d{2,4}',
        r'\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4}',
        r'(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{2,4}',
    ]
    HASHTAG_PATTERN = r'#[a-zA-Z0-9_]+'
    MENTION_PATTERN = r'@[a-zA-Z0-9_]+'
    URL_PATTERN = r'https?://[^\s<>"{}|\\^`\[\]]+'
    
    def extract_all(self, text: str) -> Dict[str, List[str]]:
        return {
            "emails": self.extract_emails(text),
            "phones": self.extract_phones(text),
            "prices": self.extract_prices(text),
            "dates": self.extract_dates(text),
            "urls": self.extract_urls(text),
            "hashtags": self.extract_hashtags(text),
            "mentions": self.extract_mentions(text),
        }
    
    def extract_emails(self, text: str) -> List[str]:
        return list(set(re.findall(self.EMAIL_PATTERN, text)))
    
    def extract_phones(self, text: str) -> List[str]:
        phones = re.findall(self.PHONE_PATTERN, text)
        return list(set([p[0] if isinstance(p, tuple) else p for p in phones if len(p) > 6]))
    
    def extract_prices(self, text: str) -> List[str]:
        return list(set(re.findall(self.PRICE_PATTERN, text)))
    
    def extract_dates(self, text: str) -> List[str]:
        dates = []
        for pattern in self.DATE_PATTERNS:
            dates.extend(re.findall(pattern, text, re.IGNORECASE))
        return list(set(dates))
    
    def extract_urls(self, text: str) -> List[str]:
        return list(set(re.findall(self.URL_PATTERN, text)))
    
    def extract_hashtags(self, text: str) -> List[str]:
        return list(set(re.findall(self.HASHTAG_PATTERN, text)))
    
    def extract_mentions(self, text: str) -> List[str]:
        return list(set(re.findall(self.MENTION_PATTERN, text)))
