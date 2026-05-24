import { cookies, headers } from "next/headers";

import { resolveLang, type AppLang } from "@/lib/i18n";

export async function getRequestLang(): Promise<AppLang> {
  const headerStore = await headers();
  const headerLang = headerStore.get("x-vibeguard-lang");

  if (headerLang === "zh" || headerLang === "en") {
    return headerLang;
  }

  const cookieStore = await cookies();
  return resolveLang(cookieStore.get("lang")?.value);
}
