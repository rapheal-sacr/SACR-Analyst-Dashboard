import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { BriefingView } from './components/BriefingView';
import { SettingsView } from './components/SettingsView';
import { CVEView } from './components/CVEView';
import { ResearchView } from './components/ResearchView';
import { SearchView } from './components/SearchView';
import { TodaysFeedView } from './components/TodaysFeedView';
import { HistoryView } from './components/HistoryView';
import { fetchFeeds, triggerGeneration, saveSettings, CVEItem, ResearchItem, NewsItem } from './services/intelligence';
import { Menu } from 'lucide-react';
import { Logo } from './components/Logo';

export type View = 'briefing' | 'settings' | 'cve' | 'research' | 'search' | 'client-news' | 'history';

export default function App() {
  const [currentView, setCurrentView] = useState<View>('briefing');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' ? 'dark' : 'light';
    }
    return 'light';
  });
  
  // State for settings
  const [clients, setClients] = useState<string[]>([
    "Crowdstrike", "Palo Alto Networks", "Microsoft", "Orca", "Mitiga", "Wiz", "Cyera", "Teleskope", "Neural Trust", "Cyata", "Okta", "Neon Security", "ConductorOne", "Imper AI", "Silverfort", "Opti", "1Password", "Orchid", "Aizome", "Apono", "Teleport", "Swimlane", "Panther", "Cribl", "Vega", "Brava Security", "AI Strike", "Anomali", "Acalvio", "Abnormal AI", "Cimento", "Netskope", "Stifel", "Surf AI", "ClearVector", "Bloom Security"
  ]);
  const [watchlist, setWatchlist] = useState<string[]>([
    "QuantumShield", "AgenticSec", "NeuralGuard", "Flow Security", "7AI", "Upwind", 
    "Atbash", "Sublime Security", "Chainguard", "Harmonic Security", "Knostic", 
    "Apex Security", "Grip Security", "Descope", "Acuvity AI", "Keycard", "Aikido Security", "Venn"
  ]);

  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    saveSettings(clients, watchlist).catch(console.error);
  }, [clients, watchlist]);
  
  // Centralized Feed State
  const [briefingContent, setBriefingContent] = useState<string | null>(null);
  const [trendingTopics, setTrendingTopics] = useState<string[]>([]);
  const [briefingHistory, setBriefingHistory] = useState<any[]>([]);
  const [structuredFeed, setStructuredFeed] = useState<NewsItem[] | null>(null);
  const [structuredHistory, setStructuredHistory] = useState<{ date: string; news: NewsItem[] }[]>([]);
  const [cves, setCves] = useState<CVEItem[] | null>(null);
  const [cveTrendingAcronyms, setCveTrendingAcronyms] = useState<string[] | null>(null);
  const [research, setResearch] = useState<ResearchItem[] | null>(null);
  const [lastGenerated, setLastGenerated] = useState<Date | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [theme]);

  const processData = (data: any) => {
    if (data.briefing) {
      setBriefingContent(data.briefing.markdown || data.briefing);
      if (data.briefing.trendingTopics) {
        setTrendingTopics(data.briefing.trendingTopics);
      }
      if (data.briefing.promotedToWatchlist && data.briefing.promotedToWatchlist.length > 0) {
        const toPromote = data.briefing.promotedToWatchlist;
        setWatchlist(prev => {
          const newWatchlist = new Set([...prev, ...toPromote]);
          return Array.from(newWatchlist);
        });
      }
    }
    if (data.settings) {
      if (data.settings.clients) setClients(data.settings.clients);
      if (data.settings.watchlist) setWatchlist(data.settings.watchlist);
    }
    if (data.cves) setCves(data.cves);
    if (data.cveTrendingAcronyms) setCveTrendingAcronyms(data.cveTrendingAcronyms);
    if (data.research) setResearch(data.research);
    if (data.lastUpdated) setLastGenerated(new Date(data.lastUpdated));
    if (data.history) setBriefingHistory(data.history);
    if (data.structuredFeed) setStructuredFeed(data.structuredFeed);
    if (data.structuredHistory) setStructuredHistory(data.structuredHistory);
    
    if (data.isGeneratingBackground !== undefined) {
      setIsGenerating(data.isGeneratingBackground);
    }
  };

  const loadFeeds = async () => {
    try {
      const data = await fetchFeeds();
      processData(data);
    } catch (err) {
      console.error('Failed to load feeds:', err);
    }
  };

  const handleGenerateAll = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const data = await triggerGeneration(clients, watchlist);
      processData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate feeds');
      setIsGenerating(false);
    }
  };

  // Load feeds on mount
  useEffect(() => {
    loadFeeds();
    
    // Poll every 10 seconds to check if background generation finished
    const interval = setInterval(loadFeeds, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col md:flex-row h-screen w-full overflow-hidden bg-[var(--color-bg-primary)]">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-[var(--color-border)] bg-[var(--color-bg-sidebar)] shrink-0">
        <div className="flex items-center gap-3">
          <Logo size={32} />
          <span className="font-serif font-medium text-lg tracking-tight">SACR Cyber Intel</span>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(true)} 
          className="p-2 text-[var(--color-text-primary)] hover:bg-[var(--color-hover)] rounded-md"
        >
          <Menu size={24} />
        </button>
      </div>

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-40 w-64 transform transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0 shrink-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Sidebar 
          currentView={currentView} 
          setCurrentView={(view) => {
            setCurrentView(view);
            setIsSidebarOpen(false);
          }} 
          theme={theme}
          toggleTheme={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
          closeSidebar={() => setIsSidebarOpen(false)}
        />
      </div>

      {/* Main Content */}
      <main className="flex-1 h-full overflow-y-auto relative">
        <div className="max-w-4xl mx-auto px-6 py-12 md:px-12 md:py-16">
          {currentView === 'briefing' && (
            <BriefingView 
              content={briefingContent}
              history={briefingHistory}
              isGenerating={isGenerating}
              lastGenerated={lastGenerated}
              error={error}
              onRegenerate={handleGenerateAll}
            />
          )}

          {currentView === 'client-news' && (
            <TodaysFeedView
              news={structuredFeed}
              lastUpdated={lastGenerated ? lastGenerated.toISOString() : null}
              isGenerating={isGenerating}
              error={error}
              onRegenerate={handleGenerateAll}
            />
          )}

          {currentView === 'history' && (
            <HistoryView
              history={structuredHistory}
              isGenerating={isGenerating}
            />
          )}
          
          {currentView === 'settings' && (
            <SettingsView 
              clients={clients}
              setClients={setClients}
              watchlist={watchlist}
              setWatchlist={setWatchlist}
            />
          )}

          {currentView === 'cve' && (
            <CVEView 
              cves={cves} 
              trendingAcronyms={cveTrendingAcronyms}
              isGenerating={isGenerating} 
              error={error} 
              onRegenerate={handleGenerateAll} 
            />
          )}

          {currentView === 'research' && (
            <ResearchView 
              research={research} 
              trendingTopics={trendingTopics}
              isGenerating={isGenerating} 
              error={error} 
              onRegenerate={handleGenerateAll} 
            />
          )}

          {currentView === 'search' && (
            <SearchView 
              clients={clients}
              watchlist={watchlist}
            />
          )}
        </div>
      </main>
      
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-30 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
}
