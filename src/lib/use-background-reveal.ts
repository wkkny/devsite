import { useCallback, useEffect, useRef, type MouseEventHandler } from 'react'

const HOVER_INTENT_DELAY = 140
const REVEAL_RADIUS = '1200px'
const REVEAL_OPACITY = '0.85'
const REVEAL_IN_TRANSITION = '--reveal-radius 650ms ease-out, opacity 200ms ease-out'
const REVEAL_OUT_TRANSITION = '--reveal-radius 650ms ease-out, opacity 700ms ease-out 650ms'
const REVEAL_RESET_DELAY = 1400

type PointerPosition = {
  x: number
  y: number
}

type BackgroundRevealOptions = {
  disabledSelector?: string
}

function useBackgroundReveal({ disabledSelector = '[data-disable-bg-hover]' }: BackgroundRevealOptions = {}) {
  const revealDelayRef = useRef<number | null>(null)
  const revealResetRef = useRef<number | null>(null)
  const revealStartedRef = useRef(false)
  const lastPointerRef = useRef<PointerPosition | null>(null)

  const clearRevealDelay = useCallback(() => {
    if (revealDelayRef.current === null) return

    window.clearTimeout(revealDelayRef.current)
    revealDelayRef.current = null
  }, [])

  const clearRevealReset = useCallback(() => {
    if (revealResetRef.current === null) return

    window.clearTimeout(revealResetRef.current)
    revealResetRef.current = null
  }, [])

  const setRevealPoint = useCallback((section: HTMLElement, pointer: PointerPosition) => {
    section.style.setProperty('--color-x', `${pointer.x}px`)
    section.style.setProperty('--color-y', `${pointer.y}px`)
  }, [])

  const startReveal = useCallback(
    (section: HTMLElement) => {
      clearRevealReset()
      revealStartedRef.current = true

      const pointer = lastPointerRef.current
      if (pointer) setRevealPoint(section, pointer)

      section.style.setProperty('--color-transition', REVEAL_IN_TRANSITION)
      section.style.setProperty('--color-radius', REVEAL_RADIUS)
      section.style.setProperty('--color-opacity', REVEAL_OPACITY)
    },
    [clearRevealReset, setRevealPoint],
  )

  const finishReveal = useCallback(
    (section: HTMLElement) => {
      clearRevealDelay()

      if (!revealStartedRef.current) return

      clearRevealReset()
      revealStartedRef.current = false
      section.style.setProperty('--color-transition', REVEAL_OUT_TRANSITION)
      section.style.setProperty('--color-radius', REVEAL_RADIUS)
      section.style.setProperty('--color-opacity', '0')

      revealResetRef.current = window.setTimeout(() => {
        section.style.setProperty('--color-transition', '--reveal-radius 0ms linear')
        section.style.setProperty('--color-radius', '0px')
        revealResetRef.current = null
      }, REVEAL_RESET_DELAY)
    },
    [clearRevealDelay, clearRevealReset],
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
    return () => {
      clearRevealDelay()
      clearRevealReset()
    }
  }, [clearRevealDelay, clearRevealReset])

  return { onMouseLeave, onMouseMove }
}

export { useBackgroundReveal }
