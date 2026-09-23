import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

const supportsDotCursor = '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)'

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

    const followPointer = (time: number) => {
      const elapsed = previousFrameTime === 0 ? 16.67 : Math.min(time - previousFrameTime, 40)
      previousFrameTime = time
      const progress = 1 - Math.exp(-elapsed / 42)
      currentX += (targetX - currentX) * progress
      currentY += (targetY - currentY) * progress
      dot.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) translate(-50%, -50%)`

      if (Math.hypot(targetX - currentX, targetY - currentY) > 0.1) {
        frameId = requestAnimationFrame(followPointer)
      } else {
        currentX = targetX
        currentY = targetY
        frameId = null
        previousFrameTime = 0
      }
    }

    const moveDot = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return
      targetX = event.clientX
      targetY = event.clientY
      if (!hasPosition) {
        currentX = targetX
        currentY = targetY
        hasPosition = true
        dot.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) translate(-50%, -50%)`
      } else if (frameId === null) {
        frameId = requestAnimationFrame(followPointer)
      }
      dot.style.opacity = '1'
    }
    const hideDot = () => {
      if (frameId !== null) cancelAnimationFrame(frameId)
      frameId = null
      previousFrameTime = 0
      hasPosition = false
      dot.style.opacity = '0'
    }
    const updateSupport = () => {
      if (mediaQuery.matches && !enabled) {
        enabled = true
        root.classList.add('has-theme-dot-cursor')
        window.addEventListener('pointermove', moveDot)
        window.addEventListener('blur', hideDot)
        document.addEventListener('pointerleave', hideDot)
      } else if (!mediaQuery.matches && enabled) {
        enabled = false
        root.classList.remove('has-theme-dot-cursor')
        window.removeEventListener('pointermove', moveDot)
        window.removeEventListener('blur', hideDot)
        document.removeEventListener('pointerleave', hideDot)
        hideDot()
      }
    }

    updateSupport()
    mediaQuery.addEventListener('change', updateSupport)

    return () => {
      mediaQuery.removeEventListener('change', updateSupport)
      window.removeEventListener('pointermove', moveDot)
      window.removeEventListener('blur', hideDot)
      document.removeEventListener('pointerleave', hideDot)
      root.classList.remove('has-theme-dot-cursor')
      if (frameId !== null) cancelAnimationFrame(frameId)
    }
  }, [])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div ref={dotRef} aria-hidden="true" className="theme-dot-cursor" />,
    document.body,
  )
}
