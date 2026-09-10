import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

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
import { portfolio } from '@/config/portfolio'

import archLogo from '@/assets/archlinux-icon-crystal-32.svg'

import { cn } from '@/lib/utils'

type SocialItem = {
  label: string
  icon: Icon
  href?: string
}

const PROFILE_ITEMS: SocialItem[] = [
  {
    label: portfolio.profile.occupation,
    icon: IconCode,
  },
  {
    label: portfolio.profile.location.label,
    icon: IconMapPin,
  },
  {
    label: portfolio.profile.note.label,
    icon: IconHeart,
  },
]

const SOCIAL_ITEMS: SocialItem[] = [
  {
    label: portfolio.links.email.label,
    href: portfolio.links.email.href,
    icon: IconMail,
  },
  {
    label: portfolio.profile.pronouns,
    icon: IconGenderMale,
  },
]

// ─── Intro choreography ──────────────────────────────────────────────────────

type IntroPhase = 'line' | 'travel' | 'done'

const LINE_AT_S = 0.9
const TRAVEL_AT_S = 1.9
const DONE_AT_S = 3.0
const TYPE_FIRST_S = 0.2
const TYPE_ROW_STAGGER_S = 0.15
const TYPE_SPEED_MS = 22
const BIG_SIZE = 64
const SMALL_SIZE = 24
const BIG_GLYPH = 36
const SMALL_GLYPH = 16
const BIG_RADIUS = 12
const SMALL_RADIUS = 6

const LINE_ICONS: { icon: Icon; key: string }[] = [
  { icon: IconCode, key: portfolio.profile.occupation },
  { icon: IconClock, key: 'time' },
  { icon: IconMapPin, key: portfolio.profile.location.label },
  { icon: IconMail, key: portfolio.links.email.label },
  { icon: IconHeart, key: portfolio.profile.note.label },
  { icon: IconGenderMale, key: portfolio.profile.pronouns },
]

const ROW_KEYS = [
  portfolio.profile.occupation,
  portfolio.profile.location.label,
  portfolio.profile.note.label,
  'time',
  portfolio.links.email.label,
  portfolio.profile.pronouns,
] as const

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
  const reduced = useReducedMotion() ?? false
  const [typed, setTyped] = useState(reduced ? text : '')
  const [done, setDone] = useState(reduced)

  useEffect(() => {
    if (reduced) return

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
  }, [text, delayMs, reduced])

  return reduced ? { typed: text, done: true } : { typed, done }
}

function TypedText({ text, delayMs, className }: { text: string; delayMs: number; className?: string }) {
  const { typed, done } = useTypedText(text, delayMs)
  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {typed}
        {!done && <span className="ml-0.5 inline-block w-[2px] animate-pulse self-stretch bg-foreground align-middle" />}
      </span>
    </span>
  )
}

function SemanticPlaceholder({ text }: { text: string }) {
  return (
    <span className="font-mono text-xs sm:text-sm">
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">&nbsp;</span>
    </span>
  )
}

type IconIntroOverlayProps = {
  phase: IntroPhase
  slotsRef: React.MutableRefObject<Map<string, HTMLElement | null>>
}

function IconIntroOverlay({ phase, slotsRef }: IconIntroOverlayProps) {
  const sectionRef = useRef<HTMLDivElement | null>(null)

  const [metrics, setMetrics] = useState<{
    w: number
    h: number
    targets: Record<string, RowSlotMeasure>
  } | null>(null)

  useEffect(() => {
    if (phase === 'done') return
    const el = sectionRef.current
    if (!el) return
    const measure = () => {
      const sectionRect = el.getBoundingClientRect()
      const targets: Record<string, RowSlotMeasure> = {}
      slotsRef.current.forEach((slot, key) => {
        if (!slot) return
        const slotRect = slot.getBoundingClientRect()
        targets[key] = {
          x: slotRect.left - sectionRect.left + slotRect.width / 2,
          y: slotRect.top - sectionRect.top + slotRect.height / 2,
        }
      })
      const next = { w: el.offsetWidth, h: el.offsetHeight, targets }
      setMetrics((prev) =>
        prev &&
        prev.w === next.w &&
        prev.h === next.h &&
        JSON.stringify(prev.targets) === JSON.stringify(next.targets)
          ? prev
          : next
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    slotsRef.current.forEach((slot) => {
      if (slot) observer.observe(slot)
    })
    return () => {
      observer.disconnect()
    }
  }, [phase, slotsRef])

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

  return (
    <div
      ref={sectionRef}
      className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
      aria-hidden="true"
    >
      {metrics &&
        w > 0 &&
        h > 0 &&
        LINE_ICONS.map(({ icon: Icon, key }, i) => {
          const { row, col, cols } = layout[i]
          const lineX = (w - (cols - 1) * spacing) / 2 + col * spacing
          const lineY = canFitOneLine ? centerY : centerY + (row - 0.5) * rowSpacing
          const target = phase === 'travel' ? metrics.targets[key] : null
          const travelTransition = {
            duration: 0.62,
            ease: [0.23, 1, 0.32, 1] as const,
            delay: i * 0.07,
            rotate: { times: [0, 0.4, 1], duration: 0.62, delay: i * 0.07, ease: 'easeInOut' as const },
          }
          return (
            <motion.div
              key={key}
              className="pointer-events-none absolute flex items-center justify-center border border-line bg-muted/40 text-muted-foreground shadow-inner"
              style={{ width: BIG_SIZE, height: BIG_SIZE, left: lineX - BIG_SIZE / 2, top: lineY - BIG_SIZE / 2 }}
              initial={{ left: w / 2 - BIG_SIZE / 2, top: h / 2 - BIG_SIZE / 2, opacity: 0, scale: 0.4 }}
              animate={
                target
                  ? {
                      left: target.x - SMALL_SIZE / 2,
                      top: target.y - SMALL_SIZE / 2,
                      width: SMALL_SIZE,
                      height: SMALL_SIZE,
                      borderRadius: SMALL_RADIUS,
                      opacity: 1,
                      scale: 1,
                      rotate: [0, (i % 2 === 0 ? -1 : 1) * 8, 0],
                    }
                  : {
                      left: lineX - BIG_SIZE / 2,
                      top: lineY - BIG_SIZE / 2,
                      width: BIG_SIZE,
                      height: BIG_SIZE,
                      borderRadius: BIG_RADIUS,
                      opacity: 1,
                      scale: 1,
                      rotate: 0,
                    }
              }
              transition={target ? travelTransition : { type: 'spring', stiffness: 480, damping: 26, delay: LINE_AT_S + i * 0.06 }}
            >
              <motion.span
                className="flex"
                style={{ width: BIG_GLYPH, height: BIG_GLYPH }}
                animate={
                  target
                    ? { width: SMALL_GLYPH, height: SMALL_GLYPH }
                    : { width: BIG_GLYPH, height: BIG_GLYPH }
                }
                transition={target ? travelTransition : { duration: 0 }}
              >
                <Icon className="size-full" />
              </motion.span>
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
    if (reduced) {
      setPhase('done')
      return
    }
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

// Split-flap style reveal: when `text` changes, only the characters that
// differ flip in place (old one rotates out, new one rotates in).
function FlipText({ text }: { text: string }) {
  const reduced = useReducedMotion() ?? false

  if (reduced) {
    return <span className="whitespace-pre">{text}</span>
  }

  return (
    <span className="inline-block whitespace-pre">
      {Array.from(text).map((char, index) => (
        <span
          key={index}
          className="relative inline-block w-[1ch]"
          aria-hidden="true"
        >
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={`${index}-${char}`}
              className="inline-block will-change-transform"
              style={{ transformPerspective: 300 }}
              initial={{ rotateX: -90, opacity: 0 }}
              animate={{ rotateX: 0, opacity: 1 }}
              exit={{ rotateX: 90, opacity: 0 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
            >
              {char}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
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

  const timeText = `${formatOwnerTime(now)} // ${formatTimeDifference(now, viewerTimeZone)}`
  // Frozen at reveal so the intro typing doesn't restart on every timer tick.
  const [typedTimeText] = useState(timeText)

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
        <LocalTimeText
          typedText={typedTimeText}
          text={timeText}
          delayMs={typeDelayFor('time')}
        />
      )}
    </div>
  )
}

function LocalTimeText({ typedText, text, delayMs }: { typedText: string; text: string; delayMs: number }) {
  const { typed, done } = useTypedText(typedText, delayMs)

  return (
    <span className="min-w-0 truncate font-mono text-xs text-foreground sm:text-sm">
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {done ? (
          <FlipText text={text} />
        ) : (
          <>
            {typed}
            <span className="ml-0.5 inline-block w-[2px] animate-pulse self-stretch bg-foreground align-middle" />
          </>
        )}
      </span>
    </span>
  )
}

function formatOwnerTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: portfolio.profile.location.timeZone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatTimeDifference(date: Date, viewerTimeZone: string): string {
  const difference = getTimeZoneOffset(date, portfolio.profile.location.timeZone) - getTimeZoneOffset(date, viewerTimeZone)

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

function ArchLabel({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block border-b border-transparent leading-none transition-opacity duration-200 delay-[1200ms] group-hover:opacity-0 group-hover:delay-0">
      {children}
    </span>
  )
}

function SocialLabel({ label }: { label: string }) {
  if (label === portfolio.profile.location.label) {
    return (
      <span className="min-w-0 truncate cursor-pointer font-mono text-xs text-foreground sm:text-sm">
        <span className="inline-block border-b border-transparent leading-none hover:border-foreground">{label}</span>
      </span>
    )
  }

  if (label === portfolio.profile.note.label) {
    const [beforeHighlight, afterHighlight = ''] = label.split(portfolio.profile.note.highlight)

    return (
      <span className="relative min-w-0 font-mono text-xs text-foreground sm:text-sm">
        {beforeHighlight}
        <span className="group relative inline-block cursor-pointer align-baseline">
          <ArchLabel>{portfolio.profile.note.highlight}</ArchLabel>
          <img
            src={archLogo}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 h-[1.6em] w-auto max-w-none -translate-x-1/2 -translate-y-1/2 opacity-0 blur-lg transition-[opacity,filter] duration-300 delay-900 group-hover:opacity-100 group-hover:blur-none group-hover:delay-0"
          />
        </span>
        {afterHighlight}
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
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'success' | 'error'>('idle')
  const Icon = item.icon
  const href = item.href ?? ''
  const email = portfolio.links.email
  const copied = copyStatus === 'success'

  useEffect(() => {
    if (copyStatus !== 'success' && copyStatus !== 'error') return
    const timer = window.setTimeout(() => setCopyStatus('idle'), 2000)
    return () => window.clearTimeout(timer)
  }, [copyStatus])

  const handleCopy = async () => {
    if (copyStatus === 'copying' || copied) return

    setCopyStatus('copying')
    try {
      if (!navigator.clipboard) throw new Error('Clipboard API is unavailable')
      await navigator.clipboard.writeText(email.address)
      setCopyStatus('success')
    } catch {
      setCopyStatus('error')
    }
  }

  return (
    <div className="flex items-center gap-3">
      <span
        ref={(el) => {
          slotsRef.current.set(email.label, el)
        }}
        style={{ visibility: iconVisible }}
        className="flex size-6 shrink-0 items-center justify-center rounded-md border border-line bg-muted/40 text-muted-foreground shadow-inner"
      >
        <Icon className="size-4" />
      </span>
      <span className="flex min-w-0 items-center gap-2 truncate font-mono text-xs text-foreground sm:text-sm">
        <a
          href={href}
          target={href.startsWith('http') ? '_blank' : undefined}
          rel={href.startsWith('http') ? 'noreferrer' : undefined}
          className="min-w-0 truncate transition-colors hover:text-muted-foreground"
        >
          {!reveal ? (
            <SemanticPlaceholder text={email.address} />
          ) : (
            <TypedText
              text={email.address}
              delayMs={typeDelayFor(email.label)}
              className="border-b border-transparent transition-colors hover:border-foreground"
            />
          )}
        </a>
        {reveal && (
          <CopyButton
            copied={copied}
            copying={copyStatus === 'copying'}
            onCopy={handleCopy}
            popDelayMs={typeDelayFor(email.label) + email.address.length * TYPE_SPEED_MS + 200}
          />
        )}
        <span className="sr-only" role="status" aria-live="polite">
          {copyStatus === 'success'
            ? 'Email address copied to clipboard.'
            : copyStatus === 'error'
              ? 'Unable to copy the email address.'
              : ''}
        </span>
      </span>
    </div>
  )
}

function CopyButton({
  copied,
  copying,
  onCopy,
  popDelayMs,
}: {
  copied: boolean
  copying: boolean
  onCopy: () => Promise<void>
  popDelayMs: number
}) {
  const prefersReducedMotion = useReducedMotion() ?? false
  const [popped, setPopped] = useState(prefersReducedMotion)

  useEffect(() => {
    if (prefersReducedMotion) return
    const timer = window.setTimeout(() => setPopped(true), popDelayMs)
    return () => window.clearTimeout(timer)
  }, [popDelayMs, prefersReducedMotion])

  if (!popped) return null

  return (
    <motion.button
      type="button"
      onClick={() => void onCopy()}
      disabled={copied || copying}
      initial={prefersReducedMotion ? false : { scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={
        prefersReducedMotion
          ? { duration: 0 }
          : { type: 'spring', stiffness: 520, damping: 24 }
      }
      className="flex size-5 shrink-0 items-center justify-center rounded border border-line bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:cursor-default disabled:hover:bg-muted/40 active:scale-90"
      aria-label={copied ? 'Email copied' : copying ? 'Copying email' : 'Copy email address'}
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

  if (item.label === portfolio.links.email.label && item.href) {
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
        <SemanticPlaceholder text={item.label} />
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
        <span className="sr-only">{label}</span>
        <span aria-hidden="true">
          {typed}
          <span className="ml-0.5 inline-block w-[2px] animate-pulse self-stretch bg-foreground align-middle" />
        </span>
      </span>
    )
  }

  return <SocialLabel label={label} />
}

export { InfoSection }
