import type { ReactNode } from 'react'
import { motion, useReducedMotion, type Variants } from 'motion/react'

import { EASE_OUT } from '@/lib/ease'
import { heroHold } from '@/lib/reveal'

// The delay is resolved when the reveal starts, so a heading reached by scrolling doesn't wait.
const slide: Variants = {
  hidden: { y: '105%' },
  shown: () => ({ y: 0, transition: { duration: 0.65, ease: EASE_OUT, delay: heroHold() } }),
}
const fade: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: 0.2, ease: EASE_OUT } },
}

/**
 * A line of display type that slides up out of its own baseline the first time it scrolls into
 * view: the same gesture as the hero name, kept for headings so they don't share the copy's blur.
 */
export function MaskReveal({ children }: { children: ReactNode }) {
  const reducedMotion = useReducedMotion()
  return (
    <span className="block overflow-hidden pb-[0.08em]">
      <motion.span
        className="inline-block"
        variants={reducedMotion ? fade : slide}
        initial="hidden"
        whileInView="shown"
        viewport={{ once: true, amount: 0.6 }}
      >
        {children}
      </motion.span>
    </span>
  )
}
