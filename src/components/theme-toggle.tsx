import type { ComponentProps } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { LuMoon, LuSun } from 'react-icons/lu'

import { Button } from '@/components/ui/button'
import { useTheme } from '@/components/theme-context'
import { click8bitSound } from '@/lib/click-8bit'
import { SPRING_SWAP } from '@/lib/ease'
import { playSound } from '@/lib/sound-engine'

// Spreads the rest of its props so a wrapper such as Tooltip can attach its handlers.
function ThemeToggle({
  className,
  onClick,
  ...props
}: Omit<ComponentProps<typeof Button>, 'className'> & { className?: string }) {
  const { theme, isTransitioning, toggleTheme } = useTheme()
  const reducedMotion = useReducedMotion()
  const nextTheme = theme === 'dark' ? 'light' : 'dark'
  const Icon = nextTheme === 'dark' ? LuMoon : LuSun

  function handleToggle(event: Parameters<NonNullable<typeof onClick>>[0]) {
    onClick?.(event)
    const rect = event.currentTarget.getBoundingClientRect()
    if (!toggleTheme({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })) return

    void playSound(click8bitSound.dataUri, {
      volume: 0.25,
      playbackRate: nextTheme === 'dark' ? 0.85 : 1.25,
    }).catch(() => undefined)
  }

  return (
    <Button
      {...props}
      type="button"
      variant="ghost"
      size="icon"
      // Busy, not disabled: a press during the switch is queued and sends the theme straight back.
      aria-busy={isTransitioning || undefined}
      aria-label={`Switch to ${nextTheme} mode`}
      onClick={handleToggle}
      className={className}
    >
      {/* The sun and moon trade places with a quarter turn. */}
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={nextTheme}
          className="flex"
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, rotate: -90, scale: 0.5 }}
          animate={reducedMotion ? { opacity: 1 } : { opacity: 1, rotate: 0, scale: 1 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, rotate: 90, scale: 0.5 }}
          transition={reducedMotion ? { duration: 0.15 } : SPRING_SWAP}
        >
          <Icon aria-hidden="true" className="size-5" />
        </motion.span>
      </AnimatePresence>
    </Button>
  )
}

export { ThemeToggle }
