import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import cron from 'node-cron';
import path from 'path';
import fs from 'fs';
import { generateDailyBriefing, generateCVEFeed, generateResearchFeed, generateTrendingTopics, generateSemanticSearch, generateStructuredFeed } from './server/intelligence.ts';
import { supabase } from './server/supabase.ts';

const app = express();
const PORT = Number(process.env.PORT) || 3000;
app.use(express.json());

const DATA_FILE = process.env.NODE_ENV === 'production' 
  ? path.join('/tmp', 'data.json')
  : path.join(process.cwd(), 'data.json');

async function getData() {
  let appState: any = { 
    briefing: null, cves: null, research: null, lastUpdated: null, history: [], structuredFeed: null, structuredHistory: [],
    settings: {
      clients: [
        "Crowdstrike", "Palo Alto Networks", "Microsoft", "Orca", "Mitiga", "Wiz", "Cyera", "Teleskope", "Neural Trust", "Cyata", "Okta", "Neon Security", "ConductorOne", "Imper AI", "Silverfort", "Opti", "1Password", "Orchid", "Aizome", "Apono", "Teleport", "Swimlane", "Panther", "Cribl", "Vega", "Brava Security", "AI Strike", "Anomali", "Acalvio", "Abnormal AI", "Cimento", "Netskope", "Stifel", "Surf AI", "ClearVector", "Bloom Security"
      ],
      watchlist: [
        "QuantumShield", "AgenticSec", "NeuralGuard", "Flow Security", "7AI", "Upwind", 
        "Atbash", "Sublime Security", "Chainguard", "Harmonic Security", "Knostic", 
        "Apex Security", "Grip Security", "Descope", "Acuvity AI", "Keycard", "Aikido Security", "Venn"
      ]
    }
  };
  
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('app_state')
        .select('data')
        .eq('id', 'current')
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Supabase fetch error:', error);
      } else if (data && data.data) {
        appState = { ...appState, ...data.data };
      }

      // Fetch news items from the dedicated relational table
      const { data: newsData, error: newsError } = await supabase
        .from('news_items')
        .select('*')
        .order('date', { ascending: false });

      if (newsError) {
        console.error('Supabase news fetch error:', newsError);
      } else if (newsData) {
        // Map database rows back to NewsItem interface
        const allNews = newsData.map(row => ({
          company: row.company,
          title: row.title,
          url: row.url || "",
          summary: row.summary,
          date: row.date,
          tags: row.tags || []
        }));

        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 1); // 24 hours ago

        appState.structuredFeed = allNews.filter(item => new Date(item.date) >= cutoff);
        
        // For history, we just group them by snapshot date or just pass them all
        // The frontend HistoryView expects { date: string, news: NewsItem[] }[]
        // We can just create one big snapshot for the frontend to consume
        appState.structuredHistory = [{
          date: new Date().toISOString(),
          news: allNews
        }];
      }
      
      return appState;
    } catch (e) {
      console.error('Error fetching from Supabase:', e);
    }
  }

  // Fallback to local file
  if (fs.existsSync(DATA_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    } catch (e) {
      console.error('Error parsing data.json:', e);
    }
  }
  return appState;
}

async function saveData(data: any) {
  if (supabase) {
    try {
      const { error } = await supabase
        .from('app_state')
        .upsert({ id: 'current', data, last_updated: new Date().toISOString() });
      if (error) {
        console.error('Supabase save error:', error);
      }
    } catch (e) {
      console.error('Error saving to Supabase:', e);
    }
  }

  // Always save locally as backup
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

let isGeneratingBackground = false;

// Background generation task for main feeds
async function generateAllFeeds(clients: string[], watchlist: string[]) {
  if (isGeneratingBackground) {
    console.log('Generation already in progress, skipping...');
    return;
  }
  isGeneratingBackground = true;
  console.log('Starting background generation of all feeds...');
  try {
    const [briefingResult, cveFeedResult, research, trendingTopics, structuredFeed] = await Promise.all([
      generateDailyBriefing(clients, watchlist),
      generateCVEFeed(clients, watchlist),
      generateResearchFeed(),
      generateTrendingTopics(),
      generateStructuredFeed(clients, watchlist)
    ]);
    
    // Merge trending topics into briefingResult for consistency
    if (briefingResult) {
      briefingResult.trendingTopics = trendingTopics;
    }
    
    const existingData = await getData();
    const history = existingData.history || [];
    
    // If we have an existing briefing, save it to history
    if (existingData.briefing && existingData.lastUpdated) {
      history.unshift({
        date: existingData.lastUpdated,
        briefing: existingData.briefing
      });
      // Keep only last 10
      if (history.length > 10) history.length = 10;
    }

    // Save news items to the relational database for deduplication
    if (supabase && structuredFeed && structuredFeed.length > 0) {
      const newsRows = structuredFeed.map(item => ({
        company: item.company,
        title: item.title,
        url: item.url || null, // Use null for empty URLs to avoid unique constraint issues on empty strings
        summary: item.summary,
        date: item.date,
        tags: item.tags
      }));

      // Upsert based on URL to prevent duplicates
      const { error: insertError } = await supabase
        .from('news_items')
        .upsert(newsRows, { onConflict: 'url', ignoreDuplicates: true });
        
      if (insertError) {
        console.error('Error inserting news items into Supabase:', insertError);
      }
    }
    
    await saveData({
      briefing: briefingResult,
      cves: cveFeedResult.cves,
      cveTrendingAcronyms: cveFeedResult.trendingAcronyms,
      research,
      lastUpdated: new Date().toISOString(),
      history
      // We no longer save structuredFeed and structuredHistory in the JSON blob
    });
    console.log('Successfully generated and saved all feeds.');
  } catch (error) {
    console.error('Failed to generate feeds:', error);
  } finally {
    isGeneratingBackground = false;
  }
}

async function updateTrendingTopics() {
  console.log('Updating trending topics...');
  try {
    const trendingTopics = await generateTrendingTopics();
    const data = await getData();
    if (data.briefing) {
      data.briefing.trendingTopics = trendingTopics;
      await saveData(data);
      console.log('Successfully updated trending topics.');
    }
  } catch (error) {
    console.error('Failed to update trending topics:', error);
  }
}

// Schedule for Morning, Afternoon, Evening (8 AM, 1 PM, 6 PM)
cron.schedule('0 8,13,18 * * *', async () => {
  console.log('Running scheduled feed generation');
  const data = await getData();
  const clients = data.settings?.clients || [];
  const watchlist = data.settings?.watchlist || [];
  generateAllFeeds(clients, watchlist);
});

// Schedule for every hour
cron.schedule('0 * * * *', () => {
  console.log('Running scheduled hourly trending topics update');
  updateTrendingTopics();
});

// API Routes
app.get('/api/feeds', async (req, res) => {
  const data = await getData();
  res.json({ ...data, isGeneratingBackground });
});

app.post('/api/generate', async (req, res) => {
  const { clients, watchlist } = req.body;
  // Don't await if we want to return immediately, but since frontend expects data, we can await
  // However, if it's already generating, we just return current data
  if (!isGeneratingBackground) {
    // Start it in the background so the request doesn't timeout
    generateAllFeeds(clients, watchlist).catch(console.error);
  }
  const data = await getData();
  res.json({ ...data, isGeneratingBackground: true });
});

app.post('/api/settings', async (req, res) => {
  const { clients, watchlist } = req.body;
  const data = await getData();
  data.settings = { clients, watchlist };
  await saveData(data);
  res.json({ success: true });
});

app.post('/api/search', async (req, res) => {
  const { query, clients, watchlist } = req.body;
  try {
    const result = await generateSemanticSearch(query, clients, watchlist);
    res.json({ result });
  } catch (error) {
    res.status(500).json({ error: 'Failed to perform semantic search' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    
    // Initial generation if no data exists
    const data = await getData();
    if (!data.briefing && !data.structuredFeed) {
      console.log('Starting initial generation...');
      const clients = data.settings?.clients || [];
      const watchlist = data.settings?.watchlist || [];
      generateAllFeeds(clients, watchlist);
    }
  });
}

startServer();
