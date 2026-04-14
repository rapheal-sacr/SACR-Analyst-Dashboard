import React from 'react';
import { CVEItem } from '../services/intelligence';
import { RefreshCw, AlertCircle, ShieldAlert, ShieldX, Shield, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface CVEViewProps {
  cves: CVEItem[] | null;
  trendingAcronyms?: string[] | null;
  isGenerating: boolean;
  error: string | null;
  onRegenerate: () => void;
}

function formatItemDate(dateValue: string): string {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return dateValue;
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function CVEView({ cves, trendingAcronyms, isGenerating, error, onRegenerate }: CVEViewProps) {
  const getSeverityColor = (severity: string) => {
    const s = severity.toUpperCase();
    if (s === 'CRITICAL') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800/50';
    if (s === 'HIGH') return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800/50';
    if (s === 'MEDIUM') return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800/50';
    return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700';
  };

  const getSeverityIcon = (severity: string) => {
    const s = severity.toUpperCase();
    if (s === 'CRITICAL') return <ShieldX size={16} className="text-red-600 dark:text-red-400" />;
    if (s === 'HIGH') return <ShieldAlert size={16} className="text-orange-600 dark:text-orange-400" />;
    return <Shield size={16} className="text-yellow-600 dark:text-yellow-400" />;
  };

  return (
    <div className="w-full max-w-4xl mx-auto pb-20">
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-medium tracking-tight text-[var(--color-text-primary)]">
            CVE Intelligence Feed
          </h1>
          <p className="text-[var(--color-text-secondary)] mt-2">
            Curated vulnerabilities prioritized by your tracked companies and market impact.
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

      {trendingAcronyms && trendingAcronyms.length > 0 && (
        <div className="mb-10 p-5 bg-[var(--color-bg-sidebar)] border border-[var(--color-border)] rounded-lg">
          <div className="flex items-center gap-2 mb-3 text-[var(--color-text-primary)]">
            <TrendingUp size={18} />
            <h2 className="font-medium">Trending Categories</h2>
          </div>
          <ul className="flex flex-wrap gap-2">
            {trendingAcronyms.map((acronym, idx) => (
              <li key={idx} className="px-3 py-1 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-full text-sm text-[var(--color-text-secondary)]">
                {acronym}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="mb-8 p-4 bg-[var(--color-error-bg)] border border-[var(--color-error-border)] rounded-md flex items-start gap-3 text-[var(--color-error-text)]">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold">Failed to fetch CVEs</h3>
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

      {isGenerating && (!cves || cves.length === 0) ? (
        <div className="py-20 flex flex-col items-center justify-center text-center">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
            className="mb-4 text-[var(--color-text-secondary)]"
          >
            <RefreshCw size={24} />
          </motion.div>
          <h3 className="text-lg font-medium mb-2">Analyzing Vulnerabilities</h3>
          <p className="text-[var(--color-text-secondary)] text-sm max-w-sm">
            Scanning threat intelligence sources for relevant CVEs...
          </p>
        </div>
      ) : !cves || cves.length === 0 ? (
        <div className="py-20 text-center text-[var(--color-text-secondary)]">
          No CVEs found.
        </div>
      ) : (
        <div className="space-y-4">
          {cves.map((cve, i) => (
            <motion.div 
              key={cve.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-[var(--color-text-primary)] font-mono tracking-tight">{cve.id}</h3>
                    <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium border flex items-center gap-1.5", getSeverityColor(cve.severity))}>
                      {getSeverityIcon(cve.severity)}
                      {cve.severity} (CVSS: {cve.cvss})
                    </span>
                  </div>
                  <div className="text-sm text-[var(--color-text-secondary)] flex flex-wrap items-center gap-2">
                    <span className="font-medium text-[var(--color-text-primary)]">{cve.vendor}</span>
                    <span className="hidden sm:inline">•</span>
                    <span>{cve.product}</span>
                    <span className="hidden sm:inline">•</span>
                    <span>Disclosed: {formatItemDate(cve.dateDisclosed)}</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1">Description</h4>
                  <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">{cve.description}</p>
                </div>
                <div className="bg-[var(--color-bg-sidebar)] rounded-md p-3 border border-[var(--color-border)]">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1">Strategic Implication</h4>
                  <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">{cve.implication}</p>
                </div>
                {cve.tags && cve.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {cve.tags.map((tag, idx) => (
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
