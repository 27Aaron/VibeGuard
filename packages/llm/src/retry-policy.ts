export type LlmErrorCode =
  | "timeout"
  | "rate_limited"
  | "server_error"
  | "network_error"
  | "non_retryable";

export type LlmRetryConfig = {
  timeoutMs: number;
  maxAttempts: number;
  retryBaseMs: number;
  retryMaxMs: number;
};

type HeadersLike =
  | Headers
  | {
      get?: (name: string) => string | null;
      [key: string]: unknown;
    }
  | undefined
  | null;

export const DEFAULT_LLM_RETRY_CONFIG: LlmRetryConfig = {
  timeoutMs: 60_000,
  maxAttempts: 3,
  retryBaseMs: 500,
  retryMaxMs: 8_000,
};

export class LlmRequestError extends Error {
  code: LlmErrorCode;
  retryable: boolean;

  constructor(input: {
    code: LlmErrorCode;
    message: string;
    retryable: boolean;
    cause?: unknown;
  }) {
    super(`${input.code}: ${input.message}`, { cause: input.cause });
    this.name = "LlmRequestError";
    this.code = input.code;
    this.retryable = input.retryable;
  }
}

function readPositiveInteger(
  value: string | number | undefined,
  fallback: number,
) {
  const parsed =
    typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

export function resolveLlmRetryConfig(
  input: {
    env?: Record<string, string | undefined>;
    timeoutMs?: number;
    maxAttempts?: number;
    retryBaseMs?: number;
    retryMaxMs?: number;
  } = {},
): LlmRetryConfig {
  const env =
    input.env ?? (typeof process !== "undefined" ? process.env : {});

  return {
    timeoutMs: readPositiveInteger(
      input.timeoutMs ?? env.VIBEGUARD_LLM_TIMEOUT_MS,
      DEFAULT_LLM_RETRY_CONFIG.timeoutMs,
    ),
    maxAttempts: readPositiveInteger(
      input.maxAttempts ?? env.VIBEGUARD_LLM_MAX_ATTEMPTS,
      DEFAULT_LLM_RETRY_CONFIG.maxAttempts,
    ),
    retryBaseMs: readPositiveInteger(
      input.retryBaseMs ?? env.VIBEGUARD_LLM_RETRY_BASE_MS,
      DEFAULT_LLM_RETRY_CONFIG.retryBaseMs,
    ),
    retryMaxMs: readPositiveInteger(
      input.retryMaxMs ?? env.VIBEGUARD_LLM_RETRY_MAX_MS,
      DEFAULT_LLM_RETRY_CONFIG.retryMaxMs,
    ),
  };
}

function getHeader(headers: HeadersLike, name: string) {
  if (!headers) return undefined;

  if (typeof headers.get === "function") {
    return headers.get(name) ?? headers.get(name.toLowerCase()) ?? undefined;
  }

  const record = headers as Record<string, unknown>;
  const value = record[name] ?? record[name.toLowerCase()];

  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : undefined;
}

export function parseRetryAfterMs(headers: HeadersLike, now = Date.now()) {
  const retryAfterMs = getHeader(headers, "retry-after-ms");

  if (retryAfterMs) {
    const parsed = Number.parseFloat(retryAfterMs);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
  }

  const retryAfter = getHeader(headers, "retry-after");

  if (!retryAfter) {
    return undefined;
  }

  const seconds = Number.parseFloat(retryAfter);
  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.floor(seconds * 1000);
  }

  const dateMs = Date.parse(retryAfter);
  if (Number.isFinite(dateMs) && dateMs > now) {
    return dateMs - now;
  }

  return undefined;
}

export function resolveRetryDelayMs(input: {
  attempt: number;
  baseMs: number;
  maxMs: number;
  retryAfterMs?: number;
  random?: () => number;
}) {
  if (
    typeof input.retryAfterMs === "number" &&
    Number.isFinite(input.retryAfterMs) &&
    input.retryAfterMs > 0
  ) {
    return Math.min(Math.floor(input.retryAfterMs), input.maxMs);
  }

  const exponential = Math.min(
    input.baseMs * 2 ** Math.max(0, input.attempt - 1),
    input.maxMs,
  );
  const random = input.random ?? Math.random;
  const jitterMultiplier = 0.75 + random() * 0.5;

  return Math.min(Math.floor(exponential * jitterMultiplier), input.maxMs);
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

export function getLlmHttpStatus(error: unknown) {
  const record = error as {
    status?: unknown;
    response?: { status?: unknown };
  };

  return readNumber(record?.status) ?? readNumber(record?.response?.status);
}

export function getLlmHeaders(error: unknown): HeadersLike {
  const record = error as {
    headers?: HeadersLike;
    response?: { headers?: HeadersLike };
  };

  return record?.headers ?? record?.response?.headers;
}

function isTimeoutLike(error: unknown) {
  const record = error as { name?: unknown; code?: unknown; message?: unknown };
  const name = typeof record?.name === "string" ? record.name : "";
  const code = typeof record?.code === "string" ? record.code : "";
  const message =
    typeof record?.message === "string" ? record.message.toLowerCase() : "";

  return (
    name === "AbortError" ||
    code === "ETIMEDOUT" ||
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    message.includes("timed out") ||
    message.includes("timeout") ||
    message.includes("aborted")
  );
}

function getOriginalMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function getLlmErrorCode(error: unknown): LlmErrorCode {
  if (isTimeoutLike(error)) {
    return "timeout";
  }

  const status = getLlmHttpStatus(error);

  if (status === 429) {
    return "rate_limited";
  }

  if (status && status >= 500) {
    return "server_error";
  }

  if (status && [408, 409].includes(status)) {
    return "network_error";
  }

  if (status && status >= 400) {
    return "non_retryable";
  }

  return "network_error";
}

export function isRetryableLlmError(error: unknown) {
  const code = getLlmErrorCode(error);

  return (
    code === "timeout" ||
    code === "rate_limited" ||
    code === "server_error" ||
    code === "network_error"
  );
}

export function formatLlmErrorMessage(error: unknown) {
  const code = getLlmErrorCode(error);

  return `${code}: ${getOriginalMessage(error)}`;
}

export function normalizeLlmError(error: unknown) {
  if (error instanceof LlmRequestError) {
    return error;
  }

  const code = getLlmErrorCode(error);

  return new LlmRequestError({
    code,
    message: getOriginalMessage(error),
    retryable: isRetryableLlmError(error),
    cause: error,
  });
}
