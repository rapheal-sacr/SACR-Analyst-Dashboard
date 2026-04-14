import { generateNewsForCompanies } from "../lib/gemini";
import { supabase } from "../lib/supabase";
import { FeedResponse, NewsItem, SnapshotRow } from "../types";

export const DEFAULT_CLIENTS = [
  "CrowdStrike",
  "Microsoft",
  "Palo Alto Networks",
  "Orca",
  "Mitiga",
  "Wiz",
  "Cyera",
  "Okta",
  "Silverfort",
  "1Password",
  "Apono",
  "Teleport",
  "Swimlane",
  "Cribl",
  "Anomali",
  "Abnormal Security",
  "Netskope",
  "Acalvio",
  "Stifel",
];

const uniqueCompanies = (news: NewsItem[]): string[] =>
  Array.from(new Set(news.map((item) => item.company)));

const normalizeHeadline = (headline: string): string =>
  headline
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const OVERLAP_DUPLICATE_THRESHOLD = 0.96;

const getUtcDateKey = (dateString: string): string => {
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return parsed.toISOString().slice(0, 10);
};

const wordOverlapRatio = (a: Set<string>, b: Set<string>): number => {
  if (a.size === 0 && b.size === 0) {
    return 1;
  }

  let intersection = 0;
  for (const word of a) {
    if (b.has(word)) {
      intersection += 1;
    }
  }

  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
};

export const deduplicateNews = (items: NewsItem[]): NewsItem[] => {
  const keptByCompany = new Map<
    string,
    Array<{ normalizedHeadline: string; words: Set<string>; dayKey: string; sourceUrl: string }>
  >();
  const deduplicated: NewsItem[] = [];

  for (const item of items) {
    const normalizedHeadline = normalizeHeadline(item.headline);
    const words = new Set(normalizedHeadline.split(" ").filter(Boolean));
    const dayKey = getUtcDateKey(item.date);
    const existingForCompany = keptByCompany.get(item.company) ?? [];

    const isDuplicate = existingForCompany.some((kept) => {
      if (kept.normalizedHeadline === normalizedHeadline) {
        return true;
      }
      if (kept.sourceUrl === item.sourceUrl) {
        return true;
      }
      if (!dayKey || !kept.dayKey || dayKey !== kept.dayKey) {
        return false;
      }
      return wordOverlapRatio(kept.words, words) > OVERLAP_DUPLICATE_THRESHOLD;
    });

    if (isDuplicate) {
      continue;
    }

    deduplicated.push(item);
    existingForCompany.push({
      normalizedHeadline,
      words,
      dayKey,
      sourceUrl: item.sourceUrl,
    });
    keptByCompany.set(item.company, existingForCompany);
  }

  return deduplicated;
};

/** One Gemini request per client so each company gets full model attention; failures are logged and skipped. */
export const generateNewsPerClient = async (
  clients: string[],
  targetDate?: string
): Promise<NewsItem[]> => {
  const merged: NewsItem[] = [];
  for (const client of clients) {
    try {
      const batch = await generateNewsForCompanies([client], targetDate);
      merged.push(...batch);
    } catch (error) {
      console.error(`News generation failed for client "${client}"`, error);
    }
  }
  return merged;
};

export const getCurrentFeed = async (): Promise<FeedResponse> => {
  const { data, error } = await supabase
    .from("feeds")
    .select("news,last_updated")
    .eq("id", "current")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return { news: [], last_updated: null };
  }

  return {
    news: (data.news ?? []) as NewsItem[],
    last_updated: data.last_updated ?? null,
  };
};

export const getHistory = async (days: number): Promise<SnapshotRow[]> => {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  const cutoffIso = cutoff.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("feed_snapshots")
    .select("id,news,companies,snapshot_date,created_at")
    .gte("snapshot_date", cutoffIso)
    .order("snapshot_date", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as SnapshotRow[];
};

export const getSnapshotDates = async (): Promise<string[]> => {
  const { data, error } = await supabase
    .from("feed_snapshots")
    .select("snapshot_date");

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => row.snapshot_date as string);
};

export const saveFeed = async (news: NewsItem[]): Promise<void> => {
  const { error } = await supabase.from("feeds").upsert(
    {
      id: "current",
      news,
      last_updated: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (error) {
    throw error;
  }
};

export const saveSnapshot = async (
  news: NewsItem[],
  companies: string[],
  date: string
): Promise<void> => {
  const { error } = await supabase.from("feed_snapshots").insert({
    news,
    companies,
    snapshot_date: date,
  });

  if (error) {
    throw error;
  }
};

export const deleteOldSnapshots = async (): Promise<void> => {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 30);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  const { error } = await supabase
    .from("feed_snapshots")
    .delete()
    .lt("snapshot_date", cutoffDate);

  if (error) {
    throw error;
  }
};

export const generateAndPersistNews = async (
  clients: string[]
): Promise<{ count: number }> => {
  const news = await generateNewsPerClient(clients);
  const deduplicatedNews = deduplicateNews(news);
  const dedupedCount = Math.max(news.length - deduplicatedNews.length, 0);
  if (dedupedCount > 0) {
    console.info(`Deduplicated ${dedupedCount} items from ${news.length} generated results.`);
  }
  await saveFeed(deduplicatedNews);
  await saveSnapshot(
    deduplicatedNews,
    uniqueCompanies(deduplicatedNews),
    new Date().toISOString().slice(0, 10)
  );
  return { count: deduplicatedNews.length };
};
