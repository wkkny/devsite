import { createContext, useContext } from 'react'

type Theme = 'light' | 'dark' | 'system'
type ResolvedTheme = Exclude<Theme, 'system'>

type ThemeProviderContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: ResolvedTheme
}

const ThemeProviderContext = createContext<ThemeProviderContextValue | null>(null)

function useTheme() {
  const context = useContext(ThemeProviderContext)

  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }

  return context
}

export { ThemeProviderContext, useTheme }
export type { ResolvedTheme, Theme }
