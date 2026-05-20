export type PublishedAtResolution = {
  publishedAt: Date;
  isFallback: boolean;
};

function isValidDate(value: string | Date | undefined | null) {
  if (value === undefined || value === null) {
    return false;
  }

  const parsed = value instanceof Date ? value : new Date(value);

  return !Number.isNaN(parsed.getTime());
}

function normalizeFeedItemLink(value: string) {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error("Feed item link must be a complete URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Feed item link must use http or https.");
  }

  return url.toString();
}

export type FeedItemInput = {
  title?: string | null;
  link?: string | null;
  isoDate?: string | Date | null;
  pubDate?: string | Date | null;
  content?: string | null;
  contentSnippet?: string | null;
  guid?: string | null;
  id?: string | null;
  creator?: string | null;
  categories?: string[] | null;
  [key: string]: unknown;
};

export type NormalizedFeedItem = {
  titleEn: string;
  url: string;
  publishedAt: Date;
  publishedAtIsFallback: boolean;
  fetchedAt: Date;
  rawMeta: FeedItemInput;
};

export function resolvePublishedAt(
  publishedAt: string | Date | undefined | null,
  fetchedAt: Date,
): PublishedAtResolution {
  if (publishedAt === undefined || publishedAt === null) {
    return { publishedAt: fetchedAt, isFallback: true };
  }

  const parsed =
    publishedAt instanceof Date ? publishedAt : new Date(publishedAt);

  if (Number.isNaN(parsed.getTime())) {
    return { publishedAt: fetchedAt, isFallback: true };
  }

  return { publishedAt: parsed, isFallback: false };
}

export function normalizeFeedItem(
  item: FeedItemInput,
  fetchedAt = new Date(),
): NormalizedFeedItem {
  const title = item.title?.trim();
  const link = item.link?.trim();

  if (!title || !link) {
    throw new Error("Feed item must include title and link");
  }

  const url = normalizeFeedItemLink(link);

  const publishedAtCandidate = isValidDate(item.isoDate)
    ? item.isoDate
    : item.pubDate;
  const { publishedAt, isFallback } = resolvePublishedAt(
    publishedAtCandidate,
    fetchedAt,
  );

  return {
    titleEn: title,
    url,
    publishedAt,
    publishedAtIsFallback: isFallback,
    fetchedAt,
    rawMeta: { ...item, title, link: url },
  };
}
