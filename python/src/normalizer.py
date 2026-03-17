"""Data normalizer for standard schema."""
import re
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime

class JobPosting(BaseModel):
    """Normalized JobPosting schema."""
    title: str
    company: Optional[str] = None
    description: Optional[str] = None
    url: Optional[str] = None
    location: Optional[str] = None
    remote: bool = False
    job_type: Optional[str] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None

def normalize_jobposting(data: Dict[str, Any], source_url: str = "") -> Optional[JobPosting]:
    """Normalize JobPosting data to standard schema."""
    if not data.get('title'):
        return None
    
    # Extract company name
    company = None
    if 'hiringOrganization' in data:
        company = data['hiringOrganization'].get('name')
    elif 'company' in data:
        company = data['company']
    
    # Extract URL
    url = data.get('url') or data.get('application', {}).get('url') or source_url
    
    # Extract location
    location = None
    if 'jobLocation' in data:
        location = data['jobLocation'].get('address', {}).get('addressLocality')
    elif 'location' in data:
        location = data['location']
    
    # Detect remote
    remote = detect_remote(location or '')
    
    # Parse salary
    salary_min = None
    salary_max = None
    if 'estimatedSalary' in data:
        salary_min = parse_salary(data['estimatedSalary'].get('minValue'))
        salary_max = parse_salary(data['estimatedSalary'].get('maxValue'))
    
    return JobPosting(
        title=data.get('title', ''),
        company=company,
        description=data.get('description') or data.get('jobDescription'),
        url=url,
        location=location,
        remote=remote,
        job_type=data.get('employmentType'),
        salary_min=salary_min,
        salary_max=salary_max,
    )

def detect_remote(location_or_value: str) -> bool:
    """Detect if job is remote."""
    remote_keywords = ['remote', 'home', 'anywhere', 'worldwide', 'híbrido', 'hybrid']
    value = str(location_or_value).lower()
    return any(kw in value for kw in remote_keywords)

def parse_salary(value: Any) -> Optional[int]:
    """Parse salary to integer."""
    if not value:
        return None
    if isinstance(value, (int, float)):
        return int(value)
    if isinstance(value, str):
        cleaned = re.sub(r'[^\d]', '', value)
        return int(cleaned) if cleaned else None
    return None

def normalize_batch(raw_data: List[Dict], source_url: str = "") -> List[JobPosting]:
    """Normalize a batch of raw job data."""
    normalized = []
    for item in raw_data:
        try:
            job = normalize_jobposting(item, source_url)
            if job:
                normalized.append(job)
        except Exception:
            continue
    return normalized
