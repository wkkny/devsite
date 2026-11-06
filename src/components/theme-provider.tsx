import { useEffect, useRef, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'

import { ThemeContext, type Theme } from '@/components/theme-context'
import { PixelReveal, type RevealColors } from '@/components/pixel-reveal'
import { ThemeWave } from '@/components/theme-wave'
import { WAVE_DURATION, WAVE_EASE, waveRadius, type WaveClock, type WaveOrigin } from '@/lib/theme-wave'

// Matches --background in index.css, so the browser UI follows the site theme.
const THEME_COLORS: Record<Theme, string> = { light: '#ffffff', dark: '#060606' }
const SKIP_THEME_REVEAL_QUERY = '(prefers-reduced-motion: reduce), (pointer: coarse), (max-width: 768px)'
// The view-transition wave is cheap enough for phones too; only reduced motion skips it.
const SKIP_THEME_WAVE_QUERY = '(prefers-reduced-motion: reduce)'
// The dithered fringe is the expensive part, so small touch screens get the clean circle.
const PLAIN_WAVE_QUERY = '(pointer: coarse) and (max-width: 768px)'

function readColors(): RevealColors {
  const styles = getComputedStyle(document.documentElement)
  return {
    background: styles.getPropertyValue('--background').trim(),
    foreground: styles.getPropertyValue('--foreground').trim(),
    blue: styles.getPropertyValue('--portfolio-blue').trim(),
  }
}

function applyThemeToDocument(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.style.colorScheme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme])
}

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
  const [wave, setWave] = useState<{ id: number; origin: WaveOrigin; oldColors: RevealColors; clock: WaveClock } | null>(null)
  const [waving, setWaving] = useState(false)
  const nextRevealId = useRef(0)
  const transitioning = useRef(false)

  useEffect(() => {
    applyThemeToDocument(theme)
  }, [theme])

  const applyTheme = (nextTheme: Theme) => {
    applyThemeToDocument(nextTheme)
    try {
      window.localStorage.setItem('theme', nextTheme)
    } catch {
      // The visual toggle still works when storage is unavailable.
    }
    flushSync(() => setTheme(nextTheme))
  }

  // The new theme grows out of the toggle: the browser keeps a still of the old page while the
  // live new one is revealed through an expanding circle, with a dithered fringe on its edge.
  const waveTheme = (nextTheme: Theme, origin: WaveOrigin) => {
    transitioning.current = true
    setWaving(true)
    const oldColors = readColors()
    const fringe = !window.matchMedia(PLAIN_WAVE_QUERY).matches
    const id = ++nextRevealId.current
    const clock: WaveClock = { animation: null }
    const transition = document.startViewTransition(() => {
      applyTheme(nextTheme)
      if (fringe) flushSync(() => setWave({ id, origin, oldColors, clock }))
    })
    const radius = waveRadius(origin)
    void transition.ready
      .then(() => {
        clock.animation = document.documentElement.animate(
          { clipPath: [`circle(0px at ${origin.x}px ${origin.y}px)`, `circle(${radius}px at ${origin.x}px ${origin.y}px)`] },
          { duration: WAVE_DURATION, easing: `cubic-bezier(${WAVE_EASE.join(', ')})`, pseudoElement: '::view-transition-new(root)', fill: 'forwards' },
        )
        // With a fringe, its frame loop steps the clip; without one the clip runs by itself.
        if (fringe) clock.animation.pause()
      })
      .catch(() => undefined)
    void transition.finished.finally(() => {
      transitioning.current = false
      setWaving(false)
      setWave((current) => (current?.id === id ? null : current))
    })
  }

  const toggleTheme = (origin?: WaveOrigin) => {
    if (transitioning.current) return false
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    if (typeof document.startViewTransition === 'function' && !window.matchMedia(SKIP_THEME_WAVE_QUERY).matches) {
      waveTheme(nextTheme, origin ?? { x: window.innerWidth, y: 0 })
      return true
    }
    if (window.matchMedia(SKIP_THEME_REVEAL_QUERY).matches) {
      applyTheme(nextTheme)
      return true
    }

    transitioning.current = true
    setReveal({ id: ++nextRevealId.current, nextTheme, colors: readColors() })
    return true
  }

  return (
    <ThemeContext.Provider value={{ theme, isTransitioning: reveal !== null || waving, toggleTheme }}>
      {children}
      {wave && <ThemeWave key={wave.id} origin={wave.origin} oldColors={wave.oldColors} clock={wave.clock} />}
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
