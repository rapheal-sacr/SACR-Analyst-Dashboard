import dotenv from "dotenv";
import { eachDayOfInterval, format, subDays } from "date-fns";
import { DEFAULT_COMPANIES } from "../config";
import {
  deduplicateNews,
  generateNewsPerClient,
  getSnapshotDates,
  saveSnapshot,
} from "../services/feedService";

dotenv.config();

const parseDaysArg = (): number => {
  const arg = process.argv.find((value) => value.startsWith("--days="));
  if (!arg) {
    return 14;
  }

  const parsed = Number(arg.split("=")[1]);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid --days value: ${arg}`);
  }

  return Math.floor(parsed);
};

const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const run = async (): Promise<void> => {
  const days = parseDaysArg();
  const today = new Date();
  const start = subDays(today, days);
  const end = subDays(today, 1);
  const dateRange = eachDayOfInterval({ start, end }).map((date) =>
    format(date, "yyyy-MM-dd")
  );

  const existingDates = new Set(await getSnapshotDates());
  let hasFailures = false;

  for (const date of dateRange) {
    if (existingDates.has(date)) {
      console.log(`[${date}] skipped (snapshot already exists)`);
      continue;
    }

    try {
      const generated = await generateNewsPerClient(DEFAULT_COMPANIES, date);
      const deduplicated = deduplicateNews(generated);
      await saveSnapshot(deduplicated, DEFAULT_COMPANIES, date);
      console.log(`[${date}] saved ${deduplicated.length} items`);
      existingDates.add(date);
    } catch (error) {
      hasFailures = true;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[${date}] failed: ${message}`);
    } finally {
      await sleep(3000);
    }
  }

  process.exitCode = hasFailures ? 1 : 0;
};

void run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Backfill failed to start: ${message}`);
  process.exit(1);
});
