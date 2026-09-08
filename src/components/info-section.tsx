import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'

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

// ─── Intro choreography ──────────────────────────────────────────────────────

type IntroPhase = 'line' | 'travel' | 'done'

const LINE_AT_S = 0.9
const TRAVEL_AT_S = 1.9
const DONE_AT_S = 2.9
const TYPE_FIRST_S = 0.2
const TYPE_ROW_STAGGER_S = 0.15
const TYPE_SPEED_MS = 22
const BIG_SIZE = 64
const SMALL_SIZE = 24

const LINE_ICONS: { icon: Icon; key: string }[] = [
  { icon: IconCode, key: 'Full Stack Developer' },
  { icon: IconClock, key: 'time' },
  { icon: IconMapPin, key: 'New Delhi, India' },
  { icon: IconMail, key: 'Email' },
  { icon: IconHeart, key: 'I used to use Arch btw' },
  { icon: IconGenderMale, key: 'he/him' },
]

const ROW_KEYS = ['Full Stack Developer', 'New Delhi, India', 'I used to use Arch btw', 'time', 'Email', 'he/him'] as const

type RowSlotMeasure = { x: number; y: number }

type IntroContextValue = {
  phase: IntroPhase
  typeDelayFor: (label: string) => number
}

const IntroContext = createContext<IntroContextValue>({
  phase: 'done',
  typeDelayFor: () => 0,
})

function useIntro() {
  return useContext(IntroContext)
}

function useTypedText(text: string, delayMs: number) {
  const [typed, setTyped] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    let interval = 0
    const start = window.setTimeout(() => {
      const began = performance.now()
      interval = window.setInterval(() => {
        const n = Math.floor((performance.now() - began) / TYPE_SPEED_MS) + 1
        if (n >= text.length) {
          window.clearInterval(interval)
          setTyped(text)
          setDone(true)
        } else {
          setTyped(text.slice(0, n))
        }
      }, TYPE_SPEED_MS)
    }, delayMs)
    return () => {
      window.clearTimeout(start)
      if (interval) window.clearInterval(interval)
    }
  }, [text, delayMs])

  return { typed, done }
}

function TypedText({ text, delayMs, className }: { text: string; delayMs: number; className?: string }) {
  const { typed, done } = useTypedText(text, delayMs)
  return (
    <span className={className}>
      {typed}
      {!done && <span className="ml-0.5 inline-block w-[2px] animate-pulse self-stretch bg-foreground align-middle" />}
    </span>
  )
}

type IconIntroOverlayProps = {
  phase: IntroPhase
  slotsRef: React.MutableRefObject<Map<string, HTMLElement | null>>
}

function IconIntroOverlay({ phase, slotsRef }: IconIntroOverlayProps) {
  const sectionRef = useRef<HTMLDivElement | null>(null)

  const [metrics, setMetrics] = useState<{ w: number; h: number } | null>(null)
  useEffect(() => {
    if (phase === 'done') return
    const el = sectionRef.current
    if (!el) return
    const measure = () => {
      const w = el.offsetWidth
      const h = el.offsetHeight
      setMetrics((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }))
    }
    measure()
    let raf = 0
    if (phase === 'line') {
      const loop = () => {
        measure()
        raf = window.requestAnimationFrame(loop)
      }
      raf = window.requestAnimationFrame(loop)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => {
      window.cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [phase])

  if (phase === 'done') return null

  const w = metrics?.w ?? 0
  const h = metrics?.h ?? 0
  const lineSpacing = BIG_SIZE * 1.55
  const rowSpacing = BIG_SIZE * 1.4
  const lineTotal = (LINE_ICONS.length - 1) * lineSpacing
  const canFitOneLine = lineTotal + BIG_SIZE <= w

  const layout = canFitOneLine
    ? LINE_ICONS.map((_, i) => ({ row: 0, col: i, cols: LINE_ICONS.length }))
    : LINE_ICONS.map((_, i) => ({ row: i < 3 ? 0 : 1, col: i % 3, cols: 3 }))
  const spacing = canFitOneLine ? lineSpacing : Math.min(lineSpacing, (w - BIG_SIZE) / 2)
  const centerY = h / 2

  const targetFor = (label: string): RowSlotMeasure => {
    const slot = slotsRef.current.get(label)
    const el = sectionRef.current
    if (!slot || !el) return { x: 0, y: 0 }
    const sr = slot.getBoundingClientRect()
    const er = el.getBoundingClientRect()
    return { x: sr.left - er.left + sr.width / 2, y: sr.top - er.top + sr.height / 2 }
  }

  return (
    <div ref={sectionRef} className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {LINE_ICONS.map(({ icon: Icon, key }, i) => {
          const { row, col, cols } = layout[i]
          const lineX = (w - (cols - 1) * spacing) / 2 + col * spacing
          const lineY = canFitOneLine ? centerY : centerY + (row - 0.5) * rowSpacing
          const target = phase === 'travel' ? targetFor(key) : null
          return (
            <motion.div
              key={key}
              className="absolute flex items-center justify-center rounded-xl border border-line bg-muted/40 text-muted-foreground shadow-inner"
              style={{ width: BIG_SIZE, height: BIG_SIZE, left: lineX, top: lineY }}
              initial={{ x: -BIG_SIZE / 2, y: -BIG_SIZE / 2, opacity: 0, scale: 0.4 }}
              animate={
                phase === 'line'
                  ? { x: -BIG_SIZE / 2, y: -BIG_SIZE / 2, opacity: 1, scale: 1, rotate: 0 }
                  : target
                    ? {
                        x: target.x - lineX - BIG_SIZE / 2,
                        y: target.y - lineY - BIG_SIZE / 2,
                        opacity: 1,
                        scale: SMALL_SIZE / BIG_SIZE,
                        rotate: [0, (i % 2 === 0 ? -1 : 1) * 8, 0],
                      }
                    : { x: -BIG_SIZE / 2, y: -BIG_SIZE / 2, opacity: 1, scale: 1 }
              }
            transition={
              phase === 'line'
                ? { type: 'spring', stiffness: 480, damping: 26, delay: LINE_AT_S + i * 0.06 }
                : { duration: 0.62, ease: [0.23, 1, 0.32, 1], delay: i * 0.07, rotate: { times: [0, 0.4, 1], duration: 0.62 } }
            }
            >
              <Icon className="size-9" />
            </motion.div>
          )
        })}
      </div>
  )
}

type InfoSectionProps = {
  className?: string
}

function InfoSection({ className }: InfoSectionProps) {
  const reduced = useReducedMotion() ?? false
  const slotsRef = useRef<Map<string, HTMLElement | null>>(new Map())
  const [phase, setPhase] = useState<IntroPhase>(reduced ? 'done' : 'line')
  const iconVisible: 'visible' | 'hidden' = reduced || phase === 'done' ? 'visible' : 'hidden'

  useEffect(() => {
    if (reduced) return
    const timers = [
      window.setTimeout(() => setPhase('travel'), TRAVEL_AT_S * 1000),
      window.setTimeout(() => setPhase('done'), DONE_AT_S * 1000),
    ]
    return () => timers.forEach(t => window.clearTimeout(t))
  }, [reduced])

  const value = useMemo<IntroContextValue>(
    () => ({
      phase,
      typeDelayFor: (label: string) => {
        const idx = ROW_KEYS.indexOf(label as (typeof ROW_KEYS)[number])
        const safe = idx >= 0 ? idx : 0
        return (TYPE_FIRST_S + safe * TYPE_ROW_STAGGER_S) * 1000
      },
    }),
    [phase],
  )

  return (
    <section className={cn('relative', className)}>
      <IntroContext.Provider value={value}>
        {!reduced && <IconIntroOverlay phase={phase} slotsRef={slotsRef} />}
        <div className="grid gap-0 md:grid-cols-2">
          <SocialColumn items={PROFILE_ITEMS} slotsRef={slotsRef} iconVisible={iconVisible} className="pb-2.5 md:pb-4" />
          <SocialColumn slotsRef={slotsRef} iconVisible={iconVisible} className="pt-0 md:pt-4">
            <LocalTimeRow slotsRef={slotsRef} iconVisible={iconVisible} />
            {SOCIAL_ITEMS.map((item) => (
              <SocialRow key={item.label} item={item} slotsRef={slotsRef} iconVisible={iconVisible} />
            ))}
          </SocialColumn>
        </div>
      </IntroContext.Provider>
    </section>
  )
}

type SocialColumnProps = {
  items?: SocialItem[]
  children?: ReactNode
  className?: string
  slotsRef: React.MutableRefObject<Map<string, HTMLElement | null>>
  iconVisible: 'visible' | 'hidden'
}

function SocialColumn({ items = [], children, className, slotsRef, iconVisible }: SocialColumnProps) {
  return (
    <div className={cn('space-y-2.5 p-4', className)}>
      {items.map((item) => (
        <SocialRow key={item.label} item={item} slotsRef={slotsRef} iconVisible={iconVisible} />
      ))}
      {children}
    </div>
  )
}

function LocalTimeRow({ slotsRef, iconVisible }: { slotsRef: SocialColumnProps['slotsRef']; iconVisible: 'visible' | 'hidden' }) {
  const { phase, typeDelayFor } = useIntro()
  const reveal = phase === 'done'

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
      <span
        ref={(el) => {
          slotsRef.current.set('time', el)
        }}
        style={{ visibility: iconVisible }}
        className="flex size-6 shrink-0 items-center justify-center rounded-md border border-line bg-muted/40 text-muted-foreground shadow-inner"
      >
        <IconClock className="size-4" />
      </span>
      {!reveal ? (
        <span className="font-mono text-xs sm:text-sm">&nbsp;</span>
      ) : (
        <span className="min-w-0 truncate font-mono text-xs text-foreground sm:text-sm">
          <TypedText
            text={`${formatOwnerTime(now)} // ${formatTimeDifference(now, viewerTimeZone)}`}
            delayMs={typeDelayFor('time')}
          />
        </span>
      )}
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
  slotsRef: React.MutableRefObject<Map<string, HTMLElement | null>>
  iconVisible: 'visible' | 'hidden'
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

function EmailRow({ item, slotsRef, iconVisible }: SocialRowProps) {
  const { phase, typeDelayFor } = useIntro()
  const reveal = phase === 'done'
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
      <span
        ref={(el) => {
          slotsRef.current.set('Email', el)
        }}
        style={{ visibility: iconVisible }}
        className="flex size-6 shrink-0 items-center justify-center rounded-md border border-line bg-muted/40 text-muted-foreground shadow-inner"
      >
        <Icon className="size-4" />
      </span>
      {!reveal ? (
        <span className="font-mono text-xs sm:text-sm">&nbsp;</span>
      ) : (
        <span className="flex items-center gap-2 min-w-0 truncate font-mono text-xs text-foreground sm:text-sm">
          <TypedText
            text="kritiraj.tech@gmail.com"
            delayMs={typeDelayFor('Email')}
            className="border-b border-transparent transition-colors hover:border-foreground"
          />
          <CopyButton
            copied={copied}
            onCopy={handleCopy}
            popDelayMs={typeDelayFor('Email') + 'kritiraj.tech@gmail.com'.length * TYPE_SPEED_MS + 200}
          />
        </span>
      )}
    </a>
  )
}

function CopyButton({ copied, onCopy, popDelayMs }: { copied: boolean; onCopy: React.MouseEventHandler; popDelayMs: number }) {
  const [popped, setPopped] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setPopped(true), popDelayMs)
    return () => window.clearTimeout(timer)
  }, [popDelayMs])

  if (!popped) return null

  return (
    <motion.button
      type="button"
      onClick={onCopy}
      disabled={copied}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 520, damping: 24 }}
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
    </motion.button>
  )
}

function SocialRow({ item, slotsRef, iconVisible }: SocialRowProps) {
  const { phase, typeDelayFor } = useIntro()

  if (item.label === 'Email' && item.href) {
    return <EmailRow item={item} slotsRef={slotsRef} iconVisible={iconVisible} />
  }

  const reveal = phase === 'done'
  const Icon = item.icon

  const content = (
    <>
      <span
        ref={(el) => {
          slotsRef.current.set(item.label, el)
        }}
        style={{ visibility: iconVisible }}
        className="flex size-6 shrink-0 items-center justify-center rounded-md border border-line bg-muted/40 text-muted-foreground shadow-inner"
      >
        <Icon className="size-4" />
      </span>
      {!reveal ? (
        <span className="font-mono text-xs sm:text-sm">&nbsp;</span>
      ) : (
        <TypedSocialLabel label={item.label} delayMs={typeDelayFor(item.label)} />
      )}
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

function TypedSocialLabel({ label, delayMs }: { label: string; delayMs: number }) {
  const { typed, done } = useTypedText(label, delayMs)

  if (!done) {
    return (
      <span className="min-w-0 truncate font-mono text-xs text-foreground sm:text-sm">
        {typed}
        <span className="ml-0.5 inline-block w-[2px] animate-pulse self-stretch bg-foreground align-middle" />
      </span>
    )
  }

  return <SocialLabel label={label} />
}

export { InfoSection }
