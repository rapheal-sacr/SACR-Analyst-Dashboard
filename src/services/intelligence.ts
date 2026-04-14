export interface CVEItem {
  id: string;
  severity: string;
  cvss: number;
  vendor: string;
  product: string;
  description: string;
  implication: string;
  dateDisclosed: string;
  tags?: string[];
}

export interface ResearchItem {
  title: string;
  source: string;
  url: string;
  category: string;
  summary: string;
  keyTakeaway: string;
  date: string;
  tags?: string[];
}

export interface NewsItem {
  company: string;
  title: string;
  summary: string;
  url: string;
  date: string;
  tags?: string[];
}

export interface FeedData {
  briefing: string | null;
  cves: CVEItem[] | null;
  cveTrendingAcronyms?: string[] | null;
  research: ResearchItem[] | null;
  lastUpdated: string | null;
  history?: any[];
  structuredFeed?: NewsItem[] | null;
  structuredHistory?: { date: string; news: NewsItem[] }[];
  settings?: {
    clients: string[];
    watchlist: string[];
  };
  isGeneratingBackground?: boolean;
}

export async function fetchFeeds(): Promise<FeedData> {
  const res = await fetch('/api/feeds');
  if (!res.ok) {
    throw new Error('Failed to fetch feeds');
  }
  return res.json();
}

export async function triggerGeneration(clients: string[], watchlist: string[]): Promise<FeedData> {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ clients, watchlist }),
  });
  
  if (!res.ok) {
    throw new Error('Failed to generate feeds');
  }
  
  return res.json();
}

export async function saveSettings(clients: string[], watchlist: string[]): Promise<void> {
  const res = await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clients, watchlist })
  });
  if (!res.ok) {
    throw new Error('Failed to save settings');
  }
}
