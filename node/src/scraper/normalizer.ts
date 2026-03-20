interface JobPosting {
  title: string;
  company?: string;
  description?: string;
  url?: string;
  location?: string;
  remote: boolean;
  job_type?: string;
  salary_min?: number;
  salary_max?: number;
}

interface RawData {
  title?: string;
  url?: string;
  hiringOrganization?: { name?: string };
  company?: string;
  application?: { url?: string };
  jobLocation?: unknown;
  location?: string;
  estimatedSalary?: { minValue?: number | string; maxValue?: number | string };
  description?: string;
  jobDescription?: string;
  employmentType?: string;
}

const REMOTE_KEYWORDS = ['remote', 'home', 'anywhere', 'worldwide', 'híbrido', 'hybrid'];

function detectRemote(locationOrValue: string): boolean {
  const value = locationOrValue.toLowerCase();
  return REMOTE_KEYWORDS.some(kw => value.includes(kw));
}

function parseSalary(value: number | string | undefined): number | undefined {
  if (!value) return undefined;
  if (typeof value === 'number') return value;
  const cleaned = value.toString().replace(/\D/g, '');
  return cleaned ? parseInt(cleaned, 10) : undefined;
}

export function normalizeJobPosting(data: RawData, sourceUrl: string): JobPosting | null {
  if (!data.title) return null;

  // Extract company name
  let company: string | undefined;
  if (data.hiringOrganization?.name) {
    company = data.hiringOrganization.name;
  } else if (data.company) {
    company = data.company;
  }

  // Extract URL
  let url = sourceUrl;
  if (data.application?.url) {
    url = data.application.url;
  } else if (data.url) {
    url = data.url;
  }

  // Extract location
  let location: string | undefined;
  if (data.jobLocation) {
    if (Array.isArray(data.jobLocation) && data.jobLocation.length > 0) {
      const firstLoc = data.jobLocation[0];
      if (typeof firstLoc === 'object' && firstLoc !== null) {
        const locObj = firstLoc as Record<string, unknown>;
        location = (locObj.address as Record<string, unknown>)?.addressLocality as string | undefined;
      }
    } else if (typeof data.jobLocation === 'object' && data.jobLocation !== null) {
      const locObj = data.jobLocation as Record<string, unknown>;
      location = (locObj.address as Record<string, unknown>)?.addressLocality as string | undefined;
    }
  } else if (data.location) {
    location = data.location;
  }

  // Parse salary
  const salaryMin = parseSalary(data.estimatedSalary?.minValue);
  const salaryMax = parseSalary(data.estimatedSalary?.maxValue);

  return {
    title: data.title,
    company,
    description: data.description || data.jobDescription,
    url,
    location,
    remote: detectRemote(location || ''),
    job_type: data.employmentType,
    salary_min: salaryMin,
    salary_max: salaryMax,
  };
}

export function normalizeBatch(rawData: RawData[], sourceUrl: string): JobPosting[] {
  const normalized: JobPosting[] = [];

  for (const item of rawData) {
    try {
      const job = normalizeJobPosting(item, sourceUrl);
      if (job) {
        normalized.push(job);
      }
    } catch {
      continue;
    }
  }

  return normalized;
}

export type { JobPosting };
