import { revalidatePath } from "next/cache";

import type { AppLang } from "./i18n";

const SUPPORTED_LANGS: AppLang[] = ["zh", "en"];

function hasLocalePrefix(path: string) {
  return SUPPORTED_LANGS.some(
    (lang) => path === `/${lang}` || path.startsWith(`/${lang}/`),
  );
}

function shouldExpandToLocalizedPaths(path: string) {
  return (
    path === "/" ||
    path.startsWith("/admin") ||
    path.startsWith("/articles") ||
    path === "/feed.xml"
  );
}

function localizePath(path: string, lang: string) {
  if (path === "/") {
    return `/${lang}`;
  }

  return `/${lang}${path}`;
}

export function getLocalizedRevalidationPaths(paths: string[]) {
  const expanded = new Set<string>();

  for (const path of paths) {
    expanded.add(path);

    if (!hasLocalePrefix(path) && shouldExpandToLocalizedPaths(path)) {
      for (const lang of SUPPORTED_LANGS) {
        expanded.add(localizePath(path, lang));
      }
    }
  }

  return Array.from(expanded);
}

export function revalidateLocalizedPaths(...paths: string[]) {
  for (const path of getLocalizedRevalidationPaths(paths)) {
    revalidatePath(path);
  }
}
