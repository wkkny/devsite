import { useEffect, useState } from 'react'
import {
  IconClock,
  IconCode,
  IconHeart,
  IconMail,
  IconMapPin,
  type Icon,
} from '@tabler/icons-react'

import { portfolio } from '@/config/portfolio'
import { toast } from '@/components/ui/toast'
import { formatOwnerTime, formatTimeDifference } from '@/lib/time'

type PillItem = {
  icon: Icon
  title: string
  description: string
  ariaLabel: string
}

// Discord-style info icons: pressing one pops a toast with the details.
function HeroPills() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(interval)
  }, [])

  const viewerTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const timeText = `${formatOwnerTime(now)} // ${formatTimeDifference(now, viewerTimeZone)}`

  const pills: PillItem[] = [
    { icon: IconCode, title: 'Occupation', description: portfolio.profile.occupation, ariaLabel: 'Show occupation' },
    { icon: IconClock, title: "Owner's local time", description: timeText, ariaLabel: "Show owner's local time" },
    { icon: IconMapPin, title: 'Location', description: portfolio.profile.location.label, ariaLabel: 'Show location' },
    { icon: IconMail, title: 'Email', description: portfolio.links.email.address, ariaLabel: 'Show email address' },
    { icon: IconHeart, title: 'Note', description: portfolio.profile.note.label, ariaLabel: 'Show note' },
  ]

  return (
    <div className="flex flex-wrap justify-center gap-2" data-disable-bg-hover>
      {pills.map((pill) => {
        const Icon = pill.icon

        return (
          <button
            key={pill.ariaLabel}
            type="button"
            aria-label={pill.ariaLabel}
            onClick={() => {
              toast.add({
                type: 'info',
                title: pill.title,
                description: pill.description,
              })
            }}
            className="flex size-9 items-center justify-center rounded-full border border-line bg-muted/40 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground active:scale-90"
          >
            <Icon className="size-4" aria-hidden="true" />
          </button>
        )
      })}
    </div>
  )
}

export { HeroPills }
