import type { Variants } from 'motion/react'

import { EASE_OUT } from '@/lib/ease'

/** When the hero has finished entering, in seconds after navigation start. */
const HERO_SETTLED = 0.9

/**
 * Seconds a section should wait before revealing. A section already on screen at load (tall
 * phones) waits for the hero to finish first; one revealed by scrolling goes straight away.
 */
export function heroHold() {
  // Reloaded or deep-linked further down the page: the hero isn't in view, so don't wait for it.
  if (window.scrollY > 120) return 0
  return Math.max(0, HERO_SETTLED - performance.now() / 1000)
}

/** A section or row that rises into place once, the first time it scrolls into view. No blur:
 * that belongs to the hero copy, and headings inside get their own mask reveal. */
export const revealRise: Variants = {
  hidden: { opacity: 0, y: 14 },
  shown: () => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: EASE_OUT, delay: heroHold() },
  }),
}

/** Children staggered 70ms apart, after the heading has started. */
export const revealStagger: Variants = {
  hidden: {},
  shown: () => ({ transition: { delayChildren: heroHold() + 0.1, staggerChildren: 0.07 } }),
}

// Opacity in three steps (0, 50%, 100%), like the calendar squares printing in: the dither language
// carried below the hero.
const printIn = (t: number) => (t < 1 / 3 ? 0 : t < 2 / 3 ? 0.5 : 1)

/** One staggered child: a card or row. It rises into place while it prints in. No blur here. */
export const revealItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  shown: {
    opacity: 1,
    y: 0,
    transition: { y: { duration: 0.5, ease: EASE_OUT }, opacity: { duration: 0.21, ease: printIn } },
  },
}

/** Reduced motion: a short fade, no movement. */
export const revealFade: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: 0.2, ease: EASE_OUT } },
}

export const revealViewport = { once: true, amount: 0.25 } as const
