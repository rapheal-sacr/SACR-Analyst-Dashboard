import React, { useMemo, useState } from 'react';
import { RefreshCw, ExternalLink, Calendar, Building2 } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { NewsItem } from '../services/intelligence';

const ALL_FILTER = "All";

function formatItemDate(dateValue: string): string {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return dateValue;
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function formatTodayDateLabel(date: Date): string {
  const weekday = date.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
  const month = date.toLocaleDateString("en-US", { month: "long" }).toUpperCase();
  const day = date.getDate();
  const year = date.getFullYear();

  const ordinalSuffix = (d: number) => {
    if (d % 100 >= 11 && d % 100 <= 13) return "TH";
    switch (d % 10) {
      case 1: return "ST";
      case 2: return "ND";
      case 3: return "RD";
      default: return "TH";
    }
  };

  return `${weekday}, ${month} ${day}${ordinalSuffix(day)}, ${year}`;
}

interface TodaysFeedViewProps {
  news: NewsItem[] | null;
  lastUpdated: string | null;
  isGenerating: boolean;
  error: string | null;
  onRegenerate: () => void;
}

export function TodaysFeedView({ news, lastUpdated, isGenerating, error, onRegenerate }: TodaysFeedViewProps) {
  const [activeFilter, setActiveFilter] = useState<string>(ALL_FILTER);

  const itemsByCompany = useMemo(() => {
    const grouped = new Map<string, NewsItem[]>();
    if (!news) return grouped;
    for (const item of news) {
      const existing = grouped.get(item.company) ?? [];
      existing.push(item);
      grouped.set(item.company, existing);
    }
    return grouped;
  }, [news]);

  const companiesForFilterPills = useMemo(() => {
    if (!news) return [];
    const names = new Set<string>();
    for (const item of news) {
      names.add(item.company);
    }
    return [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }));
  }, [news]);

  const visibleCompanies = useMemo(() => {
    if (activeFilter === ALL_FILTER) {
      return companiesForFilterPills;
    }
    return companiesForFilterPills.filter((company) => company === activeFilter);
  }, [activeFilter, companiesForFilterPills]);

  return (
    <div className="w-full max-w-4xl mx-auto pb-20">
      <header className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
            {formatTodayDateLabel(new Date())}
          </p>
          
          {lastUpdated && !isGenerating && (
            <button 
              onClick={onRegenerate}
              className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              <RefreshCw size={12} />
              Refresh
            </button>
          )}
        </div>
        <h1 className="font-serif text-3xl md:text-4xl font-medium tracking-tight text-[var(--color-text-primary)]">
          Client News Briefings
        </h1>
      </header>

      {error && (
        <div className="mb-8 p-4 bg-[var(--color-error-bg)] border border-[var(--color-error-border)] rounded-md text-[var(--color-error-text)]">
          <p className="text-sm">{error}</p>
        </div>
      )}

      {isGenerating ? (
        <div className="py-12 flex flex-col items-center justify-center text-center">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
            className="mb-4 text-[var(--color-text-secondary)]"
          >
            <RefreshCw size={24} />
          </motion.div>
          <h3 className="text-lg font-medium mb-2">Compiling News</h3>
          <p className="text-[var(--color-text-secondary)] text-sm max-w-sm">
            Searching for the latest updates on tracked companies...
          </p>
        </div>
      ) : news && news.length > 0 ? (
        <>
          <div className="flex flex-col gap-2 mb-6 overflow-hidden">
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
                {ALL_FILTER}
              </button>
              {companiesForFilterPills.map(company => (
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
                  {company}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-8">
            {visibleCompanies.map(company => (
              <div key={company} className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                <div className="bg-[var(--color-bg-sidebar)] px-6 py-4 border-b border-[var(--color-border)] flex items-center gap-3">
                  <Building2 size={20} className="text-[var(--color-text-secondary)]" />
                  <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">{company}</h2>
                </div>
                <div className="divide-y divide-[var(--color-border)]">
                  {(itemsByCompany.get(company) || []).map((item, idx) => (
                    <div key={idx} className="p-6">
                      <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-2 leading-tight">
                        {item.url ? (
                          <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-accent)] hover:underline flex items-start gap-2">
                            {item.title}
                            <ExternalLink size={14} className="shrink-0 mt-1.5 opacity-50" />
                          </a>
                        ) : (
                          item.title
                        )}
                      </h3>
                      <p className="text-sm text-[var(--color-text-secondary)] mb-4 leading-relaxed">
                        {item.summary}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
                          <Calendar size={12} />
                          {formatItemDate(item.date)}
                        </div>
                        {item.tags && item.tags.length > 0 && (
                          <div className="flex gap-2">
                            {item.tags.map((tag, tIdx) => (
                              <span key={tIdx} className="text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 bg-[var(--color-bg-sidebar)] rounded text-[var(--color-text-secondary)]">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="text-center py-12 text-[var(--color-text-secondary)]">
          No news found. Try refreshing.
        </div>
      )}
    </div>
  );
}
