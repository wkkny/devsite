import { useEffect, useMemo, useState, type ReactNode } from 'react'

import {
  IconClock,
  IconCode,
  IconGenderMale,
  IconHeart,
  IconMail,
  IconMapPin,
  type Icon,
} from '@tabler/icons-react'

import { cn } from '@/lib/utils'

const OWNER_TIME_ZONE = 'Asia/Kolkata'

type SocialItem = {
  label: string
  icon: Icon
  href?: string
}

const PROFILE_ITEMS: SocialItem[] = [
  {
    label: 'Full Stack Developer',
    icon: IconCode,
  },
  {
    label: 'New Delhi, India',
    icon: IconMapPin,
  },
  {
    label: 'I used to use Arch btw',
    icon: IconHeart,
  },
]

const SOCIAL_ITEMS: SocialItem[] = [
  {
    label: 'Email',
    href: 'mailto:kritiraj.tech@gmail.com',
    icon: IconMail,
  },
  {
    label: 'he/him',
    icon: IconGenderMale,
  },
]

type SocialSectionProps = {
  className?: string
}

function SocialSection({ className }: SocialSectionProps) {
  return (
    <section className={cn('border-x border-line', className)}>
      <div className="grid gap-0 md:grid-cols-2">
        <SocialColumn items={PROFILE_ITEMS} />
        <SocialColumn className="border-t border-line md:border-t-0 md:border-l md:border-dashed">
          <LocalTimeRow />
          {SOCIAL_ITEMS.map((item) => (
            <SocialRow key={item.label} item={item} />
          ))}
        </SocialColumn>
      </div>
    </section>
  )
}

type SocialColumnProps = {
  items?: SocialItem[]
  children?: ReactNode
  className?: string
}

function SocialColumn({ items = [], children, className }: SocialColumnProps) {
  return (
    <div className={cn('space-y-2.5 p-4', className)}>
      {items.map((item) => (
        <SocialRow key={item.label} item={item} />
      ))}
      {children}
    </div>
  )
}

function LocalTimeRow() {
  const viewerTimeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    [],
  )
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(interval)
  }, [])

  return (
    <div className="flex items-center gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-line bg-muted/40 text-muted-foreground shadow-inner">
        <IconClock className="size-4" />
      </span>
      <span className="min-w-0 truncate font-mono text-xs text-foreground sm:text-sm">
        {formatOwnerTime(now)}
        <span className="text-muted-foreground"> // {formatTimeDifference(now, viewerTimeZone)}</span>
      </span>
    </div>
  )
}

function formatOwnerTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: OWNER_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatTimeDifference(date: Date, viewerTimeZone: string): string {
  const difference = getTimeZoneOffset(date, OWNER_TIME_ZONE) - getTimeZoneOffset(date, viewerTimeZone)

  if (difference === 0) return 'same time'

  const absoluteDifference = Math.abs(difference)
  const hours = Math.floor(absoluteDifference / 60)
  const minutes = absoluteDifference % 60
  const parts = [
    hours > 0 ? `${hours}h` : '',
    minutes > 0 ? `${minutes}m` : '',
  ].filter(Boolean)

  return `${parts.join(' ')} ${difference > 0 ? 'ahead' : 'behind'}`
}

function getTimeZoneOffset(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  }).formatToParts(date)

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const timeZoneTime = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  )

  return Math.round((timeZoneTime - date.getTime()) / 60000)
}

type SocialRowProps = {
  item: SocialItem
}

function SocialLabel({ label }: { label: string }) {
  if (label === 'New Delhi, India') {
    return (
      <span className="min-w-0 truncate font-mono text-xs text-foreground sm:text-sm">
        <span className="inline-block border-b border-transparent leading-none hover:border-foreground">New Delhi, India</span>
      </span>
    )
  }

  if (label === 'I used to use Arch btw') {
    return (
      <span className="min-w-0 truncate font-mono text-xs text-foreground sm:text-sm">
        I used to use{' '}
        <span className="inline-block border-b border-transparent leading-none hover:border-foreground">Arch</span>{' '}
        btw
      </span>
    )
  }

  return (
    <span className="min-w-0 truncate font-mono text-xs text-foreground sm:text-sm">
      {label}
    </span>
  )
}

function SocialRow({ item }: SocialRowProps) {
  const Icon = item.icon
  const content = (
    <>
      <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-line bg-muted/40 text-muted-foreground shadow-inner">
        <Icon className="size-4" />
      </span>
      <SocialLabel label={item.label} />
    </>
  )

  if (!item.href) {
    return <div className="flex items-center gap-3">{content}</div>
  }

  return (
    <a
      href={item.href}
      target={item.href.startsWith('http') ? '_blank' : undefined}
      rel={item.href.startsWith('http') ? 'noreferrer' : undefined}
      className="flex items-center gap-3 transition-colors hover:text-muted-foreground"
    >
      {content}
    </a>
  )
}

export { SocialSection }
