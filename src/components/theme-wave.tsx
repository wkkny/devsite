import { useLayoutEffect, useRef } from 'react'

import type { RevealColors } from '@/components/pixel-reveal'
import { cubicBezier } from '@/lib/ease'
import { WAVE_BAND as BAND, WAVE_DURATION, WAVE_EASE, waveRadius, type WaveClock, type WaveOrigin } from '@/lib/theme-wave'

const CELL = 14
const GLYPHS = ['@', '8', '#', '%', '*', '+', '=', '-', '.']

/**
 * The fringe on the leading edge of the theme wave. It is drawn inside the new theme, which
 * the view transition clips to a growing circle, and paints cells of the old background just
 * behind the edge, so the boundary breaks up into the same dithered squares and glyphs as the
 * banner instead of a smooth line.
 */
export function ThemeWave({ origin, oldColors, clock }: { origin: WaveOrigin; oldColors: RevealColors; clock: WaveClock }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const w = window.innerWidth
    const h = window.innerHeight
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    canvas.width = Math.ceil(w * dpr)
    canvas.height = Math.ceil(h * dpr)
    ctx.scale(dpr, dpr)
    ctx.font = `${Math.round(CELL * 0.62)}px ui-monospace, monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const cols = Math.ceil(w / CELL)
    const rows = Math.ceil(h / CELL)
    const distance = new Float32Array(cols * rows)
    const depth = new Float32Array(cols * rows)
    const glyph = new Uint8Array(cols * rows)
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c
        distance[i] = Math.hypot(c * CELL + CELL / 2 - origin.x, r * CELL + CELL / 2 - origin.y)
        // Each cell lets go at its own depth behind the edge, so the fringe is ragged.
        depth[i] = Math.random() ** 1.6 * BAND
        glyph[i] = Math.floor(Math.random() * GLYPHS.length)
      }

    const radius = waveRadius(origin)
    const [x1, y1, x2, y2] = WAVE_EASE
    let frame = 0
    let start: number | null = null
    // Steps the (paused) clip animation from this loop, so the circle and its fringe always draw
    // the same frame, even when the main thread stalls.
    const tick = (now: number) => {
      if (!clock.animation) {
        frame = requestAnimationFrame(tick)
        return
      }
      // A second press finished the wave early: stop stepping, or the clip would rewind.
      if (clock.animation.playState === 'finished') {
        ctx.clearRect(0, 0, w, h)
        return
      }
      start ??= now
      const elapsed = Math.min(WAVE_DURATION, now - start)
      clock.animation.currentTime = elapsed
      const linear = elapsed / WAVE_DURATION
      const edge = cubicBezier(x1, y1, x2, y2, linear) * radius
      ctx.clearRect(0, 0, w, h)
      for (let i = 0; i < distance.length; i++) {
        const behind = edge - distance[i]
        // Cells straddling the edge are drawn too, so no sliver of the smooth circle shows between them.
        if (behind < -CELL || behind > depth[i]) continue
        const x = (i % cols) * CELL
        const y = Math.floor(i / cols) * CELL
        const t = Math.max(0, behind) / BAND
        ctx.globalAlpha = 1
        ctx.fillStyle = oldColors.background
        ctx.fillRect(x, y, CELL, CELL)
        // Glyphs burn brightest right at the edge and cool as it moves on.
        ctx.globalAlpha = (1 - t) * 0.7
        ctx.fillStyle = oldColors.blue
        ctx.fillText(GLYPHS[(glyph[i] + Math.floor(t * 6)) % GLYPHS.length], x + CELL / 2, y + CELL / 2)
      }
      if (linear < 1) {
        frame = requestAnimationFrame(tick)
        return
      }
      ctx.clearRect(0, 0, w, h)
      clock.animation.finish()
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      // Never leave the paused clip holding the view transition open.
      clock.animation?.finish()
    }
  }, [origin, oldColors, clock])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{ position: 'fixed', inset: 0, width: '100vw', height: '100dvh', pointerEvents: 'none', zIndex: 999 }}
    />
  )
}
