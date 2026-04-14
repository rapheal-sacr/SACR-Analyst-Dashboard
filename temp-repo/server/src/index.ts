import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "node:path";
import { CRON_SECRET, DEFAULT_COMPANIES, PORT } from "./config";
import { archiveOldSnapshots } from "./services/archiveService";
import {
  deleteOldSnapshots,
  generateAndPersistNews,
  getCurrentFeed,
  getHistory,
} from "./services/feedService";

dotenv.config();

const app = express();
// Production (e.g. Cloud Run): same-origin SPA + API — reflect Origin when CLIENT_ORIGIN unset.
const corsOrigin =
  process.env.CLIENT_ORIGIN ??
  (process.env.NODE_ENV === "production"
    ? true
    : "http://localhost:5173");

app.use(cors({ origin: corsOrigin }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/api/feeds", async (_req, res) => {
  try {
    const feed = await getCurrentFeed();
    res.status(200).json({
      ...feed,
      companies: DEFAULT_COMPANIES,
    });
  } catch (error) {
    console.error("GET /api/feeds failed", error);
    res.status(500).json({ error: "Failed to load current feed." });
  }
});

app.get("/api/history", async (req, res) => {
  const days = Number(req.query.days ?? 14);
  if (![14, 30].includes(days)) {
    res.status(400).json({ error: "Query param days must be 14 or 30." });
    return;
  }

  try {
    const history = await getHistory(days);
    res.status(200).json(history);
  } catch (error) {
    console.error("GET /api/history failed", error);
    res.status(500).json({ error: "Failed to load history." });
  }
});

app.post("/api/generate", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    res.status(403).json({ error: "This endpoint is disabled in production." });
    return;
  }

  const body = req.body as { clients?: string[] };
  const clients = body.clients ?? [];
  if (!Array.isArray(clients) || clients.length === 0) {
    res
      .status(400)
      .json({ error: "Request body must include a non-empty clients array." });
    return;
  }

  try {
    const result = await generateAndPersistNews(clients);
    await deleteOldSnapshots();
    res.status(200).json({ success: true, count: result.count });
  } catch (error) {
    console.error("POST /api/generate failed", error);
    res.status(500).json({ error: "Failed to generate feed." });
  }
});

app.post("/api/refresh", async (req, res) => {
  const secret = req.header("x-cron-secret");
  if (!secret || secret !== CRON_SECRET) {
    res.status(401).json({ error: "Unauthorized cron request." });
    return;
  }

  try {
    const result = await generateAndPersistNews(DEFAULT_COMPANIES);
    const archivedCount = await archiveOldSnapshots();
    console.log(`archiveOldSnapshots archived rows: ${archivedCount}`);
    await deleteOldSnapshots();

    res.status(200).json({ success: true, count: result.count });
  } catch (error) {
    console.error("POST /api/refresh failed", error);
    res.status(500).json({ error: "Failed to refresh feed." });
  }
});

const clientDistPath = path.resolve(process.cwd(), "../client/dist");
app.use(express.static(clientDistPath));
app.get(/^(?!\/api\/).*/, (_req, res) => {
  res.sendFile(path.join(clientDistPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
