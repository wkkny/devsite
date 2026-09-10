import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  IconClock,
  IconCode,
  IconHeart,
  IconMail,
  IconMapPin,
  type Icon,
} from '@tabler/icons-react'

import { portfolio } from '@/config/portfolio'
import { click8bitSound } from '@/lib/click-8bit'
import { playSound } from '@/lib/sound-engine'
import { formatOwnerTime, formatTimeDifference } from '@/lib/time'
import { cn } from '@/lib/utils'

type PillItem = {
  id: string
  icon: Icon
  label: string
  ariaLabel: string
}

// Discord-style tag pills: icons that expand into a labelled pill on press.
function HeroPills() {
  const prefersReducedMotion = useReducedMotion() ?? false
  const [active, setActive] = useState<string | null>(null)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(interval)
  }, [])

  const viewerTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const timeText = `${formatOwnerTime(now)} // ${formatTimeDifference(now, viewerTimeZone)}`

  const pills: PillItem[] = [
    { id: 'occupation', icon: IconCode, label: portfolio.profile.occupation, ariaLabel: portfolio.profile.occupation },
    { id: 'time', icon: IconClock, label: timeText, ariaLabel: "Owner's local time" },
    { id: 'location', icon: IconMapPin, label: portfolio.profile.location.label, ariaLabel: portfolio.profile.location.label },
    { id: 'email', icon: IconMail, label: portfolio.links.email.address, ariaLabel: portfolio.links.email.address },
    { id: 'note', icon: IconHeart, label: portfolio.profile.note.label, ariaLabel: portfolio.profile.note.label },
  ]

  return (
    <div className="flex flex-wrap gap-2" data-disable-bg-hover>
      {pills.map((pill) => {
        const isActive = active === pill.id
        const Icon = pill.icon

        return (
          <motion.button
            key={pill.id}
            layout={!prefersReducedMotion}
            type="button"
            aria-expanded={isActive}
            aria-label={pill.ariaLabel}
            onClick={() => {
              void playSound(click8bitSound.dataUri, {
                volume: 0.2,
                playbackRate: isActive ? 0.9 : 1.1,
              }).catch(() => {
                // Pill toggling should still work when audio is unavailable.
              })
              setActive((current) => (current === pill.id ? null : pill.id))
            }}
            className={cn(
              'flex h-9 items-center rounded-full border text-xs font-medium transition-colors',
              isActive
                ? 'border-line bg-muted/70 text-foreground'
                : 'border-line bg-muted/40 text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            )}
          >
            <span className="flex size-9 shrink-0 items-center justify-center">
              <Icon className="size-4" />
            </span>
            <AnimatePresence initial={false}>
              {isActive && (
                <motion.span
                  initial={prefersReducedMotion ? false : { width: 0, opacity: 0 }}
                  animate={{ width: 'auto', opacity: 1 }}
                  exit={prefersReducedMotion ? { width: 0, opacity: 0, transition: { duration: 0 } } : { width: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  className="overflow-hidden whitespace-nowrap pr-3"
                >
                  {pill.label}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        )
      })}
    </div>
  )
}

export { HeroPills }
