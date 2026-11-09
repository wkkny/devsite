import { useLayoutEffect, useRef } from 'react'

import { cubicBezier, EASE_IN_OUT } from '@/lib/ease'
import { prefersReducedMotion } from '@/lib/media'

const POOL: [string, number][] = [
  ['@', 1], ['8', 0.97], ['0', 0.94], ['#', 0.85], ['4', 0.78],
  ['R', 0.74], ['T', 0.7], ['%', 0.5], ['*', 0.26], ['+', 0.22],
  ['=', 0.14], ['-', 0.09], ['.', 0.05],
]

const EASING = { duration: 650, x1: 0.2, y1: 0.35, x2: 0.3, y2: 1, bias: 0.65, brightness: 0.9, cycle: 210, variance: 0.4, smooth: 5, cluster: 3, cell: 12 }
const COVER_DURATION = 160
const MAX_DPR = 1.5
const REDUCED_WORK_QUERY = '(pointer: coarse), (max-width: 768px)'

export type RevealColors = {
  background: string
  foreground: string
  blue: string
}

function releaseCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0
  canvas.height = 0
  canvas.hidden = true
}

export function PixelReveal({ onCovered, onRevealComplete, colors, origin }: { onCovered: () => void; onRevealComplete: () => void; colors: RevealColors; origin: { x: number; y: number } }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const coveredRef = useRef(onCovered)
  const completeRef = useRef(onRevealComplete)
  const hasCoveredRef = useRef(false)
  const completedRef = useRef(false)
  coveredRef.current = onCovered
  completeRef.current = onRevealComplete

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const complete = () => {
      if (completedRef.current) return
      completedRef.current = true
      completeRef.current?.()
    }
    const covered = () => {
      if (hasCoveredRef.current) return
      hasCoveredRef.current = true
      coveredRef.current?.()
    }
    canvas.hidden = false
    if (prefersReducedMotion()) {
      covered()
      releaseCanvas(canvas)
      complete()
      return
    }

    const w = window.innerWidth
    const h = window.innerHeight
    const reducedWork = window.matchMedia(REDUCED_WORK_QUERY).matches
    const dpr = Math.min(window.devicePixelRatio || 1, reducedWork ? 1 : MAX_DPR)
    canvas.width = Math.ceil(w * dpr)
    canvas.height = Math.ceil(h * dpr)
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      covered()
      releaseCanvas(canvas)
      complete()
      return
    }
    ctx.scale(dpr, dpr)

    const { duration, x1, y1, x2, y2, bias, brightness, cycle, variance, cluster } = EASING
    const smooth = reducedWork ? 2 : EASING.smooth
    const cell = reducedWork ? 20 : EASING.cell
    const cols = Math.ceil(w / cell) + 1
    const rows = Math.ceil(h / cell) + 1
    const count = cols * rows
    const poolLen = POOL.length

    // Cells clear outward from the toggle, like the view-transition wave this stands in for.
    const reach = Math.hypot(Math.max(origin.x, w - origin.x), Math.max(origin.y, h - origin.y)) || 1
    const thresholds = new Float32Array(count)
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        thresholds[r * cols + c] = (Math.hypot(c * cell - origin.x, r * cell - origin.y) / reach) * bias + Math.random() * (1 - bias)

    const cycles = new Float32Array(count)
    for (let i = 0; i < count; i++)
      cycles[i] = Math.max(20, cycle * (1 + (2 * Math.random() - 1) * variance))

    const clusterCols = Math.ceil(cols / cluster)
    const clusterRows = Math.ceil(rows / cluster)
    const clusterSeeds = new Float32Array(clusterCols * clusterRows)
    for (let i = 0; i < clusterSeeds.length; i++) clusterSeeds[i] = Math.random()

    const offsets = new Float32Array(count)
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const cs = clusterSeeds[Math.min(Math.floor(r / cluster), clusterRows - 1) * clusterCols + Math.min(Math.floor(c / cluster), clusterCols - 1)]
        offsets[r * cols + c] = cs * cycle * poolLen
      }

    const phaseA = offsets
    const phaseB = new Float32Array(count)
    for (let pass = 0; pass < smooth; pass++) {
      const src = pass % 2 === 0 ? phaseA : phaseB
      const dst = pass % 2 === 0 ? phaseB : phaseA
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c
          const up = r > 0 ? src[(r - 1) * cols + c] : src[i]
          const down = r < rows - 1 ? src[(r + 1) * cols + c] : src[i]
          const left = c > 0 ? src[r * cols + c - 1] : src[i]
          const right = c < cols - 1 ? src[r * cols + c + 1] : src[i]
          dst[i] = 0.35 * src[i] + (up + down + left + right) * 0.1625
        }
    }
    if (smooth % 2 !== 0) phaseA.set(phaseB)

    const cellFont = Math.max(6, Math.round(0.62 * cell))
    ctx.font = `${cellFont}px ui-monospace, monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    let cancelled = false
    let rafId = 0
    const drawFrame = (progress: number, eased: number) => {
      ctx.clearRect(0, 0, w, h)
      const half = cell / 2
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c
          if (thresholds[i] <= progress) continue
          const x = c * cell
          const y = r * cell
          const [char, alpha] = POOL[Math.floor((eased + phaseA[i]) / cycles[i]) % poolLen]
          ctx.globalAlpha = 1
          ctx.fillStyle = colors.background
          ctx.fillRect(x, y, cell, cell)
          ctx.globalAlpha = 0.08
          ctx.fillStyle = colors.foreground
          ctx.fillRect(x + 1, y + 1, half - 1, half - 1)
          ctx.fillRect(x + half + 1, y + 1, half - 1, half - 1)
          ctx.fillRect(x + 1, y + half + 1, half - 1, half - 1)
          ctx.fillRect(x + half + 1, y + half + 1, half - 1, half - 1)
          ctx.globalAlpha = alpha * brightness * 0.55
          ctx.fillStyle = colors.blue
          ctx.fillText(char, x + half, y + half)
        }
      ctx.globalAlpha = 1
    }

    const begin = () => {
      if (cancelled) return
      // Paint the initial cover before the browser's first frame to avoid a flash.
      drawFrame(0, 0)
      let coverStart: number | null = null
      let revealStart: number | null = null

      const tick = (now: number) => {
        if (coverStart === null) coverStart = now
        if (!hasCoveredRef.current) {
          const coverProgress = Math.min(1, (now - coverStart) / COVER_DURATION)
          canvas.style.opacity = String(cubicBezier(...EASE_IN_OUT, coverProgress))
          if (coverProgress === 1) {
            covered()
          }
          rafId = requestAnimationFrame(tick)
          return
        }
        if (revealStart === null) revealStart = now
        const elapsed = now - revealStart
        const linear = Math.min(1, elapsed / duration)
        const eased = cubicBezier(x1, y1, x2, y2, linear)
        if (linear >= 1) {
          releaseCanvas(canvas)
          complete()
          return
        }
        // Glyphs cycle on elapsed milliseconds; the eased progress alone moves too little to change them.
        drawFrame(eased, elapsed)
        rafId = requestAnimationFrame(tick)
      }
      rafId = requestAnimationFrame(tick)
    }

    begin()
    // Laid out for this viewport: if it resizes mid-cover, finish the switch at once.
    const land = () => {
      cancelled = true
      cancelAnimationFrame(rafId)
      covered()
      releaseCanvas(canvas)
      complete()
    }
    window.addEventListener('resize', land)

    return () => {
      window.removeEventListener('resize', land)
      cancelled = true
      cancelAnimationFrame(rafId)
      releaseCanvas(canvas)
    }
  }, [colors, origin])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        height: '100dvh',
        opacity: 0,
        pointerEvents: 'none', zIndex: 999,
        transform: 'translateZ(0)', backfaceVisibility: 'hidden',
      }}
    />
  )
}
