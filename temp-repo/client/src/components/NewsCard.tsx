import type { NewsItem } from "../types";

type NewsCardProps = {
  item: NewsItem;
};

function formatDisplayDate(dateValue: string): string {
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

export function NewsCard({ item }: NewsCardProps) {
  return (
    <article className="news-card">
      <div className="news-card-meta">
        <p className="news-card-company">{item.company}</p>
        <p className="news-card-date">{formatDisplayDate(item.date)}</p>
      </div>
      <h3 className="news-card-headline">{item.headline}</h3>
      <p className="news-card-summary">{item.summary}</p>
      <a
        href={item.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="news-card-link"
      >
        {item.sourceLabel} →
      </a>
    </article>
  );
}
