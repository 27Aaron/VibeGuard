import { NextRequest, NextResponse } from "next/server"

const SUPPORTED_LANGS = new Set(["zh", "en"])
const ENGLISH_LANG_ALIASES = new Set(["us"])

function isValidLang(value: string): value is "zh" | "en" {
  return SUPPORTED_LANGS.has(value)
}

function isEnglishLangAlias(value: string | undefined): value is "us" {
  return value ? ENGLISH_LANG_ALIASES.has(value) : false
}

function resolveLegacyLang(request: NextRequest): "zh" | "en" {
  const lang = request.nextUrl.searchParams.get("lang")
  if (isEnglishLangAlias(lang ?? undefined)) {
    return "en"
  }

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

function nextWithLang(request: NextRequest, lang: "zh" | "en") {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-vibeguard-lang", lang)
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
  response.cookies.set("lang", lang, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  })
  return response
}

function redirectToLangPath(
  request: NextRequest,
  lang: "zh" | "en",
  pathSegments: string[],
) {
  const url = request.nextUrl.clone()
  const suffix = pathSegments.join("/")
  url.pathname = suffix ? `/${lang}/${suffix}` : `/${lang}`
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
    (isValidLang(firstSegment) || isEnglishLangAlias(firstSegment)) &&
    segments[1] === "rss.xml"
  ) {
    return redirectToFeed(request, isEnglishLangAlias(firstSegment) ? "en" : firstSegment)
  }

  if (isEnglishLangAlias(firstSegment)) {
    return redirectToLangPath(request, "en", segments.slice(1))
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

    return nextWithLang(request, firstSegment)
  }

  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.includes(".")
  ) {
    return NextResponse.next()
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
