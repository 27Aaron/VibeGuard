import { afterEach, describe, expect, it, vi } from "vitest"

import {
  GET,
  IMAGE_PROXY_MAX_BYTES,
  isPrivateIpAddress,
  readBoundedResponseBody,
} from "../apps/web/app/api/proxy/route"

const originalFetch = globalThis.fetch
type ProxyRequest = Parameters<typeof GET>[0]

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

function proxyRequest(target: string) {
  return {
    nextUrl: new URL(
      `http://vibeguard.test/api/proxy?url=${encodeURIComponent(target)}`,
    ),
  } as ProxyRequest
}

describe("image proxy safety", () => {
  it("rejects local and private network targets before fetching", async () => {
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock

    const response = await GET(proxyRequest("http://127.0.0.1/admin"))

    expect(response.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("identifies non-public IP ranges", () => {
    expect(isPrivateIpAddress("127.0.0.1")).toBe(true)
    expect(isPrivateIpAddress("10.10.0.1")).toBe(true)
    expect(isPrivateIpAddress("172.20.1.1")).toBe(true)
    expect(isPrivateIpAddress("192.168.1.10")).toBe(true)
    expect(isPrivateIpAddress("169.254.10.20")).toBe(true)
    expect(isPrivateIpAddress("::1")).toBe(true)
    expect(isPrivateIpAddress("fc00::1")).toBe(true)
    expect(isPrivateIpAddress("fe80::1")).toBe(true)
    expect(isPrivateIpAddress("93.184.216.34")).toBe(false)
    expect(isPrivateIpAddress("2606:2800:220:1:248:1893:25c8:1946")).toBe(false)
  })

  it("rejects redirects into local network targets", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: {
          location: "http://127.0.0.1/secret.png",
        },
      }),
    )
    globalThis.fetch = fetchMock

    const response = await GET(proxyRequest("http://93.184.216.34/image.png"))

    expect(response.status).toBe(400)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("rejects upstream responses that are not images", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response("<html></html>", {
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
        },
      }),
    )

    const response = await GET(proxyRequest("http://93.184.216.34/page"))

    expect(response.status).toBe(415)
  })

  it("stops reading image responses above the byte limit", async () => {
    const body = new Uint8Array(IMAGE_PROXY_MAX_BYTES + 1)
    const response = new Response(body, {
      headers: {
        "content-type": "image/png",
        "content-length": String(IMAGE_PROXY_MAX_BYTES + 1),
      },
    })

    await expect(readBoundedResponseBody(response)).rejects.toThrow(
      "Upstream image is too large.",
    )
  })
})
