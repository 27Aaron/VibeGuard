"use server";

import { cookies } from "next/headers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  clearLoginFailures,
  createAdminSessionToken,
  getAdminAuthConfig,
  isLoginRateLimited,
  recordFailedLogin,
  resolveLoginRateLimitKey,
  sanitizeAdminReturnPath,
  verifyAdminPassword,
} from "../admin-auth";
import { resolveLang } from "../i18n";

function buildLoginRedirect(
  lang: "zh" | "en",
  error: "1" | "config" | "rate",
  from: string,
) {
  const params = new URLSearchParams({
    error,
    from,
  });

  return `/${lang}/admin/login?${params.toString()}`;
}

export async function loginAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const lang = resolveLang(String(formData.get("lang") ?? "zh"));
  const from = sanitizeAdminReturnPath(
    String(formData.get("from") ?? `/${lang}/admin`),
    lang,
  );
  const config = getAdminAuthConfig();

  if (!config) {
    redirect(buildLoginRedirect(lang, "config", from));
  }

  const headerStore = await headers();
  const rateLimitKey = resolveLoginRateLimitKey(headerStore);

  if (isLoginRateLimited(rateLimitKey)) {
    redirect(buildLoginRedirect(lang, "rate", from));
  }

  if (!(await verifyAdminPassword(password, config.password))) {
    recordFailedLogin(rateLimitKey);
    redirect(buildLoginRedirect(lang, "1", from));
  }

  clearLoginFailures(rateLimitKey);
  const cookieStore = await cookies();

  cookieStore.set(ADMIN_SESSION_COOKIE, await createAdminSessionToken(config), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  });

  redirect(from);
}

export async function logoutAction(formData: FormData) {
  const lang = resolveLang(String(formData.get("lang") ?? "zh"));
  const cookieStore = await cookies();

  cookieStore.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  redirect(`/${lang}/admin/login`);
}
