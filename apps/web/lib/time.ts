const SHANGHAI_TIME_ZONE = "Asia/Shanghai";

// 缓存 DateTimeFormat 实例，避免每次调用时重复创建新的格式化对象，提升频繁调用时的性能。
const shanghaiPartsFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: SHANGHAI_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const rfc822Formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: SHANGHAI_TIME_ZONE,
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

function toDate(input: Date | string | null | undefined) {
  if (!input) {
    return null;
  }

  const date = input instanceof Date ? input : new Date(input);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function getShanghaiParts(input: Date | string | null | undefined) {
  const date = toDate(input);

  if (!date) {
    return null;
  }

  const lookup = Object.fromEntries(
    shanghaiPartsFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  ) as Record<string, string>;

  return {
    year: lookup.year,
    month: lookup.month,
    day: lookup.day,
    hour: lookup.hour,
    minute: lookup.minute,
    second: lookup.second,
  };
}

export function formatDateTimeInShanghai(
  input: Date | string | null | undefined,
  options?: {
    withSeconds?: boolean;
    fallback?: string;
    lang?: "zh" | "en";
  },
) {
  const parts = getShanghaiParts(input);

  if (!parts) {
    return options?.fallback ?? (options?.lang === "en" ? "Pending" : "待处理");
  }

  const base = `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;

  if (options?.withSeconds) {
    return `${base}:${parts.second}`;
  }

  return base;
}

export function toShanghaiIsoOffset(input: Date | string | null | undefined) {
  const parts = getShanghaiParts(input);

  if (!parts) {
    return null;
  }

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+08:00`;
}

export function toRfc822InShanghai(input: Date | string | null | undefined) {
  const date = toDate(input);

  if (!date) {
    return new Date().toUTCString();
  }

  const lookup = Object.fromEntries(
    rfc822Formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  ) as Record<string, string>;

  return `${lookup.weekday}, ${lookup.day} ${lookup.month} ${lookup.year} ${lookup.hour}:${lookup.minute}:${lookup.second} +0800`;
}

export { SHANGHAI_TIME_ZONE };
