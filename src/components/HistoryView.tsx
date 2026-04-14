import React, { useMemo, useState } from 'react';
import { Calendar, ExternalLink, Building2 } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { NewsItem } from '../services/intelligence';

const ALL_FILTER = "All";

type HistoryNewsItem = NewsItem & { id: string };

function buildRangeLabel(days: 14 | 30 | 60): string {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - (days - 1));

  const formatOpts: Intl.DateTimeFormatOptions = { month: "long", day: "numeric", year: "numeric" };
  return `Showing ${start.toLocaleDateString("en-US", formatOpts)} – ${end.toLocaleDateString("en-US", formatOpts)}`;
}

function dateGroupLabel(dateValue: string): string {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return dateValue;
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function dateGroupKey(dateValue: string): string {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return dateValue;
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

interface HistoryViewProps {
  history: { date: string; news: NewsItem[] }[];
  isGenerating: boolean;
}

export function HistoryView({ history, isGenerating }: HistoryViewProps) {
  const [days, setDays] = useState<14 | 30 | 60>(14);
  const [activeFilter, setActiveFilter] = useState<string>(ALL_FILTER);

  const allItems = useMemo<HistoryNewsItem[]>(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    const items = history.flatMap((snapshot, sIdx) => 
      snapshot.news
        .filter(item => new Date(item.date) >= cutoff)
        .map((item, index) => ({
          ...item,
          id: `${sIdx}-${index}-${item.url}`,
        }))
    );

    // Deduplicate by URL (or title if URL is missing)
    const seen = new Set<string>();
    const uniqueItems: HistoryNewsItem[] = [];
    for (const item of items) {
      const key = item.url || item.title;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueItems.push(item);
      }
    }
    return uniqueItems;
  }, [history, days]);

  const sortedItems = useMemo(() => {
    return [...allItems].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allItems]);

  const companyCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of sortedItems) {
      counts.set(item.company, (counts.get(item.company) ?? 0) + 1);
    }
    return counts;
  }, [sortedItems]);

  const companies = useMemo(() => {
    return [...companyCounts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([company]) => company);
  }, [companyCounts]);

  const filteredItems = useMemo(() => {
    if (activeFilter === ALL_FILTER) return sortedItems;
    return sortedItems.filter((item) => item.company === activeFilter);
  }, [activeFilter, sortedItems]);

  const groupedItems = useMemo(() => {
    const groups: Array<{ key: string; label: string; items: HistoryNewsItem[] }> = [];
    for (const item of filteredItems) {
      const key = dateGroupKey(item.date);
      const existing = groups[groups.length - 1];
      if (existing && existing.key === key) {
        existing.items.push(item);
        continue;
      }
      groups.push({ key, label: dateGroupLabel(item.date), items: [item] });
    }
    return groups;
  }, [filteredItems]);

  return (
    <div className="w-full max-w-4xl mx-auto pb-20">
      <header className="mb-8">
        <h1 className="font-serif text-3xl md:text-4xl font-medium tracking-tight text-[var(--color-text-primary)] mb-2">
          News History
        </h1>
        <p className="text-[var(--color-text-secondary)]">{buildRangeLabel(days)}</p>
      </header>

      <div className="flex flex-col md:flex-row gap-6 mb-8 bg-transparent p-0 rounded-none border-none shadow-none">
        {/* Date Interval Tabs */}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-bold text-[var(--color-text-secondary)]">Timeframe</span>
          <div className="flex gap-2">
            <button
              onClick={() => setDays(14)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors border",
                days === 14 
                  ? "bg-[var(--color-accent)] text-white border-[var(--color-accent)]" 
                  : "bg-[var(--color-bg-sidebar)] text-[var(--color-text-secondary)] border-transparent hover:text-[var(--color-text-primary)]"
              )}
            >
              14 days
            </button>
            <button
              onClick={() => setDays(30)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors border",
                days === 30 
                  ? "bg-[var(--color-accent)] text-white border-[var(--color-accent)]" 
                  : "bg-[var(--color-bg-sidebar)] text-[var(--color-text-secondary)] border-transparent hover:text-[var(--color-text-primary)]"
              )}
            >
              30 days
            </button>
            <button
              onClick={() => setDays(60)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors border",
                days === 60 
                  ? "bg-[var(--color-accent)] text-white border-[var(--color-accent)]" 
                  : "bg-[var(--color-bg-sidebar)] text-[var(--color-text-secondary)] border-transparent hover:text-[var(--color-text-primary)]"
              )}
            >
              60 days
            </button>
          </div>
        </div>

        {/* Company Filter Tabs */}
        <div className="flex flex-col gap-2 overflow-hidden">
          <span className="text-sm font-bold text-[var(--color-text-secondary)]">Client Company</span>
          <div className="flex overflow-x-auto gap-2 scrollbar-hide pb-1" role="tablist">
            <button
              onClick={() => setActiveFilter(ALL_FILTER)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors border shrink-0",
                activeFilter === ALL_FILTER 
                  ? "bg-[var(--color-accent)] text-white border-[var(--color-accent)]" 
                  : "bg-[var(--color-bg-sidebar)] text-[var(--color-text-secondary)] border-transparent hover:text-[var(--color-text-primary)]"
              )}
            >
              All
            </button>
            {companies.map((company) => (
              <button
                key={company}
                onClick={() => setActiveFilter(company)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors border shrink-0",
                  activeFilter === company 
                    ? "bg-[var(--color-accent)] text-white border-[var(--color-accent)]" 
                    : "bg-[var(--color-bg-sidebar)] text-[var(--color-text-secondary)] border-transparent hover:text-[var(--color-text-primary)]"
                )}
              >
                {company} <span className="opacity-60 ml-1">({companyCounts.get(company)})</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {isGenerating ? (
        <p className="text-[var(--color-text-secondary)]">Loading history...</p>
      ) : groupedItems.length === 0 ? (
        <p className="text-[var(--color-text-secondary)]">No news found for this time period.</p>
      ) : (
        <div className="space-y-10">
          {groupedItems.map((group) => (
            <div key={group.key}>
              <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-4 border-b border-[var(--color-border)] pb-2">
                {group.label}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {group.items.map((item) => (
                  <div key={item.id} className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col">
                    <div className="flex items-center gap-2 mb-3">
                      <Building2 size={14} className="text-[var(--color-text-secondary)]" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                        {item.company}
                      </span>
                    </div>
                    <h4 className="text-base font-medium text-[var(--color-text-primary)] mb-2 leading-snug">
                      {item.url ? (
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-accent)] hover:underline">
                          {item.title}
                        </a>
                      ) : (
                        item.title
                      )}
                    </h4>
                    <p className="text-sm text-[var(--color-text-secondary)] line-clamp-3 mb-4 flex-1">
                      {item.summary}
                    </p>
                    {item.tags && item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-auto">
                        {item.tags.map((tag, tIdx) => (
                          <span key={tIdx} className="text-[9px] uppercase tracking-wider font-medium px-1.5 py-0.5 bg-[var(--color-bg-sidebar)] rounded text-[var(--color-text-secondary)]">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
