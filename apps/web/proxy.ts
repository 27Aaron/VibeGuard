import { NextRequest, NextResponse } from "next/server"

const SUPPORTED_LANGS = new Set(["zh", "en"])

function isValidLang(value: string): value is "zh" | "en" {
  return SUPPORTED_LANGS.has(value)
}

function resolveLegacyLang(request: NextRequest): "zh" | "en" {
  const lang = request.nextUrl.searchParams.get("lang")
  return lang && isValidLang(lang) ? lang : "zh"
}

function redirectToFeed(request: NextRequest, lang: "zh" | "en") {
  const url = request.nextUrl.clone()
  url.pathname = `/${lang}/feed.xml`
  url.searchParams.delete("lang")
  const response = NextResponse.redirect(url)
  response.cookies.set("lang", lang, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  })
  return response
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const segments = pathname.split("/").filter(Boolean)
  const firstSegment = segments[0]

  if (pathname === "/rss.xml" || pathname === "/feed.xml") {
    return redirectToFeed(request, resolveLegacyLang(request))
  }

  if (
    segments.length === 2 &&
    isValidLang(firstSegment) &&
    segments[1] === "rss.xml"
  ) {
    return redirectToFeed(request, firstSegment)
  }

  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.includes(".")
  ) {
    return NextResponse.next()
  }

  if (firstSegment && isValidLang(firstSegment)) {
    if (request.nextUrl.searchParams.has("lang")) {
      const url = request.nextUrl.clone()
      url.searchParams.delete("lang")
      const response = NextResponse.redirect(url)
      response.cookies.set("lang", firstSegment, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
      })
      return response
    }

    const response = NextResponse.next()
    response.cookies.set("lang", firstSegment, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    })
    return response
  }

  const lang = resolveLegacyLang(request)
  const url = request.nextUrl.clone()
  url.pathname = `/${lang}${pathname}`
  url.searchParams.delete("lang")
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
    "/((?!api/|_next/|favicon.ico|icon.svg|robots.txt|sitemap.xml).*)",
  ],
}
