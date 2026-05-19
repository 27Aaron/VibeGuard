import { NextRequest, NextResponse } from "next/server"

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

  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return new NextResponse("Only http/https URLs are allowed", { status: 400 })
  }

  try {
    const upstream = await fetch(target.toString(), {
      signal: AbortSignal.timeout(10_000),
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "image/*",
      },
    })

    if (!upstream.ok) {
      return new NextResponse(`Upstream returned ${upstream.status}`, {
        status: upstream.status,
      })
    }

    const contentType = upstream.headers.get("Content-Type") ?? "application/octet-stream"
    const body = await upstream.arrayBuffer()

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    })
  } catch {
    return new NextResponse("Failed to fetch upstream image", { status: 502 })
  }
}
