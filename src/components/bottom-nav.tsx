import {
  IconBrandGithub,
  IconCode,
  IconHome,
  type Icon,
} from '@tabler/icons-react'

import { ModeToggle } from '@/components/mode-toggle'

type NavItem = {
  label: string
  href: string
  icon: Icon
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Home', href: '#top', icon: IconHome },
  { label: 'GitHub', href: '#github', icon: IconBrandGithub },
  { label: 'Projects', href: '#projects', icon: IconCode },
]

// Discord-inspired floating dock for mobile, a bit rounder than the original.
function BottomNav() {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 md:hidden"
    >
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-0.5 rounded-[28px] border border-line bg-background/90 p-1.5 shadow-lg shadow-black/10 backdrop-blur-md">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon

            return (
              <a
                key={item.label}
                href={item.href}
                aria-label={item.label}
                className="flex items-center justify-center rounded-full p-2.5 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground active:scale-95"
              >
                <Icon className="size-5" aria-hidden="true" />
              </a>
            )
          })}
        </div>

        <div className="flex size-10 items-center justify-center rounded-full border border-line bg-background/90 shadow-lg shadow-black/10 backdrop-blur-md [&_button]:rounded-full">
          <ModeToggle />
        </div>
      </div>
    </nav>
  )
}

export { BottomNav }
