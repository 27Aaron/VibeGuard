import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

import { NextRequest, NextResponse } from "next/server"

import { normalizeInt } from "@vibeguard/shared"

export const IMAGE_PROXY_MAX_BYTES = 5_000_000
const DEFAULT_IMAGE_PROXY_MAX_REDIRECTS = 3
const DEFAULT_IMAGE_PROXY_FETCH_TIMEOUT_MS = 10_000
const DEFAULT_IMAGE_PROXY_DNS_CACHE_SIZE = 128
const DEFAULT_IMAGE_PROXY_DNS_CACHE_TTL_MS = 60_000

type CachedDnsLookup = {
  addresses: Array<{ address: string; family: number }>
  expiresAt: number
}

const IMAGE_PROXY_BYTES = normalizeInt(
  process.env.IMAGE_PROXY_MAX_BYTES,
  IMAGE_PROXY_MAX_BYTES,
)
const IMAGE_PROXY_MAX_REDIRECTS = normalizeInt(
  process.env.IMAGE_PROXY_MAX_REDIRECTS,
  DEFAULT_IMAGE_PROXY_MAX_REDIRECTS,
)
const IMAGE_PROXY_FETCH_TIMEOUT_MS = normalizeInt(
  process.env.IMAGE_PROXY_FETCH_TIMEOUT_MS,
  DEFAULT_IMAGE_PROXY_FETCH_TIMEOUT_MS,
  250,
)
const IMAGE_PROXY_DNS_CACHE_SIZE = normalizeInt(
  process.env.IMAGE_PROXY_DNS_CACHE_SIZE,
  DEFAULT_IMAGE_PROXY_DNS_CACHE_SIZE,
  0,
)
const IMAGE_PROXY_DNS_CACHE_TTL_MS = normalizeInt(
  process.env.IMAGE_PROXY_DNS_CACHE_TTL_MS,
  DEFAULT_IMAGE_PROXY_DNS_CACHE_TTL_MS,
)

const dnsLookupCache = new Map<string, CachedDnsLookup>()

function getCachedDnsLookup(hostname: string, now = Date.now()) {
  const cached = dnsLookupCache.get(hostname)

  if (!cached) {
    return null
  }

  if (cached.expiresAt <= now) {
    dnsLookupCache.delete(hostname)
    return null
  }

  dnsLookupCache.delete(hostname)
  dnsLookupCache.set(hostname, cached)

  return cached.addresses
}

function cacheDnsLookup(
  hostname: string,
  addresses: CachedDnsLookup["addresses"],
) {
  if (IMAGE_PROXY_DNS_CACHE_SIZE <= 0) {
    return
  }

  while (dnsLookupCache.size >= IMAGE_PROXY_DNS_CACHE_SIZE) {
    const firstKey = dnsLookupCache.keys().next().value

    if (firstKey === undefined) {
      break
    }

    dnsLookupCache.delete(firstKey)
  }

  dnsLookupCache.set(hostname, {
    addresses,
    expiresAt: Date.now() + IMAGE_PROXY_DNS_CACHE_TTL_MS,
  })
}

class ImageProxyError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
  }
}

function normalizeHostname(hostname: string) {
  return hostname.replace(/^\[|\]$/g, "").toLowerCase()
}

function parseIpv4(address: string) {
  const parts = address.split(".")

  if (parts.length !== 4) {
    return null
  }

  let value = 0

  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) {
      return null
    }

    const octet = Number(part)

    if (!Number.isInteger(octet) || octet < 0 || octet > 255) {
      return null
    }

    value = (value << 8) + octet
  }

  return value >>> 0
}

function ipv4InRange(value: number, base: string, prefixLength: number) {
  const baseValue = parseIpv4(base)

  if (baseValue === null) {
    return false
  }

  const mask =
    prefixLength === 0 ? 0 : (0xffffffff << (32 - prefixLength)) >>> 0

  return (value & mask) === (baseValue & mask)
}

function isPrivateIpv4(address: string) {
  const value = parseIpv4(address)

  if (value === null) {
    return false
  }

  return [
    ["0.0.0.0", 8],
    ["10.0.0.0", 8],
    ["100.64.0.0", 10],
    ["127.0.0.0", 8],
    ["169.254.0.0", 16],
    ["172.16.0.0", 12],
    ["192.0.0.0", 24],
    ["192.168.0.0", 16],
    ["198.18.0.0", 15],
    ["224.0.0.0", 4],
    ["240.0.0.0", 4],
  ].some(([base, prefixLength]) =>
    ipv4InRange(value, String(base), Number(prefixLength)),
  )
}

function isPrivateIpv6(address: string) {
  const normalized = normalizeHostname(address)
  const mappedIpv4 = normalized.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/)

  if (mappedIpv4) {
    return isPrivateIpv4(mappedIpv4[1])
  }

  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    /^fe[89ab]/.test(normalized) ||
    normalized.startsWith("ff")
  )
}

export function isPrivateIpAddress(address: string) {
  const normalized = normalizeHostname(address)
  const family = isIP(normalized)

  if (family === 4) {
    return isPrivateIpv4(normalized)
  }

  if (family === 6) {
    return isPrivateIpv6(normalized)
  }

  return false
}

async function assertSafeProxyTarget(target: URL) {
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    throw new ImageProxyError("Only http/https URLs are allowed", 400)
  }

  if (target.username || target.password) {
    throw new ImageProxyError("URL credentials are not allowed", 400)
  }

  const hostname = normalizeHostname(target.hostname)

  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  ) {
    throw new ImageProxyError("Local network URLs are not allowed", 400)
  }

  if (isIP(hostname)) {
    if (isPrivateIpAddress(hostname)) {
      throw new ImageProxyError("Local network URLs are not allowed", 400)
    }

    return
  }

  let addresses = getCachedDnsLookup(hostname)

  if (!addresses) {
    try {
      addresses = await lookup(hostname, {
        all: true,
        verbatim: true,
      })
    } catch {
      throw new ImageProxyError("Unable to resolve proxy target", 400)
    }

    cacheDnsLookup(hostname, addresses)
  }

  if (
    addresses.length === 0 ||
    addresses.some((address) => isPrivateIpAddress(address.address))
  ) {
    throw new ImageProxyError("Local network URLs are not allowed", 400)
  }
}

function isRedirectResponse(response: Response) {
  return [301, 302, 303, 307, 308].includes(response.status)
}

function isAllowedImageContentType(contentType: string | null) {
  return contentType?.split(";")[0]?.trim().toLowerCase().startsWith("image/") ?? false
}

export async function readBoundedResponseBody(
  response: Response,
  maxBytes = IMAGE_PROXY_BYTES,
) {
  const contentLength = Number(response.headers.get("content-length") ?? "0")

  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new ImageProxyError("Upstream image is too large.", 413)
  }

  if (!response.body) {
    const body = new Uint8Array(await response.arrayBuffer())

    if (body.byteLength > maxBytes) {
      throw new ImageProxyError("Upstream image is too large.", 413)
    }

    return body
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0

  while (true) {
    const { done, value } = await reader.read()

    if (done) {
      break
    }

    if (!value) {
      continue
    }

    totalBytes += value.byteLength

    if (totalBytes > maxBytes) {
      await reader.cancel()
      throw new ImageProxyError("Upstream image is too large.", 413)
    }

    chunks.push(value)
  }

  const body = new Uint8Array(totalBytes)
  let offset = 0

  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }

  return body
}

async function fetchSafeImage(target: URL, remainingRedirects = IMAGE_PROXY_MAX_REDIRECTS) {
  await assertSafeProxyTarget(target)

  const upstream = await fetch(target.toString(), {
    redirect: "manual",
    signal: AbortSignal.timeout(IMAGE_PROXY_FETCH_TIMEOUT_MS),
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept: "image/*",
    },
  })

  if (!isRedirectResponse(upstream)) {
    return upstream
  }

  const location = upstream.headers.get("location")

  if (!location) {
    throw new ImageProxyError("Upstream redirect is missing a location", 502)
  }

  if (remainingRedirects <= 0) {
    throw new ImageProxyError("Upstream returned too many redirects", 502)
  }

  return fetchSafeImage(new URL(location, target), remainingRedirects - 1)
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url")

  if (!raw) {
    return new NextResponse("Missing url parameter", { status: 400 })
  }

  let target: URL
  try {
    target = new URL(raw)
  } catch {
    return new NextResponse("Invalid URL", { status: 400 })
  }

  try {
    const upstream = await fetchSafeImage(target)

    if (!upstream.ok) {
      return new NextResponse(`Upstream returned ${upstream.status}`, {
        status: upstream.status,
      })
    }

    const contentType = upstream.headers.get("Content-Type") ?? "application/octet-stream"

    if (!isAllowedImageContentType(contentType)) {
      throw new ImageProxyError("Upstream did not return an image", 415)
    }

    const body = await readBoundedResponseBody(upstream)

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'",
      },
    })
  } catch (error) {
    if (error instanceof ImageProxyError) {
      return new NextResponse(error.message, { status: error.status })
    }

    return new NextResponse("Failed to fetch upstream image", { status: 502 })
  }
}
