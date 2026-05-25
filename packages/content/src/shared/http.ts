import { lookup } from "node:dns/promises";

export const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";

const MAX_SAFE_REDIRECTS = 5;

function isPrivateIp(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length === 4) {
    const [a, b] = parts.map(Number);
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 0) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
  }

  if (ip === "::1" || ip === "::") return true;
  if (ip.startsWith("fc") || ip.startsWith("fd")) return true;
  if (ip.startsWith("fe80")) return true;

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
