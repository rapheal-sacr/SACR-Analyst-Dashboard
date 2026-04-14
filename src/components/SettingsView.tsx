import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';

interface SettingsViewProps {
  clients: string[];
  setClients: React.Dispatch<React.SetStateAction<string[]>>;
  watchlist: string[];
  setWatchlist: React.Dispatch<React.SetStateAction<string[]>>;
}

export function SettingsView({ clients, setClients, watchlist, setWatchlist }: SettingsViewProps) {
  const [newClient, setNewClient] = useState('');
  const [newWatchlist, setNewWatchlist] = useState('');

  const addClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (newClient.trim() && !clients.includes(newClient.trim())) {
      setClients([...clients, newClient.trim()]);
      setNewClient('');
    }
  };

  const removeClient = (client: string) => {
    setClients(clients.filter(c => c !== client));
  };

  const addWatchlist = (e: React.FormEvent) => {
    e.preventDefault();
    if (newWatchlist.trim() && !watchlist.includes(newWatchlist.trim())) {
      setWatchlist([...watchlist, newWatchlist.trim()]);
      setNewWatchlist('');
    }
  };

  const removeWatchlist = (company: string) => {
    setWatchlist(watchlist.filter(c => c !== company));
  };

  return (
    <div className="w-full max-w-2xl mx-auto pb-20">
      <header className="mb-10">
        <h1 className="font-serif text-3xl font-medium tracking-tight text-[var(--color-text-primary)]">
          Intelligence Settings
        </h1>
        <p className="text-[var(--color-text-secondary)] mt-2">
          Configure the companies and topics you want to track in your daily briefing.
        </p>
      </header>

      <div className="space-y-10">
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider mb-4">Client Companies</h2>
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">
            We will prioritize news, product launches, and customer wins for these organizations.
          </p>
          
          <div className="flex flex-wrap gap-2 mb-4">
            {clients.map(client => (
              <div key={client} className="flex items-center gap-1.5 bg-[var(--color-bg-card)] border border-[var(--color-border)] px-3 py-1.5 rounded-full text-sm shadow-sm">
                <span>{client}</span>
                <button 
                  onClick={() => removeClient(client)}
                  className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          
          <form onSubmit={addClient} className="flex gap-2">
            <input 
              type="text" 
              value={newClient}
              onChange={(e) => setNewClient(e.target.value)}
              placeholder="Add client company..."
              className="flex-1 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
            />
            <button 
              type="submit"
              disabled={!newClient.trim()}
              className="bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-colors flex items-center gap-1"
            >
              <Plus size={16} />
              Add
            </button>
          </form>
        </section>

        <div className="h-px w-full bg-[var(--color-border)]" />

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider mb-4">Watchlist Companies</h2>
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">
            Competitors, partners, or general interest companies to monitor for strategic moves.
          </p>
          
          <div className="flex flex-wrap gap-2 mb-4">
            {watchlist.map(company => (
              <div key={company} className="flex items-center gap-1.5 bg-[var(--color-bg-card)] border border-[var(--color-border)] px-3 py-1.5 rounded-full text-sm shadow-sm">
                <span>{company}</span>
                <button 
                  onClick={() => removeWatchlist(company)}
                  className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          
          <form onSubmit={addWatchlist} className="flex gap-2">
            <input 
              type="text" 
              value={newWatchlist}
              onChange={(e) => setNewWatchlist(e.target.value)}
              placeholder="Add watchlist company..."
              className="flex-1 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
            />
            <button 
              type="submit"
              disabled={!newWatchlist.trim()}
              className="bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-colors flex items-center gap-1"
            >
              <Plus size={16} />
              Add
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
