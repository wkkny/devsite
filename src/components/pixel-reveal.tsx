import { useLayoutEffect, useRef } from 'react'

const POOL: [string, number][] = [
  ['@', 1], ['8', 0.97], ['0', 0.94], ['#', 0.85], ['4', 0.78],
  ['R', 0.74], ['T', 0.7], ['%', 0.5], ['*', 0.26], ['+', 0.22],
  ['=', 0.14], ['-', 0.09], ['.', 0.05],
]

const EASING = { duration: 650, x1: 0.2, y1: 0.35, x2: 0.3, y2: 1, bounce: 0.1, bias: 0.65, brightness: 0.9, cycle: 210, variance: 0.4, smooth: 5, cluster: 3, cell: 15 }
const MAX_DPR = 1.5
const REDUCED_WORK_QUERY = '(pointer: coarse), (max-width: 768px)'

function cubicBezier(x1: number, y1: number, x2: number, y2: number, t: number): number {
  if (t <= 0) return 0
  if (t >= 1) return 1
  let x = t
  for (let i = 0; i < 8; i++) {
    const currentX = 3 * (1 - x) * (1 - x) * x * x1 + 3 * (1 - x) * x * x * x2 + x * x * x
    const dx = 3 * (1 - x) * (1 - x) * x1 + 6 * (1 - x) * x * (x2 - x1) + 3 * x * x * (1 - x1)
    if (Math.abs(dx) < 1e-6) break
    x -= (currentX - t) / dx
    x = Math.max(0, Math.min(1, x))
  }
  return 3 * (1 - x) * (1 - x) * x * y1 + 3 * (1 - x) * x * x * y2 + x * x * x
}

function releaseCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0
  canvas.height = 0
  canvas.hidden = true
}

export function PixelReveal({ onRevealComplete, skip = false, scope = false, delay = 0, image }: { onRevealComplete?: () => void; skip?: boolean; scope?: boolean; delay?: number; image?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const completeRef = useRef(onRevealComplete)
  const completedRef = useRef(false)
  completeRef.current = onRevealComplete

  useLayoutEffect(() => {
    if (skip) return
    const canvas = canvasRef.current
    if (!canvas) return
    const complete = () => {
      if (completedRef.current) return
      completedRef.current = true
      completeRef.current?.()
    }
    canvas.hidden = false
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      releaseCanvas(canvas)
      complete()
      return
    }

    const dark = document.documentElement.classList.contains('dark')
    const bgColor = dark ? '#101010' : '#f8f8f8'
    const cellBg = dark ? '#1c1c1c' : '#ebebeb'
    const charColor = dark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'

    const box = scope && canvas.parentElement
      ? canvas.parentElement.getBoundingClientRect()
      : null
    const w = box ? box.width : window.innerWidth
    const h = box ? box.height : window.innerHeight
    const reducedWork = window.matchMedia(REDUCED_WORK_QUERY).matches
    const dpr = Math.min(window.devicePixelRatio || 1, reducedWork ? 1 : MAX_DPR)
    canvas.width = Math.ceil(w * dpr)
    canvas.height = Math.ceil(h * dpr)
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      releaseCanvas(canvas)
      complete()
      return
    }
    ctx.scale(dpr, dpr)

    const { duration, x1, y1, x2, y2, bounce, bias, brightness, cycle, variance, cluster } = EASING
    const smooth = reducedWork ? 2 : EASING.smooth
    const cell = reducedWork ? 20 : EASING.cell
    const cols = Math.ceil(w / cell) + 1
    const rows = Math.ceil(h / cell) + 1
    const count = cols * rows
    const poolLen = POOL.length

    const thresholds = new Float32Array(count)
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        thresholds[r * cols + c] = (r / Math.max(rows - 1, 1)) * bias + Math.random() * (1 - bias)

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
    let samples: Uint8ClampedArray | null = null

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
          if (samples) {
            const si = i * 4
            ctx.fillStyle = `rgb(${samples[si]},${samples[si + 1]},${samples[si + 2]})`
            ctx.fillRect(x, y, cell, cell)
            ctx.fillStyle = 'rgba(0,0,0,0.35)'
            ctx.fillRect(x + 1, y + 1, half - 1, half - 1)
            ctx.fillRect(x + half + 1, y + 1, half - 1, half - 1)
            ctx.fillRect(x + 1, y + half + 1, half - 1, half - 1)
            ctx.fillRect(x + half + 1, y + half + 1, half - 1, half - 1)
          } else {
            ctx.fillStyle = bgColor
            ctx.fillRect(x, y, cell, cell)
            ctx.fillStyle = cellBg
            ctx.fillRect(x + 1, y + 1, half - 1, half - 1)
            ctx.fillRect(x + half + 1, y + 1, half - 1, half - 1)
            ctx.fillRect(x + 1, y + half + 1, half - 1, half - 1)
            ctx.fillRect(x + half + 1, y + half + 1, half - 1, half - 1)
          }
          ctx.globalAlpha = alpha * brightness
          ctx.fillStyle = charColor
          ctx.fillText(char, x + half, y + half)
        }
      ctx.globalAlpha = 1
    }

    const begin = () => {
      if (cancelled) return
      // Paint the initial cover before the browser's first frame to avoid a flash.
      drawFrame(0, 0)
      let start0: number | null = null

      const tick = (now: number) => {
        if (start0 === null) start0 = now + delay
        if (now < start0) {
          rafId = requestAnimationFrame(tick)
          return
        }
        const elapsed = now - start0
        const linear = Math.min(1, elapsed / duration)
        const eased = cubicBezier(x1, y1, x2, y2, linear)
        let progress = eased
        if (bounce > 0 && linear > 0.6) {
          const b = (linear - 0.6) / 0.4
          progress = Math.max(0, eased - 0.15 * bounce * Math.sin(b * Math.PI * 3) * Math.exp(-4 * b))
        }
        if (linear >= 1) {
          releaseCanvas(canvas)
          complete()
          return
        }
        drawFrame(progress, eased)
        rafId = requestAnimationFrame(tick)
      }
      rafId = requestAnimationFrame(tick)
    }

    if (image) {
      // Image decoding is asynchronous; keep the canvas covered while it loads.
      drawFrame(0, 0)
      const img = new Image()
      img.src = image
      img.decode()
        .then(() => {
          if (cancelled) return
          const off = document.createElement('canvas')
          off.width = cols
          off.height = rows
          const octx = off.getContext('2d')
          if (!octx) {
            releaseCanvas(canvas)
            complete()
            return
          }
          const iw = img.naturalWidth
          const ih = img.naturalHeight
          const scale = Math.max(w / iw, h / ih)
          const dw = iw * scale
          const dh = ih * scale
          octx.drawImage(img, (cols * cell - dw) / 2, (rows * cell - dh) / 2, dw, dh)
          samples = octx.getImageData(0, 0, cols, rows).data
          begin()
        })
        .catch(() => begin())
    } else {
      begin()
    }

    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
      releaseCanvas(canvas)
    }
  }, [skip, scope, delay, image])

  if (skip) return null
  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: scope ? 'absolute' : 'fixed',
        inset: scope ? 0 : undefined,
        top: scope ? undefined : 0, left: scope ? undefined : 0, right: scope ? undefined : 0,
        height: scope ? '100%' : '100dvh',
        pointerEvents: 'none', zIndex: 999,
        transform: 'translateZ(0)', backfaceVisibility: 'hidden',
      }}
    />
  )
}
