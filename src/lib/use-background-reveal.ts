import { useCallback, useEffect, useRef, type MouseEventHandler } from 'react'

const HOVER_INTENT_DELAY = 140
const REVEAL_RADIUS = '1200px'
const REVEAL_OPACITY = '0.85'
const REVEAL_IN_TRANSITION = '--reveal-radius 650ms ease-out, opacity 200ms ease-out'
const REVEAL_OUT_TRANSITION = '--reveal-radius 650ms ease-out, opacity 700ms ease-out 650ms'
const REVEAL_QUICK_OUT_TRANSITION = '--reveal-radius 300ms ease-in, opacity 250ms ease-out'
const FULL_REVEAL_MS = 650

type PointerPosition = {
  x: number
  y: number
}

type BackgroundRevealOptions = {
  disabledSelector?: string
}

function useBackgroundReveal({ disabledSelector = '[data-disable-bg-hover]' }: BackgroundRevealOptions = {}) {
  const revealDelayRef = useRef<number | null>(null)
  const revealStartedRef = useRef(false)
  const revealStartedAtRef = useRef(0)
  const lastPointerRef = useRef<PointerPosition | null>(null)

  const clearRevealDelay = useCallback(() => {
    if (revealDelayRef.current === null) return

    window.clearTimeout(revealDelayRef.current)
    revealDelayRef.current = null
  }, [])

  const setRevealPoint = useCallback((section: HTMLElement, pointer: PointerPosition) => {
    section.style.setProperty('--color-x', `${pointer.x}px`)
    section.style.setProperty('--color-y', `${pointer.y}px`)
  }, [])

  const startReveal = useCallback(
    (section: HTMLElement) => {
      revealStartedRef.current = true
      revealStartedAtRef.current = performance.now()

      const pointer = lastPointerRef.current
      if (pointer) setRevealPoint(section, pointer)

      section.style.setProperty('--color-transition', 'none')
      section.style.setProperty('--color-radius', '0px')
      void section.offsetWidth
      section.style.setProperty('--color-transition', REVEAL_IN_TRANSITION)
      section.style.setProperty('--color-radius', REVEAL_RADIUS)
      section.style.setProperty('--color-opacity', REVEAL_OPACITY)
    },
    [setRevealPoint],
  )

  const finishReveal = useCallback(
    (section: HTMLElement) => {
      clearRevealDelay()

      if (!revealStartedRef.current) return

      revealStartedRef.current = false
      const heldMs = performance.now() - revealStartedAtRef.current
      const quickExit = heldMs < FULL_REVEAL_MS

      section.style.setProperty(
        '--color-transition',
        quickExit ? REVEAL_QUICK_OUT_TRANSITION : REVEAL_OUT_TRANSITION
      )
      section.style.setProperty('--color-radius', quickExit ? '0px' : REVEAL_RADIUS)
      section.style.setProperty('--color-opacity', '0')
    },
    [clearRevealDelay],
  )

  const onMouseMove: MouseEventHandler<HTMLElement> = useCallback(
    (event) => {
      const section = event.currentTarget
      const target = event.target as HTMLElement

      if (target.closest(disabledSelector)) {
        finishReveal(section)
        return
      }

      const rect = section.getBoundingClientRect()
      const pointer = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      }

      lastPointerRef.current = pointer

      if (revealStartedRef.current) {
        setRevealPoint(section, pointer)
        return
      }

      if (revealDelayRef.current !== null) return

      revealDelayRef.current = window.setTimeout(() => {
        revealDelayRef.current = null
        startReveal(section)
      }, HOVER_INTENT_DELAY)
    },
    [disabledSelector, finishReveal, setRevealPoint, startReveal],
  )

  const onMouseLeave: MouseEventHandler<HTMLElement> = useCallback(
    (event) => finishReveal(event.currentTarget),
    [finishReveal],
  )

  useEffect(() => {
    return () => clearRevealDelay()
  }, [clearRevealDelay])

  return { onMouseLeave, onMouseMove }
}

export { useBackgroundReveal }
