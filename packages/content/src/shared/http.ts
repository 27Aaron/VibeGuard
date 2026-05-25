import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { TextDecoder } from "node:util";

export const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";

const MAX_SAFE_REDIRECTS = 5;

const IPV4_PRIVATE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0, 0], // 0.0.0.0/8
  [10, 10], // 10.0.0.0/8
  [100, 100], // 100.64.0.0/10 (CGN)
  [127, 127], // 127.0.0.0/8
  [169, 169], // 169.254.0.0/16
  [172, 172], // 172.16.0.0/12
  [192, 192], // 192.0.0.0/24, 192.168.0.0/16, 192.18/19.0.0/15
  [198, 198], // 198.18/19.0.0/15
];

function isPrivateIp(ip: string): boolean {
  if (ip === "::1" || ip === "::") return true;
  if (ip.startsWith("fc") || ip.startsWith("fd")) return true;
  if (ip.startsWith("fe80")) return true;

  // IPv4-mapped IPv6: ::ffff:x.x.x.x
  const v4Mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  const v4Str = v4Mapped ? v4Mapped[1] : ip;

  const parts = v4Str.split(".");
  if (parts.length !== 4) return false;

  const [a, b] = parts.map(Number);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;

  for (const [lo, hi] of IPV4_PRIVATE_RANGES) {
    if (a === lo) {
      if (lo === 172) return b >= 16 && b <= 31;
      if (lo === 100) return b >= 64 && b <= 127;
      if (lo === 192) return b === 0 || b === 168 || b === 18 || b === 19;
      if (lo === 198) return b === 18 || b === 19;
      return true;
    }
  }

  return false;
}

export async function assertHttpUrl(url: string) {
  const parsed = new URL(url);

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("URL must use http or https.");
  }

  const { address } = await lookup(parsed.hostname);

  if (isPrivateIp(address)) {
    throw new Error("URL resolves to a private or reserved IP address.");
  }
}

export async function safeFetch(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  let currentUrl = url;
  let redirects = 0;

  while (true) {
    await assertHttpUrl(currentUrl);

    const response = await fetch(currentUrl, { ...init, redirect: "manual" });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      try {
        await response.body?.cancel();
      } catch {}
      if (!location) {
        throw new Error(
          `Redirect response missing Location header (${response.status})`,
        );
      }
      if (++redirects > MAX_SAFE_REDIRECTS) {
        throw new Error(`Too many redirects (exceeded ${MAX_SAFE_REDIRECTS})`);
      }
      currentUrl = new URL(location, currentUrl).href;
      continue;
    }

    return response;
  }
}

export async function readBodyWithByteLimit(
  response: Response,
  maxBytes: number,
): Promise<string> {
  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      received += value.byteLength;
      if (received > maxBytes) {
        throw new Error(`Response body exceeded ${maxBytes} byte limit`);
      }

      text += decoder.decode(value, { stream: true });
    }

    text += decoder.decode();
    return text;
  } finally {
    reader.releaseLock();
  }
}
