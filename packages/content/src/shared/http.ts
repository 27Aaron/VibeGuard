export const DEFAULT_USER_AGENT =
  "vibeguard-bot/0.1 (+https://vibeguard.dev)";

export function assertHttpUrl(url: string) {
  const parsed = new URL(url);

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("URL must use http or https.");
  }
}
