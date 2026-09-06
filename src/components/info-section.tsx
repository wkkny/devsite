import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import {
  IconCheck,
  IconClock,
  IconCode,
  IconCopy,
  IconGenderMale,
  IconHeart,
  IconMail,
  IconMapPin,
  type Icon,
} from '@tabler/icons-react'

import { IconSwap, IconSwapItem } from '@/components/icon-swap'

import archLogo from '@/assets/archlinux-icon-crystal-32.svg'

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

type InfoSectionProps = {
  className?: string
}

function InfoSection({ className }: InfoSectionProps) {
  return (
    <section className={className}>
      <div className="grid gap-0 md:grid-cols-2">
        <SocialColumn items={PROFILE_ITEMS} />
        <SocialColumn>
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

function ArchLabel() {
  return (
    <span className="inline-block border-b border-transparent leading-none transition-opacity duration-200 delay-[1200ms] group-hover:opacity-0 group-hover:delay-0">
      Arch
    </span>
  )
}

function SocialLabel({ label }: { label: string }) {
  if (label === 'New Delhi, India') {
    return (
      <span className="min-w-0 truncate cursor-pointer font-mono text-xs text-foreground sm:text-sm">
        <span className="inline-block border-b border-transparent leading-none hover:border-foreground">New Delhi, India</span>
      </span>
    )
  }

  if (label === 'I used to use Arch btw') {
    return (
      <span className="relative min-w-0 font-mono text-xs text-foreground sm:text-sm">
        I used to use{' '}
        <span className="group relative inline-block cursor-pointer align-baseline">
          <ArchLabel />
          <img
            src={archLogo}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 h-[1.6em] w-auto max-w-none -translate-x-1/2 -translate-y-1/2 opacity-0 blur-lg transition-[opacity,filter] duration-300 delay-900 group-hover:opacity-100 group-hover:blur-none group-hover:delay-0"
          />
        </span>{' '}
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

function EmailRow({ item }: SocialRowProps) {
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const Icon = item.icon
  const href = item.href ?? ''

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (copied) return

    navigator.clipboard.writeText('kritiraj.tech@gmail.com')
    setCopied(true)

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => setCopied(false), 2000)
  }

  return (
    <a
      href={href}
      target={href.startsWith('http') ? '_blank' : undefined}
      rel={href.startsWith('http') ? 'noreferrer' : undefined}
      className="flex items-center gap-3 transition-colors hover:text-muted-foreground"
    >
      <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-line bg-muted/40 text-muted-foreground shadow-inner">
        <Icon className="size-4" />
      </span>
      <span className="flex items-center gap-2 min-w-0 truncate font-mono text-xs text-foreground sm:text-sm">
        <span className="border-b border-transparent transition-colors hover:border-foreground">kritiraj.tech@gmail.com</span>
        <button
          type="button"
          onClick={handleCopy}
          disabled={copied}
          className="flex size-5 shrink-0 items-center justify-center rounded border border-line bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:cursor-default disabled:hover:bg-muted/40 active:scale-90"
          aria-label={copied ? 'Copied!' : 'Copy email'}
        >
          <IconSwap>
            {!copied ? (
              <IconSwapItem key="copy" className="flex items-center">
                <IconCopy className="size-3.5" />
              </IconSwapItem>
            ) : (
              <IconSwapItem key="check" className="flex items-center text-green-500">
                <IconCheck className="size-3.5" />
              </IconSwapItem>
            )}
          </IconSwap>
        </button>
      </span>
    </a>
  )
}

function SocialRow({ item }: SocialRowProps) {
  if (item.label === 'Email' && item.href) {
    return <EmailRow item={item} />
  }

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

export { InfoSection }
