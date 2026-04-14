import React from 'react';
import { FileText, Settings, Bug, BookOpen, Sun, Moon, X, Search, Newspaper, History } from 'lucide-react';
import { View } from '../App';
import { cn } from '../lib/utils';
import { Logo } from './Logo';

interface SidebarProps {
  currentView: View;
  setCurrentView: (view: View) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  closeSidebar: () => void;
}

export function Sidebar({ currentView, setCurrentView, theme, toggleTheme, closeSidebar }: SidebarProps) {
  return (
    <div className="h-full bg-[var(--color-bg-sidebar)] border-r border-[var(--color-border)] flex flex-col">
      <div className="p-4 md:p-6 flex items-center justify-between">
        <div className="flex items-center gap-2 md:gap-3">
          <Logo size={32} />
          <span className="font-serif font-medium text-lg tracking-tight whitespace-nowrap">SACR Cyber Intel</span>
        </div>
        <button 
          className="md:hidden p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-hover)] rounded-md"
          onClick={closeSidebar}
        >
          <X size={20} />
        </button>
      </div>
      
      <nav className="flex-1 px-4 py-2 space-y-1">
        <button
          onClick={() => setCurrentView('briefing')}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
            currentView === 'briefing' 
              ? "bg-[var(--color-bg-card)] text-[var(--color-text-primary)] shadow-sm border border-[var(--color-border)]" 
              : "text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-primary)]"
          )}
        >
          <FileText size={16} />
          Today's Briefing
        </button>

        <button
          onClick={() => setCurrentView('client-news')}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
            currentView === 'client-news' 
              ? "bg-[var(--color-bg-card)] text-[var(--color-text-primary)] shadow-sm border border-[var(--color-border)]" 
              : "text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-primary)]"
          )}
        >
          <Newspaper size={16} />
          Client News
        </button>

        <button
          onClick={() => setCurrentView('history')}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
            currentView === 'history' 
              ? "bg-[var(--color-bg-card)] text-[var(--color-text-primary)] shadow-sm border border-[var(--color-border)]" 
              : "text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-primary)]"
          )}
        >
          <History size={16} />
          News History
        </button>

        <button
          onClick={() => setCurrentView('cve')}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
            currentView === 'cve' 
              ? "bg-[var(--color-bg-card)] text-[var(--color-text-primary)] shadow-sm border border-[var(--color-border)]" 
              : "text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-primary)]"
          )}
        >
          <Bug size={16} />
          CVE Feed
        </button>

        <button
          onClick={() => setCurrentView('research')}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
            currentView === 'research' 
              ? "bg-[var(--color-bg-card)] text-[var(--color-text-primary)] shadow-sm border border-[var(--color-border)]" 
              : "text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-primary)]"
          )}
        >
          <BookOpen size={16} />
          Research Feed
        </button>

        <button
          onClick={() => setCurrentView('search')}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
            currentView === 'search' 
              ? "bg-[var(--color-bg-card)] text-[var(--color-text-primary)] shadow-sm border border-[var(--color-border)]" 
              : "text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-primary)]"
          )}
        >
          <Search size={16} />
          Search
        </button>
        
        <button
          onClick={() => setCurrentView('settings')}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
            currentView === 'settings' 
              ? "bg-[var(--color-bg-card)] text-[var(--color-text-primary)] shadow-sm border border-[var(--color-border)]" 
              : "text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-primary)]"
          )}
        >
          <Settings size={16} />
          Settings
        </button>
      </nav>
      
      <div className="p-4 border-t border-[var(--color-border)] space-y-4">
        <button 
          onClick={toggleTheme}
          className="w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <span className="flex items-center gap-3">
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
          </span>
        </button>
      </div>
    </div>
  );
}
