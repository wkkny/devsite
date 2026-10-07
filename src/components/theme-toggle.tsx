import type { ComponentProps } from 'react'
import { LuMoon, LuSun } from 'react-icons/lu'

import { Button } from '@/components/ui/button'
import { useTheme } from '@/components/theme-context'
import { click8bitSound } from '@/lib/click-8bit'
import { playSound } from '@/lib/sound-engine'

// Spreads the rest of its props so a wrapper such as Tooltip can attach its handlers.
function ThemeToggle({
  className,
  onClick,
  ...props
}: Omit<ComponentProps<typeof Button>, 'className'> & { className?: string }) {
  const { theme, isTransitioning, toggleTheme } = useTheme()
  const nextTheme = theme === 'dark' ? 'light' : 'dark'
  const Icon = nextTheme === 'dark' ? LuMoon : LuSun

  function handleToggle(event: Parameters<NonNullable<typeof onClick>>[0]) {
    onClick?.(event)
    if (!toggleTheme()) return

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
      aria-disabled={isTransitioning}
      aria-label={`Switch to ${nextTheme} mode`}
      onClick={handleToggle}
      className={className}
    >
      <Icon aria-hidden="true" className="size-5" />
    </Button>
  )
}

export { ThemeToggle }
