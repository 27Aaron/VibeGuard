type ThemeTransitionOptions = {
  originX: number
  originY: number
  reducedMotion?: boolean
  applyTheme: () => void
}

type ThemeTransitionResult = {
  finished: Promise<void>
  cleanup: () => void
}

type DocumentWithViewTransition = Document & {
  startViewTransition?: (callback: () => void | Promise<void>) => {
    finished: Promise<void>
  }
}

const TRANSITION_CLASS = "theme-transition-active"
const THEME_TRANSITION_DURATION_MS = 400

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

export function createThemeTransition({
  originX,
  originY,
  reducedMotion = prefersReducedMotion(),
  applyTheme,
}: ThemeTransitionOptions): ThemeTransitionResult {
  const documentWithTransition = document as DocumentWithViewTransition
  const root = document.documentElement

  const cleanup = () => {
    root.classList.remove(TRANSITION_CLASS)
    root.style.removeProperty("--theme-transition-x")
    root.style.removeProperty("--theme-transition-y")
    root.style.removeProperty("--theme-transition-radius")
    root.style.removeProperty("--theme-transition-duration")
  }

  if (reducedMotion || typeof documentWithTransition.startViewTransition !== "function") {
    applyTheme()

    return {
      finished: Promise.resolve(),
      cleanup,
    }
  }

  const maxRadius = Math.hypot(
    Math.max(originX, window.innerWidth - originX),
    Math.max(originY, window.innerHeight - originY),
  )

  root.style.setProperty("--theme-transition-x", `${originX}px`)
  root.style.setProperty("--theme-transition-y", `${originY}px`)
  root.style.setProperty("--theme-transition-radius", `${maxRadius}px`)
  root.style.setProperty("--theme-transition-duration", `${THEME_TRANSITION_DURATION_MS}ms`)
  root.classList.add(TRANSITION_CLASS)

  const transition = documentWithTransition.startViewTransition(() => {
    applyTheme()
  })

  return {
    finished: transition.finished.finally(() => {
      cleanup()
    }),
    cleanup,
  }
}
