/** The new theme grows out of the toggle as a circle, on a slow-in, slow-out curve. */
export const WAVE_DURATION = 720
export const WAVE_EASE = [0.65, 0, 0.35, 1] as const

/** How far behind the circle's edge the dithered fringe reaches, in px. */
export const WAVE_BAND = 72

export type WaveOrigin = { x: number; y: number }

/** The clip animation, once the view transition starts it. The fringe reads its clock. */
export type WaveClock = { animation: Animation | null }

/** Reaches the farthest corner of the viewport from the origin, plus room for the fringe to clear it. */
export function waveRadius({ x, y }: WaveOrigin) {
  return Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y)) + WAVE_BAND
}
