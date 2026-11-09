import { useEffect, useRef, type ComponentProps } from 'react'
import { useAnimationFrame, useSpring } from 'motion/react'

import { createDitherRenderer, type DitherRenderer } from '@/lib/dither-gl'
import { DITHER_PULSE_EVENT, type DitherPulse } from '@/lib/dither-pulse'
import { prefersReducedMotion } from '@/lib/media'
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
  /** Print the field in from the left over this many ms when it first draws, in three Bayer steps. 0 shows it at once. */
  printIn?: number
  /** How far a slower noise layer bends the field, so features flow instead of sitting on the grid. 0 turns it off. */
  warp?: number
  /** Fraction of the height, from the bottom, over which the field dissolves into whatever is behind it. 0 keeps a hard edge. */
  fade?: number
  /** Dots within this much of their threshold are drawn at `toneAlpha`, giving the field a second, softer tone. 0 turns it off. */
  tone?: number
  /** Opacity of the softer tone, from 0 to 1. Its color is the `--dither-tone` CSS property, or the dot color without one. */
  toneAlpha?: number
  /** How fully the soft dots light up to the main color near the cursor, from 0 to 1. */
  hoverGlow?: number
  /** A soft clearing centred at x, y with this radius, in CSS pixels from the canvas's top left. */
  calm?: { x: number; y: number; radius: number; strength?: number }
  /** How far the overall fill breathes, up and down, on a slow 8s cycle. 0 keeps it steady. */
  breathe?: number
  /** How far, in cells, the noise bends around a hovering cursor at most. 0 turns hover off. */
  hoverDisplacement?: number
  /** Reach of the hover effect, in cells. */
  hoverRadius?: number
  /** Extra fill under the cursor, on the same 0 to 1 scale as `density`. */
  hoverBoost?: number
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

type Wave = { x: number; y: number; start: number; speed: number; strength: number; boost: number; duration: number }


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

// At module scope so the 2D fallback allocates nothing per pixel.
function plane(ix: number, iy: number, iz: number, fx: number, fy: number) {
  return lerp(lerp(hash(ix, iy, iz), hash(ix + 1, iy, iz), fx), lerp(hash(ix, iy + 1, iz), hash(ix + 1, iy + 1, iz), fx), fy)
}

function noise(x: number, y: number, z: number) {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const iz = Math.floor(z)
  const fx = smooth(x - ix)
  const fy = smooth(y - iy)
  return lerp(plane(ix, iy, iz, fx, fy), plane(ix, iy, iz + 1, fx, fy), smooth(z - iz))
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
  printIn = 0,
  breathe = 0,
  warp = 0,
  fade = 0,
  tone = 0,
  toneAlpha = 0.45,
  hoverGlow = 0,
  calm,
  hoverDisplacement = 4,
  hoverRadius = 28,
  hoverBoost = 0,
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
  const toneRef = useRef<{ css: string; rgb: Rgb }>({ css: '', rgb: [0, 0, 0] })
  const colorDirtyRef = useRef(true)
  const imageRef = useRef<ImageData | null>(null)
  // The GPU renderer when WebGL2 is available; otherwise null and the 2D loop below draws.
  const rendererRef = useRef<DitherRenderer | null | undefined>(undefined)
  const printStartRef = useRef<number | null>(null)
  const wavesRef = useRef<Wave[]>([])
  const insideRef = useRef(false)
  const hoverX = useSpring(0, { stiffness: 260, damping: 32, mass: 0.6 })
  const hoverY = useSpring(0, { stiffness: 260, damping: 32, mass: 0.6 })
  const hoverStrength = useSpring(0, { stiffness: 140, damping: 24 })

  useEffect(() => {
    lastDrawRef.current = -Infinity
  }, [cellSize, matrixSize, scale, rotation, density, contrast, detail, warp, fade, tone, toneAlpha, calm?.x, calm?.y, calm?.radius, calm?.strength, paused])

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
    rendererRef.current ??= createDitherRenderer(canvas)
    // Mobile browsers can drop the GPU context (e.g. on tab restore); rebuild it when it returns.
    const onLost = (event: Event) => event.preventDefault()
    const onRestored = () => {
      rendererRef.current = createDitherRenderer(canvas)
      lastDrawRef.current = -Infinity
    }
    canvas.addEventListener('webglcontextlost', onLost)
    canvas.addEventListener('webglcontextrestored', onRestored)
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      visibleRef.current = entry.isIntersecting
    })
    visibilityObserver.observe(canvas)
    // The dot color only changes with the theme, which toggles a class or style on <html>.
    const themeObserver = new MutationObserver(() => {
      colorDirtyRef.current = true
      lastDrawRef.current = -Infinity
    })
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] })
    return () => {
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
      resizeObserver.disconnect()
      visibilityObserver.disconnect()
      themeObserver.disconnect()
    }
  }, [cellSize])

  useEffect(
    () => () => {
      rendererRef.current?.dispose()
      rendererRef.current = undefined
    },
    [],
  )

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
      // Skip the layout read while the banner is scrolled away.
      if (!visibleRef.current) {
        if (insideRef.current) {
          insideRef.current = false
          hoverStrength.set(0)
        }
        return
      }
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
      wavesRef.current = [
        ...wavesRef.current.slice(1 - MAX_WAVES),
        { x, y, start: performance.now(), speed: shockwaveSpeed, strength: shockwaveStrength, boost: shockwaveBoost, duration: shockwaveDuration },
      ]
      lastDrawRef.current = -Infinity
    }

    const handlePulse = (event: Event) => {
      if (!shockwave || !(event instanceof CustomEvent) || prefersReducedMotion()) return
      const pulse = event.detail as DitherPulse
      const rect = canvas.getBoundingClientRect()
      const cellsPerPx = canvas.width / rect.width
      wavesRef.current = [
        ...wavesRef.current.slice(1 - MAX_WAVES),
        {
          x: (pulse.clientX - rect.left) * cellsPerPx,
          y: (pulse.clientY - rect.top) * cellsPerPx,
          start: performance.now(),
          speed: pulse.speed === undefined ? shockwaveSpeed : pulse.speed * cellsPerPx,
          strength: pulse.strength ?? shockwaveStrength,
          boost: pulse.boost ?? shockwaveBoost,
          duration: pulse.duration ?? shockwaveDuration,
        },
      ]
      lastDrawRef.current = -Infinity
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerout', handleLeave)
    window.addEventListener('pointerdown', handleDown)
    window.addEventListener(DITHER_PULSE_EVENT, handlePulse)
    return () => {
      window.removeEventListener(DITHER_PULSE_EVENT, handlePulse)
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerout', handleLeave)
      window.removeEventListener('pointerdown', handleDown)
    }
  }, [shockwave, shockwaveSpeed, shockwaveStrength, shockwaveBoost, shockwaveDuration, hoverDisplacement, hoverX, hoverY, hoverStrength])

  useAnimationFrame((time) => {
    const canvas = canvasRef.current
    if (!canvas || !visibleRef.current) return

    const now = performance.now()
    wavesRef.current = wavesRef.current.filter((wave) => now - wave.start < wave.duration * 1000)
    const waves = wavesRef.current
    const hover = hoverDisplacement === 0 ? 0 : hoverStrength.get()
    const interacting = hover > 0.003 || waves.length > 0
    // Only moving springs and rings need display rate; a resting cursor keeps the fps cap.
    printStartRef.current ??= now
    const printProgress = printIn > 0 ? Math.min(1, (now - printStartRef.current) / printIn) : 1
    const printing = printProgress < 1
    const moving = printing || waves.length > 0 || hoverStrength.isAnimating() || hoverX.isAnimating() || hoverY.isAnimating()

    const needsRedraw = lastDrawRef.current === -Infinity
    if (paused && !interacting && !needsRedraw) return
    // Interaction redraws at display rate so the cursor and ring feel immediate.
    const interval = moving ? 0 : 1000 / fps
    if (!needsRedraw && time - lastDrawRef.current < interval) return
    const renderer = rendererRef.current
    const ctx = renderer ? null : canvas.getContext('2d')
    if (!renderer && !ctx) return

    const elapsed = lastTimeRef.current === null ? 0 : Math.min(time - lastTimeRef.current, 100)
    lastTimeRef.current = time
    lastDrawRef.current = time
    if (!paused) noiseTimeRef.current += elapsed

    // Re-read the computed color only after a theme change, not on every frame.
    if (colorDirtyRef.current) {
      colorDirtyRef.current = false
      const css = getComputedStyle(canvas).color
      if (css !== colorRef.current.css) colorRef.current = { css, rgb: toRgb(css) }
      const toneCss = getComputedStyle(canvas).getPropertyValue('--dither-tone').trim() || css
      if (toneCss !== toneRef.current.css) toneRef.current = { css: toneCss, rgb: toRgb(toneCss) }
    }
    const [r, g, b] = colorRef.current.rgb
    const [tr, tg, tb] = toneRef.current.rgb
    const calmCells: [number, number, number, number] = calm
      ? [calm.x / cellSize, calm.y / cellSize, Math.max(1, calm.radius / cellSize), calm.strength ?? 0.6]
      : [0, 0, 1, 0]

    const { width, height } = canvas
    const angle = (rotation * Math.PI) / 180
    const z = (noiseTimeRef.current / 1000) * speed
    // A slow breath in the overall fill, so the field reads as a living material even at rest.
    const breathing = density + breathe * Math.sin((noiseTimeRef.current / 8000) * Math.PI * 2)
    const printSpan = Math.max(8, width * 0.12)
    const ringsNow = waves.map((wave) => {
      const age = (now - wave.start) / 1000
      const life = 1 - age / wave.duration
      return { x: wave.x, y: wave.y, radius: age * wave.speed, fade: life * life, width: shockwaveWidth, strength: wave.strength, boost: wave.boost }
    })

    if (renderer) {
      renderer.draw({
        width, height, scale, cos: Math.cos(angle), sin: Math.sin(angle), z, contrast, detail, rgb: [r, g, b], matrixSize,
        density: breathing,
        // The front runs a little past both edges, so the first and last columns step in too.
        printFront: printing ? -printSpan + printProgress * (width + printSpan * 2) : width + printSpan * 4,
        printSpan,
        warp,
        fade,
        tone: [tone, toneAlpha],
        toneRgb: [tr, tg, tb],
        hoverGlow,
        calm: calmCells,
        hover: { x: hoverX.get(), y: hoverY.get(), strength: hover, displacement: hoverDisplacement, radius: hoverRadius, boost: hoverBoost },
        rings: ringsNow,
      })
      return
    }
    if (!ctx) return

    let image = imageRef.current
    if (!image || image.width !== width || image.height !== height) {
      image = ctx.createImageData(width, height)
      imageRef.current = image
    } else {
      image.data.fill(0)
    }
    const matrix = bayer(matrixSize)
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)

    const cursorX = hoverX.get()
    const cursorY = hoverY.get()
    const reach2 = hoverRadius * hoverRadius * 4
    const glowRadius2 = (hoverRadius * 1.6) ** 2
    const [calmX, calmY, calmRadius, calmStrength] = calmCells
    const rings = ringsNow

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
            const falloff = Math.exp(-d2 / (hoverRadius * hoverRadius)) * hover
            const pull = falloff * (hoverDisplacement / hoverRadius)
            sx -= dx * pull
            sy -= dy * pull
            // The cursor also thickens the field a little, like a lens, so the pull is easy to see.
            boost += falloff * hoverBoost
          }
        }

        for (const ring of rings) {
          const dx = x - ring.x
          const dy = y - ring.y
          const d = Math.sqrt(dx * dx + dy * dy)
          const offset = (d - ring.radius) / shockwaveWidth
          if (offset > -3 && offset < 3 && d > 0) {
            const strength = Math.exp(-offset * offset) * ring.fade
            sx -= (dx / d) * strength * ring.strength
            sy -= (dy / d) * strength * ring.strength
            boost += strength * ring.boost
          }
        }

        let u = (sx * cos - sy * sin) * scale
        let v = (sx * sin + sy * cos) * scale
        if (warp > 0) {
          u += (noise(u * 0.45 + 17, v * 0.45, z * 0.6) - 0.5) * warp
          v += (noise(u * 0.45, v * 0.45 + 43, z * 0.6) - 0.5) * warp
        }
        const n = noise(u, v, z) * (1 - detail) + noise(u * 2.1 + 31.4, v * 2.1, z * 1.6) * detail
        let value = (n - 0.5) * contrast + breathing + boost
        if (fade > 0) value -= smooth(Math.min(1, Math.max(0, (y / height - (1 - fade)) / fade))) * (breathing + 0.25)
        if (calmStrength > 0) value -= Math.exp(-((x - calmX) ** 2 + (y - calmY) ** 2) / (calmRadius * calmRadius)) * calmStrength
        const threshold = matrix[(y % matrixSize) * matrixSize + (x % matrixSize)]
        if (value > threshold) {
          const i = (y * width + x) * 4
          if (value - threshold < tone) {
            const lit = hoverGlow > 0 && hover > 0.003 ? Math.exp(-((x - cursorX) ** 2 + (y - cursorY) ** 2) / glowRadius2) * hover * hoverGlow : 0
            image.data[i] = lerp(tr, r, lit)
            image.data[i + 1] = lerp(tg, g, lit)
            image.data[i + 2] = lerp(tb, b, lit)
            image.data[i + 3] = Math.round(lerp(toneAlpha, 1, lit) * 255)
          } else {
            image.data[i] = r
            image.data[i + 1] = g
            image.data[i + 2] = b
            image.data[i + 3] = 255
          }
        }
      }
    }
    ctx.putImageData(image, 0, 0)
  })

  return <canvas ref={canvasRef} className={cn('block size-full [image-rendering:pixelated]', className)} {...props} />
}
