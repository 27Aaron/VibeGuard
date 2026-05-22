export const THEME_STORAGE_KEY = "vibeguard-theme"
export const THEME_COOKIE_KEY = "vibeguard-theme"

export type ThemePreference = "light" | "dark" | "system"
export type ResolvedTheme = "light" | "dark"

export function applyResolvedTheme(resolved: ResolvedTheme) {
  document.documentElement.classList.toggle("dark", resolved === "dark")
  document.documentElement.dataset.theme = resolved
}

export function readStoredThemePreference(): ThemePreference {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
  return stored === "light" || stored === "dark" ? stored : "system"
}

export function writeStoredThemePreference(preference: Exclude<ThemePreference, "system">) {
  window.localStorage.setItem(THEME_STORAGE_KEY, preference)
  document.cookie = `${THEME_COOKIE_KEY}=${preference}; path=/; max-age=31536000; samesite=lax`
}
