import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'

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
    <div className="project-status flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
      <span className="project-status-dots inline-flex items-center gap-1" aria-hidden="true">
        {[0, 1, 2].map((dot) => (
          <span key={dot} className="project-status-dot size-1 rounded-full bg-portfolio-blue" />
        ))}
      </span>
      <span className="relative min-h-5 overflow-hidden">
        <motion.span
          key={messageIndex}
          className="block"
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, transform: 'translate3d(0, 4px, 0)' }}
          animate={reducedMotion ? { opacity: 1 } : { opacity: 1, transform: 'translate3d(0, 0, 0)' }}
          transition={{ duration: reducedMotion ? 0.2 : 0.24, ease: [0.16, 1, 0.3, 1] }}
        >
          {projectStatusMessages[messageIndex]}
        </motion.span>
      </span>
    </div>
  )
}
