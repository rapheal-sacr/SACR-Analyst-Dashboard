import React from 'react';
import { ResearchItem } from '../services/intelligence';
import { RefreshCw, AlertCircle, BookOpen, TrendingUp, ExternalLink } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface ResearchViewProps {
  research: ResearchItem[] | null;
  trendingTopics?: string[];
  isGenerating: boolean;
  error: string | null;
  onRegenerate: () => void;
}

function formatItemDate(dateValue: string): string {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return dateValue;
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function ResearchView({ research, trendingTopics = [], isGenerating, error, onRegenerate }: ResearchViewProps) {
  const getCategoryColor = (category: string) => {
    const c = category.toLowerCase();
    if (c.includes('cloud') || c.includes('app')) return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800/50';
    if (c.includes('identity')) return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800/50';
    if (c.includes('soc')) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800/50';
    if (c.includes('data') || c.includes('ai')) return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800/50';
    return 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300 border-gray-200 dark:border-gray-700/50';
  };

  return (
    <div className="w-full max-w-4xl mx-auto pb-20">
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-medium tracking-tight text-[var(--color-text-primary)]">
            Research & Threat Intel
          </h1>
          <p className="text-[var(--color-text-secondary)] mt-2">
            Aggregated insights from top security researchers and threat intelligence teams.
          </p>
        </div>
        <button 
          onClick={onRegenerate}
          disabled={isGenerating}
          className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={cn(isGenerating && "animate-spin")} />
          Refresh Feed
        </button>
      </header>

      {trendingTopics && trendingTopics.length > 0 && (
        <div className="mb-10 p-5 bg-[var(--color-bg-sidebar)] border border-[var(--color-border)] rounded-lg">
          <div className="flex items-center gap-2 mb-3 text-[var(--color-text-primary)]">
            <TrendingUp size={18} />
            <h2 className="font-medium">Trending Topics Today</h2>
          </div>
          <ul className="flex flex-wrap gap-2">
            {trendingTopics.map((topic, i) => (
              <li key={i} className="px-3 py-1 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-full text-sm text-[var(--color-text-secondary)]">
                {topic}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="mb-8 p-4 bg-[var(--color-error-bg)] border border-[var(--color-error-border)] rounded-md flex items-start gap-3 text-[var(--color-error-text)]">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold">Failed to fetch research</h3>
            <p className="text-sm mt-1">{error}</p>
            <button 
              onClick={onRegenerate}
              className="mt-3 text-sm font-medium underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {isGenerating && (!research || research.length === 0) ? (
        <div className="py-20 flex flex-col items-center justify-center text-center">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
            className="mb-4 text-[var(--color-text-secondary)]"
          >
            <RefreshCw size={24} />
          </motion.div>
          <h3 className="text-lg font-medium mb-2">Aggregating Research</h3>
          <p className="text-[var(--color-text-secondary)] text-sm max-w-sm">
            Synthesizing the latest whitepapers, blog posts, and threat reports...
          </p>
        </div>
      ) : !research || research.length === 0 ? (
        <div className="py-20 text-center text-[var(--color-text-secondary)]">
          No research found.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {research.map((item, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-3">
                <h3 className="text-xl font-semibold text-[var(--color-text-primary)] leading-tight">
                  {item.url ? (
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-accent)] hover:underline transition-colors flex items-center gap-1.5">
                      {item.title}
                      <ExternalLink size={16} className="shrink-0 opacity-50" />
                    </a>
                  ) : (
                    item.title
                  )}
                </h3>
                <span className={cn("shrink-0 px-2.5 py-1 rounded-full text-xs font-medium border w-fit", getCategoryColor(item.category))}>
                  {item.category}
                </span>
              </div>
              
              <div className="text-sm text-[var(--color-text-secondary)] flex flex-wrap items-center gap-2 mb-4">
                <BookOpen size={14} />
                <span className="font-medium text-[var(--color-text-primary)]">{item.source}</span>
                <span className="hidden sm:inline">•</span>
                <span>{formatItemDate(item.date)}</span>
              </div>
              
              <div className="space-y-4 flex-1">
                <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">
                  {item.summary}
                </p>
                
                <div className="bg-[var(--color-bg-sidebar)] rounded-md p-4 border-l-2 border-[var(--color-accent)]">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1">Key Takeaway</h4>
                  <p className="text-sm font-medium text-[var(--color-text-primary)] leading-relaxed">{item.keyTakeaway}</p>
                </div>
                
                {item.tags && item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {item.tags.map((tag, idx) => (
                      <span key={idx} className="px-2 py-1 bg-[var(--color-bg-sidebar)] border border-[var(--color-border)] rounded-md text-xs text-[var(--color-text-secondary)]">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
