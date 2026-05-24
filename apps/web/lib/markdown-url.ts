const SAFE_LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);
const SAFE_IMAGE_PROTOCOLS = new Set(["http:", "https:"]);

function resolveAssetUrl(rawUrl: string, sourceUrl?: string) {
  if (!rawUrl) {
    return rawUrl;
  }

  try {
    return new URL(rawUrl, sourceUrl).toString();
  } catch {
    return rawUrl;
  }
}

function resolveUrl(rawUrl: string, sourceUrl?: string) {
  const resolved = resolveAssetUrl(rawUrl, sourceUrl);

  if (!resolved) {
    return null;
  }

  if (resolved.startsWith("#")) {
    return {
      protocol: "#",
      href: resolved,
    };
  }

  try {
    const url = new URL(resolved);

    return {
      protocol: url.protocol,
      href: url.toString(),
    };
  } catch {
    return null;
  }
}

export function resolveMarkdownLinkUrl(rawUrl: string, sourceUrl?: string) {
  const resolved = resolveUrl(rawUrl, sourceUrl);

  if (!resolved) {
    return "#";
  }

  if (resolved.protocol === "#") {
    return resolved.href;
  }

  if (!SAFE_LINK_PROTOCOLS.has(resolved.protocol)) {
    return "#";
  }

  return resolved.href;
}

export function resolveMarkdownImageProxyUrl(
  rawUrl: string,
  sourceUrl?: string,
) {
  const resolved = resolveUrl(rawUrl, sourceUrl);

  if (!resolved || !SAFE_IMAGE_PROTOCOLS.has(resolved.protocol)) {
    return "";
  }

  return `/api/proxy?url=${encodeURIComponent(resolved.href)}`;
}
