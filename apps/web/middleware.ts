import { NextRequest, NextResponse } from "next/server"

const SUPPORTED_LANGS = new Set(["zh", "en"])

function isValidLang(value: string): value is "zh" | "en" {
  return SUPPORTED_LANGS.has(value)
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip API routes and static files
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.includes(".")
  ) {
    return NextResponse.next()
  }

  // Check if the path already has a lang prefix
  const segments = pathname.split("/").filter(Boolean)
  const firstSegment = segments[0]

  if (firstSegment && isValidLang(firstSegment)) {
    // Already has lang prefix, set cookie and pass through
    const response = NextResponse.next()
    response.cookies.set("lang", firstSegment, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    })
    return response
  }

  // No valid lang prefix — redirect to /zh/...
  const lang = "zh"
  const url = request.nextUrl.clone()
  url.pathname = `/${lang}${pathname}`
  const response = NextResponse.redirect(url)
  response.cookies.set("lang", lang, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  })
  return response
}

export const config = {
  matcher: [
    // Match all paths except static files and API
    "/((?!api/|_next/|favicon.ico|icon.svg|robots.txt|sitemap.xml).*)",
  ],
}
