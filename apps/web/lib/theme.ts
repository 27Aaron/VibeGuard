export const THEME_STORAGE_KEY = "vibeguard-theme"

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
