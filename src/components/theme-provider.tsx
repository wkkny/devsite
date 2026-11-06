import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'

import { ThemeContext, type Theme } from '@/components/theme-context'
import { PixelReveal, type RevealColors } from '@/components/pixel-reveal'
import { ThemeWave } from '@/components/theme-wave'
import { sendDitherPulse } from '@/lib/dither-pulse'
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
  const [reveal, setReveal] = useState<{ id: number; nextTheme: Theme; colors: RevealColors; origin: WaveOrigin } | null>(null)
  const [wave, setWave] = useState<{ id: number; origin: WaveOrigin; oldColors: RevealColors; clock: WaveClock } | null>(null)
  const nextRevealId = useRef(0)
  const transitioning = useRef(false)
  // The wave in flight, so a second press can cut it short and send the next one back.
  const activeWave = useRef<{ clock: WaveClock; queued: WaveOrigin | null } | null>(null)
  const themeRef = useRef(theme)
  const queuedReveal = useRef<WaveOrigin | null>(null)
  // Read by the toggle after the fallback cover clears, so it always sees the latest closure.
  const toggleRef = useRef<(origin?: WaveOrigin) => boolean>(() => false)

  // Later changes go through applyTheme, which also times the browser bar color with the wave.
  useEffect(() => {
    applyThemeToDocument(themeRef.current)
  }, [])

  const applyTheme = (nextTheme: Theme) => {
    // Color transitions would trail the old palette behind the cut, so hold them for the swap.
    const root = document.documentElement
    root.dataset.themeSwitching = ''
    requestAnimationFrame(() => requestAnimationFrame(() => delete root.dataset.themeSwitching))
    applyThemeToDocument(nextTheme)
    try {
      window.localStorage.setItem('theme', nextTheme)
    } catch {
      // The visual toggle still works when storage is unavailable.
    }
    themeRef.current = nextTheme
    flushSync(() => setTheme(nextTheme))
  }

  // The new theme grows out of the toggle: the browser keeps a still of the old page while the
  // live new one is revealed through an expanding circle, with a dithered fringe on its edge.
  const waveTheme = (nextTheme: Theme, origin: WaveOrigin) => {
    transitioning.current = true
    const oldColors = readColors()
    const fringe = !window.matchMedia(PLAIN_WAVE_QUERY).matches
    const id = ++nextRevealId.current
    const clock: WaveClock = { animation: null }
    const current = { clock, queued: null as WaveOrigin | null }
    activeWave.current = current
    const meta = document.querySelector('meta[name="theme-color"]')
    const oldMeta = meta?.getAttribute('content')
    const transition = document.startViewTransition(() => {
      applyTheme(nextTheme)
      // The browser bar follows once the wave is a third of the way across, not before it starts.
      if (oldMeta) meta?.setAttribute('content', oldMeta)
      if (fringe) flushSync(() => setWave({ id, origin, oldColors, clock }))
    })
    const metaTimer = window.setTimeout(() => meta?.setAttribute('content', THEME_COLORS[nextTheme]), WAVE_DURATION / 3)
    const radius = waveRadius(origin)
    void transition.ready
      .then(() => {
        // Pressed again before the wave could start: skip straight to the return wave.
        if (current.queued) {
          transition.skipTransition()
          return
        }
        clock.animation = document.documentElement.animate(
          { clipPath: [`circle(0px at ${origin.x}px ${origin.y}px)`, `circle(${radius}px at ${origin.x}px ${origin.y}px)`] },
          { duration: WAVE_DURATION, easing: `cubic-bezier(${WAVE_EASE.join(', ')})`, pseudoElement: '::view-transition-new(root)', fill: 'forwards' },
        )
        // With a fringe, its frame loop steps the clip; without one the clip runs by itself.
        if (fringe) clock.animation.pause()
        // The banner feels the wave pass: a ring leaves the toggle at the circle's pace and shoves
        // the dither field outward as the new theme sweeps through it.
        sendDitherPulse({ clientX: origin.x, clientY: origin.y, speed: radius / (WAVE_DURATION / 1000), strength: 10, boost: 0.4, duration: 0.9 })
      })
      .catch(() => undefined)
    void transition.finished.finally(() => {
      window.clearTimeout(metaTimer)
      meta?.setAttribute('content', THEME_COLORS[themeRef.current])
      transitioning.current = false
      activeWave.current = null
      setWave((shown) => (shown?.id === id ? null : shown))
      if (current.queued) waveTheme(themeRef.current === 'dark' ? 'light' : 'dark', current.queued)
    })
  }

  const toggleTheme = (origin?: WaveOrigin) => {
    // A press mid-wave lands the current wave at once and sends the next one straight back.
    if (activeWave.current) {
      if (activeWave.current.queued) return false
      activeWave.current.queued = origin ?? { x: window.innerWidth, y: 0 }
      activeWave.current.clock.animation?.finish()
      return true
    }
    // The fallback cover queues one press the same way, and plays it once the cover clears.
    if (transitioning.current) {
      if (queuedReveal.current) return false
      queuedReveal.current = origin ?? { x: window.innerWidth, y: 0 }
      return true
    }
    const nextTheme = themeRef.current === 'dark' ? 'light' : 'dark'
    if (typeof document.startViewTransition === 'function' && !window.matchMedia(SKIP_THEME_WAVE_QUERY).matches) {
      waveTheme(nextTheme, origin ?? { x: window.innerWidth, y: 0 })
      return true
    }
    if (window.matchMedia(SKIP_THEME_REVEAL_QUERY).matches) {
      applyTheme(nextTheme)
      return true
    }

    transitioning.current = true
    setReveal({ id: ++nextRevealId.current, nextTheme, colors: readColors(), origin: origin ?? { x: window.innerWidth, y: 0 } })
    return true
  }

  useLayoutEffect(() => {
    toggleRef.current = toggleTheme
  })
  const stableToggle = useCallback((origin?: WaveOrigin) => toggleRef.current(origin), [])
  // A stable value, so the flushSync inside the frozen view-transition frame re-renders only
  // the components that read the theme.
  const isTransitioning = reveal !== null || wave !== null
  const value = useMemo(() => ({ theme, isTransitioning, toggleTheme: stableToggle }), [theme, isTransitioning, stableToggle])

  return (
    <ThemeContext.Provider value={value}>
      {children}
      {wave && <ThemeWave key={wave.id} origin={wave.origin} oldColors={wave.oldColors} clock={wave.clock} />}
      {reveal && (
        <PixelReveal
          key={reveal.id}
          colors={reveal.colors}
          origin={reveal.origin}
          onCovered={() => applyTheme(reveal.nextTheme)}
          onRevealComplete={() => {
            transitioning.current = false
            setReveal((current) => current?.id === reveal.id ? null : current)
            const queued = queuedReveal.current
            queuedReveal.current = null
            if (queued) toggleRef.current(queued)
          }}
        />
      )}
    </ThemeContext.Provider>
  )
}

export { ThemeProvider }
