import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

import { EASE_OUT } from '@/lib/ease'

const projectStatusMessages = [
  'Cooking up fresh projects.',
  'Conjuring logos and little details.',
  'Polishing pixels until they click.',
  'Turning curious ideas into working things.',
]

const statusInterval = 4200

export function ProjectStatus() {
  const reducedMotion = useReducedMotion()
  const [messageIndex, setMessageIndex] = useState(0)

  useEffect(() => {
    const interval = window.setInterval(() => {
      setMessageIndex((currentIndex) => (currentIndex + 1) % projectStatusMessages.length)
    }, statusInterval)

    return () => window.clearInterval(interval)
  }, [])

  return (
    <motion.div className="project-status mt-6 flex w-full items-center justify-center gap-3 text-sm text-muted-foreground" aria-live="polite">
      <motion.svg
        layout="position"
        transition={{ layout: { duration: reducedMotion ? 0 : 0.3, ease: EASE_OUT } }}
        className="project-status-loader size-6 shrink-0 text-portfolio-blue"
        viewBox="0 0 32 32"
        aria-hidden="true"
      >
        <path d="M16 16C11 12 5 11 5 7c0-4 5-5 8-2 3 3 2 8 3 11Z" fill="currentColor" />
        <path d="M16 16C11 12 5 11 5 7c0-4 5-5 8-2 3 3 2 8 3 11Z" fill="currentColor" transform="rotate(90 16 16)" />
        <path d="M16 16C11 12 5 11 5 7c0-4 5-5 8-2 3 3 2 8 3 11Z" fill="currentColor" transform="rotate(180 16 16)" />
        <path d="M16 16C11 12 5 11 5 7c0-4 5-5 8-2 3 3 2 8 3 11Z" fill="currentColor" transform="rotate(270 16 16)" />
      </motion.svg>
      <motion.span
        layout="position"
        transition={{ layout: { duration: reducedMotion ? 0 : 0.3, ease: EASE_OUT } }}
        className="relative min-w-0 max-w-full overflow-hidden text-left"
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={messageIndex}
            className="block"
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, filter: 'blur(6px)', transform: 'perspective(600px) rotateX(-90deg)' }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, filter: 'blur(0px)', transform: 'perspective(600px) rotateX(0deg)' }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, filter: 'blur(6px)', transform: 'perspective(600px) rotateX(90deg)' }}
            style={{ backfaceVisibility: 'hidden', transformOrigin: 'center center' }}
            transition={{ duration: reducedMotion ? 0.16 : 0.3, ease: EASE_OUT }}
          >
            {projectStatusMessages[messageIndex]}
          </motion.span>
        </AnimatePresence>
      </motion.span>
    </motion.div>
  )
}
