import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

const supportsDotCursor = '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)'
const INTERACTIVE =
  'a[href], button:not(:disabled), [role="button"], [role="link"], summary, label[for], select, input:not([type="hidden"]), textarea'

// A decorative dot that trails the system cursor. The real cursor always stays visible,
// so users keep their own cursor size and contrast settings.
export function ThemeDotCursor() {
  const dotRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mediaQuery = window.matchMedia(supportsDotCursor)
    const dot = dotRef.current
    if (!dot) return

    const root = document.documentElement
    let enabled = false
    let frameId: number | null = null
    let targetX = 0
    let targetY = 0
    let currentX = 0
    let currentY = 0
    let previousFrameTime = 0
    let hasPosition = false

    const place = () => {
      dot.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) translate(-50%, -50%)`
    }

    const followPointer = (time: number) => {
      const elapsed = previousFrameTime === 0 ? 16.67 : Math.min(time - previousFrameTime, 40)
      previousFrameTime = time
      const progress = 1 - Math.exp(-elapsed / 42)
      currentX += (targetX - currentX) * progress
      currentY += (targetY - currentY) * progress
      place()

      if (Math.hypot(targetX - currentX, targetY - currentY) > 0.1) {
        frameId = requestAnimationFrame(followPointer)
      } else {
        currentX = targetX
        currentY = targetY
        frameId = null
        previousFrameTime = 0
      }
    }

    const updateCue = (target: EventTarget | null) => {
      const element = target instanceof Element ? target : null
      dot.classList.toggle('theme-dot-cursor--interactive', element?.closest(INTERACTIVE) != null)
    }

    const updateCueAtPointer = () => {
      if (hasPosition) updateCue(document.elementFromPoint(targetX, targetY))
    }

    const moveDot = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return
      updateCue(event.target)
      targetX = event.clientX
      targetY = event.clientY
      if (!hasPosition) {
        currentX = targetX
        currentY = targetY
        hasPosition = true
        place()
      } else if (frameId === null) {
        frameId = requestAnimationFrame(followPointer)
      }
      dot.style.opacity = '1'
    }

    const press = (event: PointerEvent) => {
      if (event.pointerType !== 'touch' && event.button === 0) dot.classList.add('theme-dot-cursor--pressed')
    }
    const release = () => dot.classList.remove('theme-dot-cursor--pressed')

    const hideDot = () => {
      if (frameId !== null) cancelAnimationFrame(frameId)
      frameId = null
      previousFrameTime = 0
      hasPosition = false
      release()
      dot.style.opacity = '0'
    }

    const listeners: Array<[EventTarget, string, EventListener, boolean?]> = [
      [window, 'pointermove', moveDot as EventListener],
      [window, 'pointerdown', press as EventListener],
      [window, 'pointerup', release],
      [window, 'pointercancel', release],
      [window, 'blur', hideDot],
      [window, 'resize', updateCueAtPointer],
      [document, 'scroll', updateCueAtPointer, true],
      [root, 'pointerleave', hideDot],
    ]
    const listen = (on: boolean) => {
      for (const [target, type, listener, capture] of listeners) {
        if (on) target.addEventListener(type, listener, capture)
        else target.removeEventListener(type, listener, capture)
      }
    }

    const updateSupport = () => {
      if (mediaQuery.matches === enabled) return
      enabled = mediaQuery.matches
      listen(enabled)
      if (!enabled) hideDot()
    }

    updateSupport()
    mediaQuery.addEventListener('change', updateSupport)

    return () => {
      mediaQuery.removeEventListener('change', updateSupport)
      listen(false)
      if (frameId !== null) cancelAnimationFrame(frameId)
    }
  }, [])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div ref={dotRef} aria-hidden="true" className="theme-dot-cursor" />,
    document.body,
  )
}
