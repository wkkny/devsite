import {
  IconBrandGithub,
  IconCode,
  IconHome,
  IconInfoCircle,
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
  { label: 'Info', href: '#info', icon: IconInfoCircle },
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
      <div className="flex items-center gap-0.5 rounded-[28px] border border-line bg-background/90 p-1.5 shadow-lg shadow-black/10 backdrop-blur-md">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon

          return (
            <a
              key={item.label}
              href={item.href}
              className="flex flex-col items-center gap-0.5 rounded-[22px] px-3.5 py-1.5 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground active:scale-95"
            >
              <Icon className="size-5" aria-hidden="true" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </a>
          )
        })}
        <ModeToggle />
      </div>
    </nav>
  )
}

export { BottomNav }
