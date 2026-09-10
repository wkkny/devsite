import { useEffect, useState, type ReactNode } from 'react'

import { ThemeProviderContext, type ResolvedTheme, type Theme } from '@/components/theme-context'

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem('theme')
    return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'dark'
  } catch {
    return 'dark'
  }
}

function resolveTheme(theme: Theme): ResolvedTheme {
  return theme === 'system' ? getSystemTheme() : theme
}

function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme)
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(theme))

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const applyTheme = () => {
      const nextTheme = resolveTheme(theme)
      const root = document.documentElement

      root.classList.remove('light', 'dark')
      root.classList.add(nextTheme)
      root.style.colorScheme = nextTheme
      setResolvedTheme(nextTheme)
    }

    applyTheme()
    mediaQuery.addEventListener('change', applyTheme)

    return () => mediaQuery.removeEventListener('change', applyTheme)
  }, [theme])

  const setTheme = (nextTheme: Theme) => {
    try {
      localStorage.setItem('theme', nextTheme)
    } catch {
      // The selected theme still applies when storage is unavailable.
    }
    setThemeState(nextTheme)
  }

  return (
    <ThemeProviderContext value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeProviderContext>
  )
}

export { ThemeProvider }
