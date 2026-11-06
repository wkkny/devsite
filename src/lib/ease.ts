// Motion presets shared across the site.

/** Fast start and a long, gentle settle: entrances and most interface motion. */
export const EASE_OUT = [0.16, 1, 0.3, 1] as const

/** Slow at both ends: the full-screen theme cover. */
export const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const

/** Icon and label swaps inside a control. */
export const SPRING_SWAP = { type: 'spring', stiffness: 460, damping: 30, mass: 0.55 } as const

/** Grid and list swaps: cards and the content below them gliding to their new places. */
export const LAYOUT_SWAP = { duration: 0.4, ease: EASE_OUT } as const

/** A CSS cubic-bezier evaluated at `t`, for motion driven frame by frame on a canvas. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number, t: number): number {
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
