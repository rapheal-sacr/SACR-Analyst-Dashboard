import { useEffect, useState } from "react";

import { apiUrl } from "../lib/apiUrl";
import type { SnapshotRow } from "../types";

type UseHistoryResult = {
  snapshots: SnapshotRow[];
  loading: boolean;
  error: string | null;
};

export function useHistory(days: 14 | 30): UseHistoryResult {
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const fetchHistory = async () => {
      setLoading(true);
      setError(null);
      setSnapshots([]);

      try {
        const response = await fetch(apiUrl(`/api/history?days=${days}`), {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch history: ${response.status}`);
        }

        const data = (await response.json()) as SnapshotRow[];
        setSnapshots(data ?? []);
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }

        setError(err instanceof Error ? err.message : "Failed to fetch history");
        setSnapshots([]);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    void fetchHistory();

    return () => controller.abort();
  }, [days]);

  return { snapshots, loading, error };
}
