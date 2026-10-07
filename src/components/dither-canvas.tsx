import { useEffect, useRef, type ComponentProps } from 'react'
import { useAnimationFrame, useSpring } from 'motion/react'

import { cn } from '@/lib/utils'

export type DitherCanvasProps = Omit<ComponentProps<'canvas'>, 'width' | 'height'> & {
  /** Size of one dither cell in CSS pixels. */
  cellSize?: number
  /** Size of the Bayer threshold matrix: 2, 4 or 8. Larger matrices give finer gradients. */
  matrixSize?: 2 | 4 | 8
  /** Feature size of the noise. Higher values give smaller, busier features. */
  scale?: number
  /** Rotation of the noise field in degrees. */
  rotation?: number
  /** How fast the noise evolves, in noise units per second. */
  speed?: number
  /** Overall fill, from 0 (empty) to 1 (solid). */
  density?: number
  /** How sharply the noise separates filled from empty cells. */
  contrast?: number
  /** Weight of the finer noise layer, from 0 (none) to 1 (only the fine layer). */
  detail?: number
  /** Maximum redraws per second. */
  fps?: number
  /** Draw a single still frame instead of animating. */
  paused?: boolean
  /** How far, in cells, the noise bends around a hovering cursor at most. 0 turns hover off. */
  hoverDisplacement?: number
  /** Reach of the hover effect, in cells. */
  hoverRadius?: number
  /** Send a ring across the canvas when it is pressed. */
  shockwave?: boolean
  /** How fast the ring travels, in cells per second. */
  shockwaveSpeed?: number
  /** Thickness of the ring, in cells. */
  shockwaveWidth?: number
  /** How long the ring lasts, in seconds. */
  shockwaveDuration?: number
  /** How far, in cells, the ring shoves the noise at its front. */
  shockwaveStrength?: number
  /** Extra fill added at the ring's front, on the same 0 to 1 scale as `density`. */
  shockwaveBoost?: number
}

type Wave = { x: number; y: number; start: number }

const MAX_WAVES = 6
const INTERACTIVE = 'a, button, input, textarea, select, summary, [role="button"], [role="link"]'

type Rgb = [number, number, number]

const bayerCache = new Map<number, Float32Array>()

function bayer(size: number) {
  const cached = bayerCache.get(size)
  if (cached) return cached
  let matrix = [0]
  for (let n = 1; n < size; n *= 2) {
    const next = new Array<number>(n * n * 4)
    for (let y = 0; y < n * 2; y++) {
      for (let x = 0; x < n * 2; x++) {
        const base = 4 * matrix[(y % n) * n + (x % n)]
        const quadrant = (y >= n ? 2 : 0) + (x >= n ? 1 : 0)
        next[y * n * 2 + x] = base + [0, 2, 3, 1][quadrant]
      }
    }
    matrix = next
  }
  const normalized = Float32Array.from(matrix, (value) => (value + 0.5) / (size * size))
  bayerCache.set(size, normalized)
  return normalized
}

function hash(x: number, y: number, z: number) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

const smooth = (t: number) => t * t * (3 - 2 * t)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

function noise(x: number, y: number, z: number) {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const iz = Math.floor(z)
  const fx = smooth(x - ix)
  const fy = smooth(y - iy)
  const fz = smooth(z - iz)
  const plane = (dz: number) =>
    lerp(
      lerp(hash(ix, iy, iz + dz), hash(ix + 1, iy, iz + dz), fx),
      lerp(hash(ix, iy + 1, iz + dz), hash(ix + 1, iy + 1, iz + dz), fx),
      fy,
    )
  return lerp(plane(0), plane(1), fz)
}

let probe: CanvasRenderingContext2D | null = null

// Resolves any CSS color (hex, oklch, color-mix, ...) to RGB by letting a canvas parse it.
function toRgb(color: string): Rgb {
  probe ??= Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true })
  if (!probe) return [0, 0, 0]
  probe.clearRect(0, 0, 1, 1)
  probe.fillStyle = '#000'
  probe.fillStyle = color
  probe.fillRect(0, 0, 1, 1)
  const [r, g, b] = probe.getImageData(0, 0, 1, 1).data
  return [r, g, b]
}

/**
 * Animated dithered noise on a low-resolution 2D canvas, scaled up with CSS.
 * The dots take the element's CSS `color` and empty cells are transparent, so style it like
 * any other element: `className="text-primary bg-background"` or `style={{ color: 'var(--x)' }}`.
 */
export function DitherCanvas({
  className,
  cellSize = 4,
  matrixSize = 4,
  scale = 0.03,
  rotation = 0,
  speed = 0.18,
  density = 0.5,
  contrast = 1.8,
  detail = 0.3,
  fps = 30,
  paused = false,
  hoverDisplacement = 4,
  hoverRadius = 28,
  shockwave = true,
  shockwaveSpeed = 150,
  shockwaveWidth = 9,
  shockwaveDuration = 1.6,
  shockwaveStrength = 7,
  shockwaveBoost = 0.25,
  ...props
}: DitherCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const visibleRef = useRef(true)
  const lastDrawRef = useRef(-Infinity)
  const lastTimeRef = useRef<number | null>(null)
  const noiseTimeRef = useRef(0)
  const colorRef = useRef<{ css: string; rgb: Rgb }>({ css: '', rgb: [0, 0, 0] })
  const wavesRef = useRef<Wave[]>([])
  const insideRef = useRef(false)
  const hoverX = useSpring(0, { stiffness: 260, damping: 32, mass: 0.6 })
  const hoverY = useSpring(0, { stiffness: 260, damping: 32, mass: 0.6 })
  const hoverStrength = useSpring(0, { stiffness: 140, damping: 24 })

  useEffect(() => {
    lastDrawRef.current = -Infinity
  }, [cellSize, matrixSize, scale, rotation, density, contrast, detail, paused])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resizeObserver = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      canvas.width = Math.max(1, Math.ceil(width / cellSize))
      canvas.height = Math.max(1, Math.ceil(height / cellSize))
      lastDrawRef.current = -Infinity
    })
    resizeObserver.observe(canvas)
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      visibleRef.current = entry.isIntersecting
    })
    visibilityObserver.observe(canvas)
    return () => {
      resizeObserver.disconnect()
      visibilityObserver.disconnect()
    }
  }, [cellSize])

  // Listen on the window so the effects work even when the canvas sits under non-interactive overlays.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || (!shockwave && hoverDisplacement === 0)) return

    const locate = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom
      return {
        inside,
        x: ((event.clientX - rect.left) / rect.width) * canvas.width,
        y: ((event.clientY - rect.top) / rect.height) * canvas.height,
      }
    }

    const handleMove = (event: PointerEvent) => {
      if (hoverDisplacement === 0 || event.pointerType === 'touch') return
      const { inside, x, y } = locate(event)
      if (!inside) {
        insideRef.current = false
        hoverStrength.set(0)
        return
      }
      if (!insideRef.current) {
        hoverX.jump(x)
        hoverY.jump(y)
        insideRef.current = true
      } else {
        hoverX.set(x)
        hoverY.set(y)
      }
      hoverStrength.set(1)
    }

    const handleLeave = (event: PointerEvent) => {
      if (event.relatedTarget === null) {
        insideRef.current = false
        hoverStrength.set(0)
      }
    }

    const handleDown = (event: PointerEvent) => {
      if (!shockwave || event.button !== 0) return
      if (event.target instanceof Element && event.target.closest(INTERACTIVE)) return
      const { inside, x, y } = locate(event)
      if (!inside) return
      wavesRef.current = [...wavesRef.current.slice(1 - MAX_WAVES), { x, y, start: performance.now() }]
      lastDrawRef.current = -Infinity
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerout', handleLeave)
    window.addEventListener('pointerdown', handleDown)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerout', handleLeave)
      window.removeEventListener('pointerdown', handleDown)
    }
  }, [shockwave, hoverDisplacement, hoverX, hoverY, hoverStrength])

  useAnimationFrame((time) => {
    const canvas = canvasRef.current
    if (!canvas || !visibleRef.current) return

    const now = performance.now()
    wavesRef.current = wavesRef.current.filter((wave) => now - wave.start < shockwaveDuration * 1000)
    const waves = wavesRef.current
    const hover = hoverDisplacement === 0 ? 0 : hoverStrength.get()
    const interacting = hover > 0.003 || waves.length > 0

    const needsRedraw = lastDrawRef.current === -Infinity
    if (paused && !interacting && !needsRedraw) return
    // Interaction redraws at display rate so the cursor and ring feel immediate.
    const interval = interacting ? 0 : 1000 / fps
    if (!needsRedraw && time - lastDrawRef.current < interval) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const elapsed = lastTimeRef.current === null ? 0 : Math.min(time - lastTimeRef.current, 100)
    lastTimeRef.current = time
    lastDrawRef.current = time
    if (!paused) noiseTimeRef.current += elapsed

    // Re-read the computed color so theme switches and CSS transitions are picked up.
    const css = getComputedStyle(canvas).color
    if (css !== colorRef.current.css) colorRef.current = { css, rgb: toRgb(css) }
    const [r, g, b] = colorRef.current.rgb

    const { width, height } = canvas
    const image = ctx.createImageData(width, height)
    const matrix = bayer(matrixSize)
    const angle = (rotation * Math.PI) / 180
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const z = (noiseTimeRef.current / 1000) * speed

    const cursorX = hoverX.get()
    const cursorY = hoverY.get()
    const reach2 = hoverRadius * hoverRadius * 4
    const rings = waves.map((wave) => {
      const age = (now - wave.start) / 1000
      const life = 1 - age / shockwaveDuration
      return { x: wave.x, y: wave.y, radius: age * shockwaveSpeed, fade: life * life }
    })

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sx = x
        let sy = y
        let boost = 0

        if (hover > 0.003) {
          const dx = x - cursorX
          const dy = y - cursorY
          const d2 = dx * dx + dy * dy
          if (d2 < reach2) {
            const pull = Math.exp(-d2 / (hoverRadius * hoverRadius)) * hover * (hoverDisplacement / hoverRadius)
            sx -= dx * pull
            sy -= dy * pull
          }
        }

        for (const ring of rings) {
          const dx = x - ring.x
          const dy = y - ring.y
          const d = Math.sqrt(dx * dx + dy * dy)
          const offset = (d - ring.radius) / shockwaveWidth
          if (offset > -3 && offset < 3 && d > 0) {
            const strength = Math.exp(-offset * offset) * ring.fade
            sx -= (dx / d) * strength * shockwaveStrength
            sy -= (dy / d) * strength * shockwaveStrength
            boost += strength * shockwaveBoost
          }
        }

        const u = (sx * cos - sy * sin) * scale
        const v = (sx * sin + sy * cos) * scale
        const n = noise(u, v, z) * (1 - detail) + noise(u * 2.1 + 31.4, v * 2.1, z * 1.6) * detail
        const value = (n - 0.5) * contrast + density + boost
        if (value > matrix[(y % matrixSize) * matrixSize + (x % matrixSize)]) {
          const i = (y * width + x) * 4
          image.data[i] = r
          image.data[i + 1] = g
          image.data[i + 2] = b
          image.data[i + 3] = 255
        }
      }
    }
    ctx.putImageData(image, 0, 0)
  })

  return <canvas ref={canvasRef} className={cn('block size-full [image-rendering:pixelated]', className)} {...props} />
}
