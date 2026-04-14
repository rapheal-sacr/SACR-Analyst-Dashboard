import React, { useState } from 'react';
import { Search, Loader2, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion } from 'motion/react';

interface SearchViewProps {
  clients: string[];
  watchlist: string[];
}

export function SearchView({ clients, watchlist }: SearchViewProps) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, clients, watchlist }),
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      setResult(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during search');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto pb-20">
      <header className="mb-10">
        <h1 className="font-serif text-3xl md:text-4xl font-medium tracking-tight text-[var(--color-text-primary)] mb-4">
          Semantic Search
        </h1>
        <p className="text-[var(--color-text-secondary)]">
          Search across the latest intelligence, research, and news feeds.
        </p>
      </header>

      <form onSubmit={handleSearch} className="mb-10">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for vulnerabilities, trends, or companies..."
            className="w-full pl-12 pr-28 py-4 bg-[var(--color-bg-sidebar)] border border-[var(--color-border)] rounded-xl text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-text-primary)] shadow-sm text-sm md:text-base"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" size={20} />
          <button
            type="submit"
            disabled={isSearching || !query.trim()}
            className="absolute right-3 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isSearching ? <Loader2 size={16} className="animate-spin" /> : 'Search'}
          </button>
        </div>
      </form>

      {error && (
        <div className="mb-8 p-4 bg-[var(--color-error-bg)] border border-[var(--color-error-border)] rounded-md flex items-start gap-3 text-[var(--color-error-text)]">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold">Search Failed</h3>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {isSearching && (
        <div className="py-20 flex flex-col items-center justify-center text-center">
          <Loader2 size={32} className="animate-spin text-[var(--color-text-secondary)] mb-4" />
          <h3 className="text-lg font-medium mb-2">Analyzing Sources</h3>
          <p className="text-[var(--color-text-secondary)] text-sm max-w-sm">
            Scanning the web and cross-referencing with your tracked companies...
          </p>
        </div>
      )}

      {result && !isSearching && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="markdown-body p-6 bg-[var(--color-bg-sidebar)] border border-[var(--color-border)] rounded-xl"
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {result}
          </ReactMarkdown>
        </motion.div>
      )}
    </div>
  );
}
