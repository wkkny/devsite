import { useEffect, useState, type ReactNode } from 'react'

import { ThemeProviderContext, type ResolvedTheme, type Theme } from '@/components/theme-context'

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getStoredTheme(): Theme {
  const stored = localStorage.getItem('theme')
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'dark'
}

function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme)
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => getSystemTheme())

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const applyTheme = () => {
      const nextTheme = theme === 'system' ? getSystemTheme() : theme
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
    localStorage.setItem('theme', nextTheme)
    setThemeState(nextTheme)
  }

  return (
    <ThemeProviderContext value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeProviderContext>
  )
}

export { ThemeProvider }
