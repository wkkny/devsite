// Motion presets shared across the site.

/** Fast start and a long, gentle settle: entrances and most interface motion. */
export const EASE_OUT = [0.16, 1, 0.3, 1] as const

/** Slow at both ends: the full-screen theme cover. */
export const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const

/** Icon and label swaps inside a control. */
export const SPRING_SWAP = { type: 'spring', stiffness: 460, damping: 30, mass: 0.55 } as const

/** Grid and list swaps: cards and the content below them gliding to their new places. */
export const LAYOUT_SWAP = { duration: 0.4, ease: EASE_OUT } as const
