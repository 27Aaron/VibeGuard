import { NextRequest, NextResponse } from "next/server";

import {
  ADMIN_SESSION_COOKIE,
  getAdminAuthConfig,
  sanitizeAdminReturnPath,
  verifyAdminSessionToken,
} from "./lib/admin-auth";

const SUPPORTED_LANGS = new Set(["zh", "en"]);
const ENGLISH_LANG_ALIASES = new Set(["us"]);

async function checkAdminAuth(
  request: NextRequest,
  lang: string,
  target: "page" | "api",
): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl;
  const segments = pathname.split("/").filter(Boolean);

  if (target === "page" && segments[1] !== "admin") {
    return null;
  }

  if (target === "page" && segments[2] === "login") {
    return null;
  }

  const config = getAdminAuthConfig();

  if (!config) {
    if (target === "api") {
      return NextResponse.json(
        {
          ok: false,
          message: "Admin authentication is not configured safely.",
        },
        { status: 503 },
      );
    }

    return redirectToLogin(request, lang, "config");
  }

  const session = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;

  if (await verifyAdminSessionToken(session, config)) {
    return null;
  }

  if (target === "api") {
    return NextResponse.json(
      {
        ok: false,
        message: "Authentication required.",
      },
      { status: 401 },
    );
  }

  return redirectToLogin(request, lang, "auth");
}

function isValidLang(value: string): value is "zh" | "en" {
  return SUPPORTED_LANGS.has(value);
}

function isEnglishLangAlias(value: string | undefined): value is "us" {
  return value ? ENGLISH_LANG_ALIASES.has(value) : false;
}

function resolveLegacyLang(request: NextRequest): "zh" | "en" {
  const lang = request.nextUrl.searchParams.get("lang");
  if (isEnglishLangAlias(lang ?? undefined)) {
    return "en";
  }

  return lang && isValidLang(lang) ? lang : "zh";
}

function resolveRequestLang(request: NextRequest): "zh" | "en" {
  const queryLang = request.nextUrl.searchParams.get("lang");
  const cookieLang = request.cookies.get("lang")?.value;
  const lang = queryLang || cookieLang;

  if (isEnglishLangAlias(lang ?? undefined)) {
    return "en";
  }

  return lang && isValidLang(lang) ? lang : "zh";
}

function redirectToLogin(
  request: NextRequest,
  lang: string,
  error: "auth" | "config",
) {
  const loginUrl = new URL(`/${lang}/admin/login`, request.url);
  const returnPath = sanitizeAdminReturnPath(
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
    lang === "en" ? "en" : "zh",
  );

  if (error === "config") {
    loginUrl.searchParams.set("error", "config");
  }

  loginUrl.searchParams.set("from", returnPath);

  return NextResponse.redirect(loginUrl);
}

function redirectToFeed(request: NextRequest, lang: "zh" | "en") {
  const url = request.nextUrl.clone();
  url.pathname = `/${lang}/feed.xml`;
  url.searchParams.delete("lang");
  const response = NextResponse.redirect(url);
  response.cookies.set("lang", lang, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return response;
}

function nextWithLang(request: NextRequest, lang: "zh" | "en") {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-vibeguard-lang", lang);
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  response.cookies.set("lang", lang, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return response;
}

function redirectToLangPath(
  request: NextRequest,
  lang: "zh" | "en",
  pathSegments: string[],
) {
  const url = request.nextUrl.clone();
  const suffix = pathSegments.join("/");
  url.pathname = suffix ? `/${lang}/${suffix}` : `/${lang}`;
  url.searchParams.delete("lang");
  const response = NextResponse.redirect(url);
  response.cookies.set("lang", lang, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const segments = pathname.split("/").filter(Boolean);
  const firstSegment = segments[0];

  if (pathname === "/api/admin" || pathname.startsWith("/api/admin/")) {
    const authResponse = await checkAdminAuth(
      request,
      resolveRequestLang(request),
      "api",
    );

    return authResponse ?? NextResponse.next();
  }

  if (pathname === "/rss.xml" || pathname === "/feed.xml") {
    return redirectToFeed(request, resolveLegacyLang(request));
  }

  if (
    segments.length === 2 &&
    (isValidLang(firstSegment) || isEnglishLangAlias(firstSegment)) &&
    segments[1] === "rss.xml"
  ) {
    return redirectToFeed(
      request,
      isEnglishLangAlias(firstSegment) ? "en" : firstSegment,
    );
  }

  if (isEnglishLangAlias(firstSegment)) {
    return redirectToLangPath(request, "en", segments.slice(1));
  }

  if (firstSegment && isValidLang(firstSegment)) {
    if (request.nextUrl.searchParams.has("lang")) {
      const url = request.nextUrl.clone();
      url.searchParams.delete("lang");
      const response = NextResponse.redirect(url);
      response.cookies.set("lang", firstSegment, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
      });
      return response;
    }

    const authRedirect = await checkAdminAuth(request, firstSegment, "page");

    if (authRedirect) {
      return authRedirect;
    }

    return nextWithLang(request, firstSegment);
  }

  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const lang = resolveLegacyLang(request);
  const url = request.nextUrl.clone();
  url.pathname = `/${lang}${pathname}`;
  url.searchParams.delete("lang");
  const response = NextResponse.redirect(url);
  response.cookies.set("lang", lang, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return response;
}

export const config = {
  matcher: [
    "/api/admin/:path*",
    "/((?!api/|_next/|favicon.ico|icon.svg|robots.txt|sitemap.xml).*)",
  ],
};
