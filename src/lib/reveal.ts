import type { Variants } from 'motion/react'

import { EASE_OUT } from '@/lib/ease'

/** When the hero has finished entering, in seconds after navigation start. */
const HERO_SETTLED = 1.05

/**
 * Seconds a section should wait before revealing. A section already on screen at load (tall
 * phones) waits for the hero to finish first; one revealed by scrolling goes straight away.
 */
export function heroHold() {
  return Math.max(0, HERO_SETTLED - performance.now() / 1000)
}

/** A section heading or row that rises into place once, the first time it scrolls into view. */
export const revealRise: Variants = {
  hidden: { opacity: 0, y: 14, filter: 'blur(4px)' },
  shown: () => ({
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    // A leftover filter keeps a compositing layer and clips hover shadows, so clear it once settled.
    transitionEnd: { filter: 'none' },
    transition: { duration: 0.55, ease: EASE_OUT, delay: heroHold() },
  }),
}

/** Children staggered 70ms apart, after the heading has started. */
export const revealStagger: Variants = {
  hidden: {},
  shown: () => ({ transition: { delayChildren: heroHold() + 0.1, staggerChildren: 0.07 } }),
}

/** One staggered child: a card or row. */
export const revealItem: Variants = {
  hidden: { opacity: 0, y: 16, filter: 'blur(4px)' },
  shown: { opacity: 1, y: 0, filter: 'blur(0px)', transitionEnd: { filter: 'none' }, transition: { duration: 0.55, ease: EASE_OUT } },
}

/** Reduced motion: a short fade, no movement. */
export const revealFade: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: 0.2, ease: EASE_OUT } },
}

export const revealViewport = { once: true, amount: 0.25 } as const
