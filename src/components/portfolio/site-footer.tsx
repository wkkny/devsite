import { motion, useReducedMotion } from 'motion/react'

import { portfolioOwner } from '@/data'
import { LAYOUT_SWAP } from '@/lib/ease'

export function SiteFooter() {
  const reducedMotion = useReducedMotion()

  // Glides with the projects when switching between grid and list changes their height.
  return (
    <motion.footer
      layout="position"
      transition={{ layout: reducedMotion ? { duration: 0 } : LAYOUT_SWAP }}
      className="flex flex-wrap items-center justify-between gap-3 border-t border-border py-6 type-label text-muted-foreground"
    >
      <p>© {new Date().getFullYear()} {portfolioOwner.displayName}</p>
    </motion.footer>
  )
}
