import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { format } from 'date-fns';
import { RefreshCw, AlertCircle, History } from 'lucide-react';
import { motion } from 'motion/react';

interface BriefingViewProps {
  content: string | null;
  history?: any[];
  isGenerating: boolean;
  lastGenerated: Date | null;
  error: string | null;
  onRegenerate: () => void;
}

export function BriefingView({ content, history = [], isGenerating, lastGenerated, error, onRegenerate }: BriefingViewProps) {
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState<number | null>(null);
  const today = new Date();
  
  const hour = today.getHours();
  let greeting = 'Good evening';
  if (hour < 12) greeting = 'Good morning';
  else if (hour < 18) greeting = 'Good afternoon';
  
  const displayContent = selectedHistoryIndex !== null && history[selectedHistoryIndex] 
    ? history[selectedHistoryIndex].briefing.markdown || history[selectedHistoryIndex].briefing
    : content;

  return (
    <div className="w-full max-w-3xl mx-auto pb-20">
      <header className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
            {format(today, 'EEEE, MMMM do, yyyy')}
          </p>
          
          {lastGenerated && !isGenerating && (
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
          {greeting}. Here is your intelligence briefing.
        </h1>
        
        {history.length > 0 && (
          <div className="mt-6 flex items-center gap-3">
            <History size={16} className="text-[var(--color-text-secondary)]" />
            <select 
              className="bg-transparent border border-[var(--color-border)] text-sm rounded-md px-2 py-1 text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-text-primary)]"
              value={selectedHistoryIndex === null ? 'current' : selectedHistoryIndex}
              onChange={(e) => setSelectedHistoryIndex(e.target.value === 'current' ? null : Number(e.target.value))}
            >
              <option value="current">Latest Briefing</option>
              {history.map((h, i) => (
                <option key={i} value={i}>
                  {format(new Date(h.date), 'MMM do, yyyy - h:mm a')}
                </option>
              ))}
            </select>
          </div>
        )}
      </header>

      {error && (
        <div className="mb-8 p-4 bg-[var(--color-error-bg)] border border-[var(--color-error-border)] rounded-md flex items-start gap-3 text-[var(--color-error-text)]">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold">Failed to generate briefing</h3>
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

      {isGenerating ? (
        <div className="py-12 flex flex-col items-center justify-center text-center">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
            className="mb-4 text-[var(--color-text-secondary)]"
          >
            <RefreshCw size={24} />
          </motion.div>
          <h3 className="text-lg font-medium mb-2">Compiling Intelligence</h3>
          <p className="text-[var(--color-text-secondary)] text-sm max-w-sm">
            Scanning security blogs, news sources, and research feeds to generate your personalized briefing...
          </p>
        </div>
      ) : displayContent ? (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="markdown-body"
        >
          <ReactMarkdown 
            remarkPlugins={[remarkGfm]}
            components={{
              code: ({node, inline, className, children, ...props}) => {
                const match = /language-(\w+)/.exec(className || '');
                if (!inline && match && match[1] === 'tags') {
                  const tags = String(children).replace(/\n$/, '').split(',').map(t => t.trim());
                  return (
                    <div className="flex flex-wrap gap-2 mt-3 mb-6">
                      {tags.map((t, i) => (
                        <span key={i} className="px-2 py-1 bg-[var(--color-bg-sidebar)] border border-[var(--color-border)] rounded-md text-xs text-[var(--color-text-secondary)] font-sans">
                          {t}
                        </span>
                      ))}
                    </div>
                  );
                }
                return <code className={className} {...props}>{children}</code>;
              }
            }}
          >
            {displayContent.replace(/(?:\*\*TAGS:\*\*|TAGS:|Tags:|\*\*Tags:\*\*)\s*(.+)/gi, '\n\n```tags\n$1\n```\n\n')}
          </ReactMarkdown>
        </motion.div>
      ) : null}
    </div>
  );
}
