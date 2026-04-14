import { useEffect, useMemo, useState } from "react";

import { NewsCard } from "../components";
import { useHistory } from "../hooks";
import type { NewsItem } from "../types";

const ALL_FILTER = "All";

type HistoryNewsItem = NewsItem & {
  id: string;
};

function formatRangeDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function buildRangeLabel(days: 14 | 30): string {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - (days - 1));

  const startMonth = start.toLocaleDateString("en-US", { month: "long" });
  const endMonth = end.toLocaleDateString("en-US", { month: "long" });
  const startDay = start.getDate();
  const endDay = end.getDate();
  const endYear = end.getFullYear();
  const startYear = start.getFullYear();

  if (startYear === endYear && startMonth === endMonth) {
    return `Showing ${startMonth} ${startDay} – ${endDay}, ${endYear}`;
  }

  if (startYear === endYear) {
    return `Showing ${startMonth} ${startDay} – ${endMonth} ${endDay}, ${endYear}`;
  }

  return `Showing ${formatRangeDate(start)} – ${formatRangeDate(end)}`;
}

function dateGroupLabel(dateValue: string): string {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function dateGroupKey(dateValue: string): string {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function History() {
  const [days, setDays] = useState<14 | 30>(14);
  const [activeFilter, setActiveFilter] = useState<string>(ALL_FILTER);
  const { snapshots, loading, error } = useHistory(days);

  useEffect(() => {
    setActiveFilter(ALL_FILTER);
  }, [days]);

  const allItems = useMemo<HistoryNewsItem[]>(() => {
    return snapshots.flatMap((snapshot) =>
      snapshot.news.map((item, index) => ({
        ...item,
        id: `${snapshot.id}-${index}-${item.sourceUrl}`,
      })),
    );
  }, [snapshots]);

  const sortedItems = useMemo(() => {
    return [...allItems].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [allItems]);

  const companyCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of sortedItems) {
      counts.set(item.company, (counts.get(item.company) ?? 0) + 1);
    }
    return counts;
  }, [sortedItems]);

  const companies = useMemo(() => {
    return [...companyCounts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([company]) => company);
  }, [companyCounts]);

  const filteredItems = useMemo(() => {
    if (activeFilter === ALL_FILTER) {
      return sortedItems;
    }
    return sortedItems.filter((item) => item.company === activeFilter);
  }, [activeFilter, sortedItems]);

  const groupedItems = useMemo(() => {
    const groups: Array<{ key: string; label: string; items: HistoryNewsItem[] }> = [];

    for (const item of filteredItems) {
      const key = dateGroupKey(item.date);
      const existing = groups[groups.length - 1];
      if (existing && existing.key === key) {
        existing.items.push(item);
        continue;
      }

      groups.push({
        key,
        label: dateGroupLabel(item.date),
        items: [item],
      });
    }

    return groups;
  }, [filteredItems]);

  return (
    <section>
      <h1 className="page-heading">News History</h1>
      <p className="page-subtext">{buildRangeLabel(days)}</p>

      <div className="history-toggles">
        <button
          type="button"
          className={`company-filter-pill ${days === 14 ? "company-filter-pill-active" : ""}`}
          aria-pressed={days === 14}
          onClick={() => setDays(14)}
        >
          14 days
        </button>
        <button
          type="button"
          className={`company-filter-pill ${days === 30 ? "company-filter-pill-active" : ""}`}
          aria-pressed={days === 30}
          onClick={() => setDays(30)}
        >
          30 days
        </button>
      </div>

      <div className="company-filters" role="tablist" aria-label="Company filters">
        <button
          type="button"
          className={`company-filter-pill ${activeFilter === ALL_FILTER ? "company-filter-pill-active" : ""}`}
          aria-pressed={activeFilter === ALL_FILTER}
          onClick={() => setActiveFilter(ALL_FILTER)}
        >
          All
        </button>
        {companies.map((company) => (
          <button
            key={company}
            type="button"
            className={`company-filter-pill ${activeFilter === company ? "company-filter-pill-active" : ""}`}
            aria-pressed={activeFilter === company}
            onClick={() => setActiveFilter(company)}
          >
            {company} ({companyCounts.get(company) ?? 0})
          </button>
        ))}
      </div>

      {loading ? <p className="todays-status">Loading history...</p> : null}
      {!loading && error ? <p className="todays-status">Error: {error}</p> : null}

      {!loading && !error && groupedItems.length === 0 ? (
        <p className="todays-status">No news found for this time period.</p>
      ) : null}

      {!loading && !error && groupedItems.length > 0 ? (
        <div className="history-groups">
          {groupedItems.map((group) => (
            <div key={group.key} className="history-group">
              <p className="history-date-separator">{group.label}</p>
              <div className="history-cards">
                {group.items.map((item) => (
                  <NewsCard key={item.id} item={item} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
