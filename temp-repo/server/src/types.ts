export type NewsItem = {
  company: string;
  headline: string;
  summary: string;
  date: string; // ISO 8601
  sourceUrl: string;
  sourceLabel: string;
};

export type FeedResponse = {
  news: NewsItem[];
  last_updated: string | null;
};

export type SnapshotRow = {
  id: string;
  news: NewsItem[];
  companies: string[];
  snapshot_date: string;
  created_at: string;
};

// Backward-compatible aliases.
export type CurrentFeedResponse = FeedResponse;
export type HistorySnapshot = SnapshotRow;
