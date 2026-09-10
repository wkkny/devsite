import { useState } from 'react'
import { IconMoon } from '@tabler/icons-react'
import { motion, useReducedMotion } from 'motion/react'

import { Button } from '@/components/ui/button'
import { useTheme } from '@/components/theme-context'
import { click8bitSound } from '@/lib/click-8bit'
import { playSound } from '@/lib/sound-engine'

function ModeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [animationKey, setAnimationKey] = useState(0)
  const prefersReducedMotion = useReducedMotion()
  const isDark = resolvedTheme === 'dark'
  const shouldAnimate = animationKey > 0 && !prefersReducedMotion

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-lg"
      aria-label="Toggle color mode"
      onClick={() => {
        const nextTheme = isDark ? 'light' : 'dark'

        void playSound(click8bitSound.dataUri, {
          volume: 0.25,
          playbackRate: nextTheme === 'light' ? 1.25 : 0.85,
        }).catch(() => {
          // Theme switching should still work when audio is unavailable.
        })

        setAnimationKey((key) => key + 1)
        setTheme(nextTheme)
      }}
    >
      {isDark ? (
        <motion.span
          key={`moon-${animationKey}`}
          className="inline-flex origin-top"
          initial={{ rotate: 0 }}
          animate={shouldAnimate ? { rotate: [0, -8, 6, -3, 1.5, 0] } : { rotate: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <IconMoon />
        </motion.span>
      ) : (
        <SunIcon key={`sun-${animationKey}`} animate={shouldAnimate} />
      )}
    </Button>
  )
}

function SunIcon({ animate }: { animate: boolean }) {
  const rays = [
    { x1: '12', y1: '2', x2: '12', y2: '4' },
    { x1: '18.36', y1: '5.64', x2: '16.95', y2: '7.05' },
    { x1: '22', y1: '12', x2: '20', y2: '12' },
    { x1: '18.36', y1: '18.36', x2: '16.95', y2: '16.95' },
    { x1: '12', y1: '22', x2: '12', y2: '20' },
    { x1: '5.64', y1: '18.36', x2: '7.05', y2: '16.95' },
    { x1: '2', y1: '12', x2: '4', y2: '12' },
    { x1: '5.64', y1: '5.64', x2: '7.05', y2: '7.05' },
  ]

  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <motion.circle
        cx="12"
        cy="12"
        r="4"
        initial={animate ? { scale: 0.8 } : { scale: 1 }}
        animate={animate ? { scale: [0.8, 1.12, 1] } : { scale: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        style={{ originX: '12px', originY: '12px' }}
      />
      {rays.map((ray, index) => (
        <motion.line
          key={`${ray.x1}-${ray.y1}-${ray.x2}-${ray.y2}`}
          {...ray}
          initial={animate ? { opacity: 0, scale: 0.25 } : { opacity: 1, scale: 1 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            delay: animate ? 0.08 + index * 0.055 : 0,
            duration: 0.24,
            ease: 'easeOut',
          }}
          style={{ originX: '12px', originY: '12px' }}
        />
      ))}
    </motion.svg>
  )
}

export { ModeToggle }
