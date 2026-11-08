import { motion, type Easing } from 'motion/react'
import { FiMail } from 'react-icons/fi'

// Quick to leave, then gone: a launch, not a settle.
const LAUNCH: Easing = [0.3, 0, 0.8, 0.15]

/**
 * The pill's envelope taking off: a small dip as if pressed, then a short lift up and away that
 * fades out just above the pill. It is confirmation only; the mail client opens on the click.
 * Render it over the icon it replaces.
 */
export function MailFlight({ onComplete }: { onComplete: () => void }) {
  return (
    <motion.span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-foreground"
      animate={{
        x: [0, 0, 10],
        y: [0, 2, -30],
        rotate: [0, 0, -14],
        scale: [1, 0.86, 0.9],
        opacity: [1, 1, 0],
      }}
      transition={{ duration: 0.44, times: [0, 0.18, 1], ease: ['easeOut', LAUNCH] as Easing[] }}
      onAnimationComplete={onComplete}
    >
      <FiMail className="size-4" />
    </motion.span>
  )
}
