import { createContext, useContext } from 'react'

type Theme = 'light' | 'dark'

type ThemeContextValue = {
  theme: Theme
  isTransitioning: boolean
  /** Starts the switch. `origin` is where the new theme grows from, in viewport px. */
  toggleTheme: (origin?: { x: number; y: number }) => boolean
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}

export { ThemeContext, useTheme }
export type { Theme }
