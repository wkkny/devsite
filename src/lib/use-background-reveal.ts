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
  const pointerFrameRef = useRef<number | null>(null)
  const revealStartedRef = useRef(false)
  const revealStartedAtRef = useRef(0)
  const lastPointerRef = useRef<PointerPosition | null>(null)
  const pendingPointerRef = useRef<PointerPosition | null>(null)
  const sectionRef = useRef<HTMLElement | null>(null)
  const rectRef = useRef<DOMRect | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const enabledRef = useRef(false)

  const clearRevealDelay = useCallback(() => {
    if (revealDelayRef.current === null) return

    window.clearTimeout(revealDelayRef.current)
    revealDelayRef.current = null
  }, [])

  const setRevealPoint = useCallback((section: HTMLElement, pointer: PointerPosition) => {
    section.style.setProperty('--color-x', `${pointer.x}px`)
    section.style.setProperty('--color-y', `${pointer.y}px`)
  }, [])

  const clearPointerFrame = useCallback(() => {
    if (pointerFrameRef.current === null) return

    cancelAnimationFrame(pointerFrameRef.current)
    pointerFrameRef.current = null
  }, [])

  const watchSection = useCallback((section: HTMLElement) => {
    if (sectionRef.current === section) return

    resizeObserverRef.current?.disconnect()
    sectionRef.current = section
    rectRef.current = null

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserverRef.current = new ResizeObserver(() => {
        rectRef.current = null
      })
      resizeObserverRef.current.observe(section)
    }
  }, [])

  const queueRevealPoint = useCallback(
    (section: HTMLElement, pointer: PointerPosition) => {
      pendingPointerRef.current = pointer
      if (pointerFrameRef.current !== null) return

      pointerFrameRef.current = requestAnimationFrame(() => {
        pointerFrameRef.current = null
        const pendingPointer = pendingPointerRef.current
        pendingPointerRef.current = null
        if (!pendingPointer || sectionRef.current !== section || !enabledRef.current) return

        const rect = rectRef.current ?? section.getBoundingClientRect()
        rectRef.current = rect
        const localPointer = {
          x: pendingPointer.x - rect.left,
          y: pendingPointer.y - rect.top,
        }
        lastPointerRef.current = localPointer

        if (revealStartedRef.current) setRevealPoint(section, localPointer)
      })
    },
    [setRevealPoint],
  )

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
      if (!enabledRef.current) return

      const section = event.currentTarget
      const target = event.target as HTMLElement
      watchSection(section)

      if (target.closest(disabledSelector)) {
        clearPointerFrame()
        pendingPointerRef.current = null
        finishReveal(section)
        return
      }

      queueRevealPoint(section, { x: event.clientX, y: event.clientY })
      if (revealStartedRef.current) return

      if (revealDelayRef.current !== null) return

      revealDelayRef.current = window.setTimeout(() => {
        revealDelayRef.current = null
        startReveal(section)
      }, HOVER_INTENT_DELAY)
    },
    [clearPointerFrame, disabledSelector, finishReveal, queueRevealPoint, startReveal, watchSection],
  )

  const onMouseLeave: MouseEventHandler<HTMLElement> = useCallback(
    (event) => {
      clearPointerFrame()
      pendingPointerRef.current = null
      finishReveal(event.currentTarget)
    },
    [clearPointerFrame, finishReveal],
  )

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const fineHover = window.matchMedia('(hover: hover) and (pointer: fine)')
    const invalidateRect = () => {
      rectRef.current = null
    }
    const updateEnabled = () => {
      enabledRef.current = !reducedMotion.matches && fineHover.matches
      if (enabledRef.current) return

      clearRevealDelay()
      clearPointerFrame()
      pendingPointerRef.current = null
      revealStartedRef.current = false

      const section = sectionRef.current
      if (section) {
        section.style.setProperty('--color-transition', 'none')
        section.style.setProperty('--color-radius', '0px')
        section.style.setProperty('--color-opacity', '0')
      }
    }

    updateEnabled()
    reducedMotion.addEventListener('change', updateEnabled)
    fineHover.addEventListener('change', updateEnabled)
    window.addEventListener('resize', invalidateRect)
    window.addEventListener('scroll', invalidateRect, true)

    return () => {
      reducedMotion.removeEventListener('change', updateEnabled)
      fineHover.removeEventListener('change', updateEnabled)
      window.removeEventListener('resize', invalidateRect)
      window.removeEventListener('scroll', invalidateRect, true)
      clearRevealDelay()
      clearPointerFrame()
      resizeObserverRef.current?.disconnect()
    }
  }, [clearPointerFrame, clearRevealDelay])

  return { onMouseLeave, onMouseMove }
}

export { useBackgroundReveal }
