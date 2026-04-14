import { useState } from "react";

import type { NewsItem } from "../types";

type CompanyCardProps = {
  company: string;
  items: NewsItem[];
};

const INITIAL_VISIBLE_ITEMS = 5;

function formatNewsDate(dateValue: string): string {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function CompanyCard({ company, items }: CompanyCardProps) {
  const [expanded, setExpanded] = useState(false);
  const sortedItems = [...items].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  const isEmpty = sortedItems.length === 0;
  const visibleItems = expanded
    ? sortedItems
    : sortedItems.slice(0, INITIAL_VISIBLE_ITEMS);
  const hasMoreItems = sortedItems.length > INITIAL_VISIBLE_ITEMS;

  return (
    <article className="company-card">
      <h2 className="company-card-title">{company}</h2>

      {isEmpty ? (
        <p className="company-card-empty">No new announcements in the last 24 hours.</p>
      ) : (
        <ul className="company-card-list">
          {visibleItems.map((item, index) => (
            <li
              key={`${item.company}-${item.sourceUrl}-${index}`}
              className="company-card-item"
            >
              <p className="company-card-headline">{item.headline}</p>
              <p className="company-card-date">{formatNewsDate(item.date)}</p>
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="company-card-link"
              >
                {item.sourceLabel} →
              </a>
            </li>
          ))}
        </ul>
      )}

      {!isEmpty && hasMoreItems ? (
        <button
          type="button"
          className="company-card-toggle"
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? "See less" : "See more"}
        </button>
      ) : null}
    </article>
  );
}
