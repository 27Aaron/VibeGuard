import { isIP } from "node:net";

export const ADMIN_SESSION_COOKIE = "admin_session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;
export const LOGIN_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
export const LOGIN_RATE_LIMIT_MAX_FAILURES = 5;

const TOKEN_VERSION = "v1";
const UNSAFE_ADMIN_PASSWORDS = new Set([
  "admin",
  "admin123",
  "password",
  "password123",
  "changeme",
  "replace-with-your-admin-password",
  "replace-with-a-strong-admin-password",
]);
const UNSAFE_SESSION_SECRETS = new Set([
  "test-secret",
  "replace-with-a-random-secret",
]);
const MAX_TRACKED_LOGIN_KEYS = 2_000;
const MAX_FAILURES_PER_KEY = 32;
const LOGIN_FAIL_MAP_PRUNE_INTERVAL_MS = 15_000;
// 注意：登录频率限制的状态存储在进程内存中，具有以下限制：
// 1. 进程重启后状态丢失（用户重新获得完整的登录机会）。
// 2. 多实例部署时各实例独立计数，攻击者可在每个实例分别尝试 N 次。
//    对于生产环境的多实例部署，建议将此状态迁移至 Redis 等共享存储。
const failedLoginAttempts = new Map<string, number[]>();
let lastLoginFailureCleanupAt = 0;

export type AdminAuthConfig = {
  password: string;
  secret: string;
};

export function getAdminAuthConfig(
  env: NodeJS.ProcessEnv = process.env,
): AdminAuthConfig | null {
  const password = String(env.ADMIN_PASSWORD ?? "").trim();
  const secret = String(
    env.VIBEGUARD_SECRET ?? env.CONTENT_FOUNDATION_SECRET ?? "",
  ).trim();

  if (isUnsafeAdminPassword(password) || isUnsafeSessionSecret(secret)) {
    return null;
  }

  return {
    password,
    secret,
  };
}

function isUnsafeAdminPassword(password: string) {
  return (
    password.length < 12 || UNSAFE_ADMIN_PASSWORDS.has(password.toLowerCase())
  );
}

function isUnsafeSessionSecret(secret: string) {
  return secret.length < 16 || UNSAFE_SESSION_SECRETS.has(secret);
}

export function sanitizeAdminReturnPath(
  input: string | undefined,
  lang: "zh" | "en",
) {
  const fallback = `/${lang}/admin`;

  if (!input || !input.startsWith("/") || input.startsWith("//")) {
    return fallback;
  }

  try {
    const url = new URL(input, "http://vibeguard.local");
    const adminPrefix = `/${lang}/admin`;
    const loginPrefix = `${adminPrefix}/login`;

    if (
      url.pathname === loginPrefix ||
      url.pathname.startsWith(`${loginPrefix}/`) ||
      (url.pathname !== adminPrefix &&
        !url.pathname.startsWith(`${adminPrefix}/`))
    ) {
      return fallback;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export async function verifyAdminPassword(input: string, expected: string) {
  const [inputHash, expectedHash] = await Promise.all([
    sha256Hex(input),
    sha256Hex(expected),
  ]);

  return constantTimeEqual(inputHash, expectedHash);
}

export async function createAdminSessionToken(input: {
  password: string;
  secret: string;
  issuedAt?: number;
}) {
  const issuedAt = input.issuedAt ?? Date.now();
  const passwordHash = await sha256Hex(input.password);
  const signature = await hmacSha256Base64Url(
    input.secret,
    buildSessionMessage(issuedAt, passwordHash),
  );

  return `${TOKEN_VERSION}.${issuedAt}.${signature}`;
}

export async function verifyAdminSessionToken(
  token: string | undefined,
  input: {
    password: string;
    secret: string;
    now?: number;
  },
) {
  if (!token) {
    return false;
  }

  const [version, issuedAtValue, signature, ...extra] = token.split(".");
  const issuedAt = Number(issuedAtValue);
  const now = input.now ?? Date.now();

  if (
    extra.length > 0 ||
    version !== TOKEN_VERSION ||
    !Number.isFinite(issuedAt) ||
    issuedAt > now ||
    now - issuedAt > ADMIN_SESSION_MAX_AGE_SECONDS * 1000 ||
    !signature
  ) {
    return false;
  }

  const passwordHash = await sha256Hex(input.password);
  const expectedSignature = await hmacSha256Base64Url(
    input.secret,
    buildSessionMessage(issuedAt, passwordHash),
  );

  return constantTimeEqual(signature, expectedSignature);
}

function buildSessionMessage(issuedAt: number, passwordHash: string) {
  return `${TOKEN_VERSION}.${issuedAt}.${passwordHash}`;
}

async function sha256Hex(input: string) {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256Base64Url(secret: string, input: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(input),
  );

  return bytesToBase64Url(new Uint8Array(signature));
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function constantTimeEqual(left: string, right: string) {
  const maxLength = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;

  // 始终遍历完整的 maxLength 以避免通过比较时间泄露字符串长度信息（防止时序攻击）。
  for (let index = 0; index < maxLength; index += 1) {
    const leftCode = index < left.length ? left.charCodeAt(index) : 0;
    const rightCode = index < right.length ? right.charCodeAt(index) : 0;
    diff |= leftCode ^ rightCode;
  }

  return diff === 0;
}

export function resolveLoginRateLimitKey(headers: Headers) {
  const trustProxyHeaders =
    process.env.VIBEGUARD_TRUST_PROXY_HEADERS?.toLowerCase();
  if (trustProxyHeaders !== "1" && trustProxyHeaders !== "true") {
    return "local";
  }

  const candidateHeaders = [
    headers.get("x-forwarded-for"),
    headers.get("x-real-ip"),
    headers.get("cf-connecting-ip"),
    headers.get("true-client-ip"),
  ];

  for (const headerValue of candidateHeaders) {
    const candidate = headerValue?.split(",")[0]?.trim();

    if (!candidate || isIP(candidate) < 1) {
      continue;
    }

    return candidate;
  }

  return "local";
}

export function isLoginRateLimited(key: string, now = Date.now()) {
  const failures = pruneLoginFailures(key, now);

  return failures.length >= LOGIN_RATE_LIMIT_MAX_FAILURES;
}

export function recordFailedLogin(key: string, now = Date.now()) {
  const failures = pruneLoginFailures(key, now);
  failures.push(now);
  if (failures.length > MAX_FAILURES_PER_KEY) {
    failures.splice(0, failures.length - MAX_FAILURES_PER_KEY);
  }

  setLoginFailures(key, failures);
  pruneLoginFailureMap(now);
}

export function clearLoginFailures(key: string) {
  failedLoginAttempts.delete(key);
}

function setLoginFailures(key: string, failures: number[]) {
  // 先删除再重新插入，使最近使用的 key 保持在 Map 末尾，便于基于插入顺序的有界淘汰。
  failedLoginAttempts.delete(key);
  failedLoginAttempts.set(key, failures);
}

function pruneLoginFailureMap(now = Date.now()) {
  if (failedLoginAttempts.size <= MAX_TRACKED_LOGIN_KEYS) {
    return;
  }

  if (now - lastLoginFailureCleanupAt < LOGIN_FAIL_MAP_PRUNE_INTERVAL_MS) {
    return;
  }

  lastLoginFailureCleanupAt = now;
  const staleCutoff = now - LOGIN_RATE_LIMIT_WINDOW_MS;
  const staleKeys: string[] = [];

  for (const [address, timestamps] of failedLoginAttempts) {
    const survivors = timestamps.filter((timestamp) => timestamp > staleCutoff);
    if (survivors.length === 0) {
      staleKeys.push(address);
      continue;
    }

    if (survivors.length < timestamps.length) {
      failedLoginAttempts.set(address, survivors);
    }
  }

  for (const staleKey of staleKeys) {
    failedLoginAttempts.delete(staleKey);
  }

  if (failedLoginAttempts.size <= MAX_TRACKED_LOGIN_KEYS) {
    return;
  }

  const targetSize = Math.max(Math.floor(MAX_TRACKED_LOGIN_KEYS * 0.8), 1);
  const excess = failedLoginAttempts.size - targetSize;

  if (excess <= 0) {
    return;
  }

  const keys = [...failedLoginAttempts.keys()].slice(0, excess);
  for (const key of keys) {
    failedLoginAttempts.delete(key);
  }
}

function pruneLoginFailures(key: string, now: number) {
  const cutoff = now - LOGIN_RATE_LIMIT_WINDOW_MS;
  const failures = (failedLoginAttempts.get(key) ?? []).filter(
    (timestamp) => timestamp > cutoff,
  );

  if (failures.length === 0) {
    failedLoginAttempts.delete(key);
  } else {
    setLoginFailures(key, failures);
  }

  return failures;
}
