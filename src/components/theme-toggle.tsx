import { LuMoon, LuSun } from 'react-icons/lu'

import { Button } from '@/components/ui/button'
import { useTheme } from '@/components/theme-context'

function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme()
  const nextTheme = theme === 'dark' ? 'light' : 'dark'
  const Icon = nextTheme === 'dark' ? LuMoon : LuSun
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={`Switch to ${nextTheme} mode`}
      onClick={toggleTheme}
      className={className}
    >
      <Icon aria-hidden="true" className="size-5" />
    </Button>
  )
}

export { ThemeToggle }
