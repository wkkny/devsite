import { motion } from 'motion/react'

import { DitherCanvas } from '@/components/dither-canvas'

// Site defaults for the banner. Colors come from the theme tokens, so restyle it with classes.
// Kept in its own chunk so the banner stays optional.
export default function ProfileBanner() {
  return (
    <motion.div
      className="absolute inset-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.9, ease: 'easeOut', delay: 0.1 }}
    >
      <DitherCanvas className="bg-background text-portfolio-blue" rotation={70} density={0.38} />
    </motion.div>
  )
}
