import { google } from "googleapis";
import { GOOGLE_SHEETS_ID } from "../config";
import { supabase } from "../lib/supabase";
import { NewsItem } from "../types";

type SnapshotForArchive = {
  snapshot_date: string;
  news: NewsItem[] | null;
};

export const archiveOldSnapshots = async (): Promise<number> => {
  try {
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - 30);
    const cutoffDate = cutoff.toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from("feed_snapshots")
      .select("snapshot_date,news")
      .lt("snapshot_date", cutoffDate);

    if (error) {
      console.error("archiveOldSnapshots: failed to query snapshots", error);
      return 0;
    }

    const snapshots = (data ?? []) as SnapshotForArchive[];
    if (snapshots.length === 0) {
      return 0;
    }

    const rows: string[][] = [];
    for (const snapshot of snapshots) {
      const newsItems = Array.isArray(snapshot.news) ? snapshot.news : [];
      for (const item of newsItems) {
        rows.push([
          snapshot.snapshot_date,
          item.company ?? "",
          item.headline ?? "",
          item.summary ?? "",
          item.date ?? "",
          item.sourceUrl ?? "",
          item.sourceLabel ?? "",
        ]);
      }
    }

    if (rows.length === 0) {
      return 0;
    }

    const auth = new google.auth.GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    await sheets.spreadsheets.values.append({
      spreadsheetId: GOOGLE_SHEETS_ID,
      range: "A:G",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: rows,
      },
    });

    return rows.length;
  } catch (error) {
    console.error("archiveOldSnapshots: unexpected failure", error);
    return 0;
  }
};
