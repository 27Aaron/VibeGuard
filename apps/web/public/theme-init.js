(() => {
  const storageKey = "vibeguard-theme";
  const root = document.documentElement;
  const stored = localStorage.getItem(storageKey);
  const preference = stored === "light" || stored === "dark" ? stored : "system";
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved = preference === "system" ? (prefersDark ? "dark" : "light") : preference;
  root.classList.toggle("dark", resolved === "dark");
  root.dataset.theme = resolved;
})();
