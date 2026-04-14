import { useMemo, useState } from "react";

import { CompanyCard } from "../components";
import { useFeedData } from "../hooks";
import type { NewsItem } from "../types";

const ALL_FILTER = "All";

function ordinalSuffix(day: number): string {
  if (day % 100 >= 11 && day % 100 <= 13) {
    return "TH";
  }
  switch (day % 10) {
    case 1:
      return "ST";
    case 2:
      return "ND";
    case 3:
      return "RD";
    default:
      return "TH";
  }
}

function formatTodayDateLabel(date: Date): string {
  const weekday = date
    .toLocaleDateString("en-US", { weekday: "long" })
    .toUpperCase();
  const month = date.toLocaleDateString("en-US", { month: "long" }).toUpperCase();
  const day = date.getDate();
  const year = date.getFullYear();

  return `${weekday}, ${month} ${day}${ordinalSuffix(day)}, ${year}`;
}

function toEasternLastRefreshed(lastUpdated: string): string {
  return new Date(lastUpdated).toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TodaysFeed() {
  const { news, lastUpdated, companies, loading, error } = useFeedData();
  const [activeFilter, setActiveFilter] = useState<string>(ALL_FILTER);

  const itemsByCompany = useMemo(() => {
    const grouped = new Map<string, NewsItem[]>();

    for (const item of news) {
      const existing = grouped.get(item.company) ?? [];
      existing.push(item);
      grouped.set(item.company, existing);
    }

    return grouped;
  }, [news]);

  const sortedCompanies = useMemo(() => {
    const list = [...companies];
    const anyTrackedCompanyHasNews = list.some(
      (c) => (itemsByCompany.get(c) ?? []).length > 0,
    );

    if (!anyTrackedCompanyHasNews) {
      return list.sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }),
      );
    }

    return list.sort((a, b) => {
      const aItems = itemsByCompany.get(a) ?? [];
      const bItems = itemsByCompany.get(b) ?? [];
      const aLatest = aItems.length
        ? Math.max(...aItems.map((item) => new Date(item.date).getTime()))
        : Number.NEGATIVE_INFINITY;
      const bLatest = bItems.length
        ? Math.max(...bItems.map((item) => new Date(item.date).getTime()))
        : Number.NEGATIVE_INFINITY;
      return bLatest - aLatest;
    });
  }, [companies, itemsByCompany]);

  const companiesForFilterPills = useMemo(() => {
    const names = new Set<string>(companies);
    for (const item of news) {
      names.add(item.company);
    }
    return [...names].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }),
    );
  }, [companies, news]);

  const visibleCompanies = useMemo(() => {
    if (activeFilter === ALL_FILTER) {
      return sortedCompanies;
    }
    return sortedCompanies.filter((company) => company === activeFilter);
  }, [activeFilter, sortedCompanies]);

  const hasNoCompanies = companies.length === 0;

  return (
    <section>
      <p className="todays-date">{formatTodayDateLabel(new Date())}</p>
      <h1 className="page-heading">Client News Briefings</h1>
      {lastUpdated ? (
        <p className="todays-last-updated">
          Last refreshed today at {toEasternLastRefreshed(lastUpdated)}
        </p>
      ) : null}

      {loading ? <p className="todays-status">Loading today&apos;s feed...</p> : null}
      {!loading && error ? <p className="todays-status">Error: {error}</p> : null}

      {!loading && !error ? (
        <>
          <div className="company-filters" role="tablist" aria-label="Company filters">
            <button
              type="button"
              className={`company-filter-pill ${activeFilter === ALL_FILTER ? "company-filter-pill-active" : ""}`}
              aria-pressed={activeFilter === ALL_FILTER}
              onClick={() => setActiveFilter(ALL_FILTER)}
            >
              {ALL_FILTER}
            </button>
            {companiesForFilterPills.map((company) => (
              <button
                key={company}
                type="button"
                className={`company-filter-pill ${activeFilter === company ? "company-filter-pill-active" : ""}`}
                aria-pressed={activeFilter === company}
                onClick={() => setActiveFilter(company)}
              >
                {company}
              </button>
            ))}
          </div>

          <div className="company-cards">
            {hasNoCompanies ? (
              <p className="todays-status">
                No tracked companies configured.
              </p>
            ) : null}

            {!hasNoCompanies
              ? visibleCompanies.map((company) => (
                  <CompanyCard
                    key={company}
                    company={company}
                    items={itemsByCompany.get(company) ?? []}
                  />
                ))
              : null}
          </div>
        </>
      ) : null}
    </section>
  );
}
