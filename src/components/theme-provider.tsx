import { useEffect, useRef, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'

import { ThemeContext, type Theme } from '@/components/theme-context'
import { PixelReveal, type RevealColors } from '@/components/pixel-reveal'

const SKIP_THEME_REVEAL_QUERY = '(prefers-reduced-motion: reduce), (pointer: coarse), (max-width: 768px)'

function getInitialTheme(): Theme {
  try {
    const storedTheme = window.localStorage.getItem('theme')
    if (storedTheme === 'light' || storedTheme === 'dark') return storedTheme
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const [reveal, setReveal] = useState<{ id: number; nextTheme: Theme; colors: RevealColors } | null>(null)
  const nextRevealId = useRef(0)
  const transitioning = useRef(false)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.style.colorScheme = theme
  }, [theme])

  const applyTheme = (nextTheme: Theme) => {
    document.documentElement.classList.toggle('dark', nextTheme === 'dark')
    document.documentElement.style.colorScheme = nextTheme
    try {
      window.localStorage.setItem('theme', nextTheme)
    } catch {
      // The visual toggle still works when storage is unavailable.
    }
    flushSync(() => setTheme(nextTheme))
  }

  const toggleTheme = () => {
    if (transitioning.current) return false
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    if (window.matchMedia(SKIP_THEME_REVEAL_QUERY).matches) {
      applyTheme(nextTheme)
      return true
    }

    const styles = getComputedStyle(document.documentElement)
    transitioning.current = true
    setReveal({
      id: ++nextRevealId.current,
      nextTheme,
      colors: {
        background: styles.getPropertyValue('--background').trim(),
        foreground: styles.getPropertyValue('--foreground').trim(),
        blue: styles.getPropertyValue('--portfolio-blue').trim(),
      },
    })
    return true
  }

  return (
    <ThemeContext.Provider value={{ theme, isTransitioning: reveal !== null, toggleTheme }}>
      {children}
      {reveal && (
        <PixelReveal
          key={reveal.id}
          colors={reveal.colors}
          onCovered={() => applyTheme(reveal.nextTheme)}
          onRevealComplete={() => {
            transitioning.current = false
            setReveal((current) => current?.id === reveal.id ? null : current)
          }}
        />
      )}
    </ThemeContext.Provider>
  )
}

export { ThemeProvider }
