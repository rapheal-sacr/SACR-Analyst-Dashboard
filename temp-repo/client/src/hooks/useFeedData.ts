import { useEffect, useState } from "react";

import { apiUrl } from "../lib/apiUrl";
import type { FeedResponse, NewsItem } from "../types";

type UseFeedDataResult = {
  news: NewsItem[];
  lastUpdated: string | null;
  companies: string[];
  loading: boolean;
  error: string | null;
};

export function useFeedData(): UseFeedDataResult {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [companies, setCompanies] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const fetchFeed = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(apiUrl("/api/feeds"), {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch feed: ${response.status}`);
        }

        const data = (await response.json()) as FeedResponse;
        setNews(data.news ?? []);
        setLastUpdated(data.last_updated ?? null);
        setCompanies(data.companies ?? []);
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }

        setError(err instanceof Error ? err.message : "Failed to fetch feed");
        setNews([]);
        setLastUpdated(null);
        setCompanies([]);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    void fetchFeed();

    return () => controller.abort();
  }, []);

  return { news, lastUpdated, companies, loading, error };
}
