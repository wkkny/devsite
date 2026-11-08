import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type MouseEvent } from 'react'
import { Menu } from '@base-ui/react/menu'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { FaXTwitter } from 'react-icons/fa6'
import { FiArrowUpRight, FiCheck, FiChevronDown, FiGithub, FiMail } from 'react-icons/fi'
import { PiMicrosoftOutlookLogoBold } from 'react-icons/pi'
import { TbBrandGmail, TbCopy, TbInbox } from 'react-icons/tb'

import { MailFlight } from '@/components/portfolio/mail-flight'
import { Tooltip, TooltipGroup } from '@/components/tooltip'
import { portfolioOwner, socialLinks } from '@/data'
import { EASE_OUT, SPRING_SWAP } from '@/lib/ease'

const socialIcons = {
  x: FaXTwitter,
  github: FiGithub,
} as const

const emailTo = encodeURIComponent(portfolioOwner.email)
// A subject that says where the email came from, so it stands out in an inbox and is easy to find
// later. No body: the visitor knows what they want to say, and Gmail would put the cursor before
// any text we prefilled.
const emailSubject = encodeURIComponent('Reaching out via your portfolio')

// No browser API says which mail app a visitor uses, so they pick. The webmail links are
// undocumented compose URLs; the mail app is whatever the visitor's system handles mailto with.
const mailClients = [
  {
    id: 'gmail',
    label: 'Gmail',
    opened: 'Opened Gmail',
    Icon: TbBrandGmail,
    // tf=cm is what opens the compose view now; view=cm is the older spelling.
    href: `https://mail.google.com/mail/?fs=1&to=${emailTo}&su=${emailSubject}&tf=cm`,
  },
  {
    id: 'outlook',
    label: 'Outlook',
    opened: 'Opened Outlook',
    // Phosphor's bold weight, since Tabler has no Outlook and its regular reads thinner.
    Icon: PiMicrosoftOutlookLogoBold,
    href: `https://outlook.office.com/mail/deeplink/compose?to=${emailTo}&subject=${emailSubject}`,
  },
  {
    id: 'mailto',
    label: 'Mail app',
    // Nothing reports whether a mail app answered, so this one only says it is trying.
    opened: 'Opening app',
    Icon: TbInbox,
    href: `mailto:${portfolioOwner.email}?subject=${emailSubject}`,
  },
] as const

type MailClient = (typeof mailClients)[number]

const mailApp = mailClients.find((client) => client.id === 'mailto')!

// Phones and tablets: no hover, and a finger for a pointer. Webmail compose links don't open a
// compose window in mobile browsers, so there the menu offers only the device's own mail app.
const TOUCH_QUERY = '(hover: none) and (pointer: coarse)'

function subscribeToTouch(onChange: () => void) {
  const query = window.matchMedia(TOUCH_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function useTouchDevice() {
  return useSyncExternalStore(subscribeToTouch, () => window.matchMedia(TOUCH_QUERY).matches, () => false)
}

type Feedback =
  | { kind: 'idle' }
  | { kind: 'error' }
  | { kind: 'copied' }
  | { kind: 'opened'; client: MailClient }
  | { kind: 'no-mail-app' }

// How long the browser has to give way to a mail app before we suspect none answered the mailto.
// Chrome and Firefox may first ask in-page whether to open it, which doesn't blur the page, so
// the result is offered as a question with a way out, and withdrawn if the app opens after all.
const MAIL_APP_GRACE_MS = 2500

const MENU_LABEL = 'truncate px-2 pt-1.5 pb-1 font-mono text-[11px] text-muted-foreground'
const MENU_ITEM = 'flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-sm font-medium text-muted-foreground outline-none select-none pointer-coarse:h-10 data-highlighted:bg-muted data-highlighted:text-foreground'

export function SocialLinks() {
  const [feedback, setFeedback] = useState<Feedback>({ kind: 'idle' })
  // Counts each copy or send, so doing it again re-pops the icon and is announced again.
  const [feedbackCount, setFeedbackCount] = useState(0)
  // The client the envelope is flying off to acknowledge, while it flies. The ref lets a landing
  // tell whether a newer action has already replaced its flight.
  const [flight, setFlight] = useState<MailClient | null>(null)
  const flightRef = useRef<MailClient | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  // What the pill is showing, for handlers that outlive the render they came from.
  const feedbackKind = useRef<Feedback['kind']>('idle')
  useEffect(() => {
    feedbackKind.current = feedback.kind
  })
  // Whether the visitor is pointing at or focused on the copy offer, which holds it open.
  const offerHeld = useRef({ hover: false, focus: false })
  const [announcement, setAnnouncement] = useState('')
  const stopFeedbackTimer = useRef<(() => void) | null>(null)
  const stopMailAppCheck = useRef<(() => void) | null>(null)
  // The pill eases to the width of whichever label is showing, measured off a hidden copy.
  const labelMeasureRef = useRef<HTMLSpanElement>(null)
  const [labelWidth, setLabelWidth] = useState<number | null>(null)
  useLayoutEffect(() => {
    const measure = labelMeasureRef.current
    if (!measure) return
    const observer = new ResizeObserver(() => setLabelWidth(measure.offsetWidth))
    observer.observe(measure)
    return () => observer.disconnect()
  }, [])
  const reducedMotion = useReducedMotion()
  const touchDevice = useTouchDevice()

  function clearFeedbackTimeout() {
    stopFeedbackTimer.current?.()
    stopFeedbackTimer.current = null
  }

  function setFlightClient(client: MailClient | null) {
    flightRef.current = client
    setFlight(client)
  }

  // Every new action starts clean: no earlier flight landing on it, no earlier check reporting.
  function cancelPending() {
    clearFeedbackTimeout()
    setFlightClient(null)
    stopMailAppCheck.current?.()
  }

  useEffect(() => () => {
    stopFeedbackTimer.current?.()
    stopMailAppCheck.current?.()
  }, [])

  function showFeedback(next: Feedback, message: string, duration = 1800) {
    clearFeedbackTimeout()
    setFeedback(next)
    setFeedbackCount((count) => count + 1)
    // Clear, then set on the next frame, so a repeat is announced instead of ignored.
    setAnnouncement('')
    requestAnimationFrame(() => setAnnouncement(message))
    startFeedbackTimer(duration)
  }

  // The result stays up for `duration` of the visitor actually looking at it: one sent off to a
  // webmail tab waits for them to come back before it starts to count down.
  function startFeedbackTimer(duration: number) {
    clearFeedbackTimeout()
    if (document.hidden || !document.hasFocus()) {
      const resume = () => {
        if (document.hidden) return
        stopWaitingForReturn()
        startFeedbackTimer(duration)
      }
      const stopWaitingForReturn = () => {
        window.removeEventListener('focus', resume)
        document.removeEventListener('visibilitychange', resume)
      }
      window.addEventListener('focus', resume)
      document.addEventListener('visibilitychange', resume)
      stopFeedbackTimer.current = stopWaitingForReturn
      return
    }
    const timeout = window.setTimeout(() => {
      stopFeedbackTimer.current = null
      setFeedback({ kind: 'idle' })
    }, duration)
    stopFeedbackTimer.current = () => window.clearTimeout(timeout)
  }

  async function copyEmail() {
    cancelPending()
    try {
      await navigator.clipboard.writeText(portfolioOwner.email)
      showFeedback({ kind: 'copied' }, 'Email address copied to clipboard.')
    } catch {
      setFeedback({ kind: 'error' })
      setAnnouncement('Could not copy email address. Use the email link to open your mail app.')
    }
  }

  // A mail app taking over blurs or hides the page. If neither happens in time, offer the copy
  // instead of claiming something opened; if the app turns up late, take the offer back.
  function watchForMailApp() {
    let answered = false
    let offered = false
    const onLeave = () => {
      answered = true
      if (!offered) return
      stop()
      clearFeedbackTimeout()
      setFeedback({ kind: 'idle' })
    }
    const timeout = window.setTimeout(() => {
      if (answered) {
        stop()
        return
      }
      offered = true
      offerHeld.current = { hover: false, focus: false }
      showFeedback({ kind: 'no-mail-app' }, 'Did your mail app open? If not, copy the address instead.', 6000)
    }, MAIL_APP_GRACE_MS)
    function stop() {
      window.clearTimeout(timeout)
      window.removeEventListener('blur', onLeave)
      document.removeEventListener('visibilitychange', onLeave)
      stopMailAppCheck.current = null
    }
    window.addEventListener('blur', onLeave)
    document.addEventListener('visibilitychange', onLeave)
    stopMailAppCheck.current = stop
  }

  // The link itself opens the client, straight from the click; this only acknowledges it. The
  // label waits for the envelope to leave, so it doesn't grow underneath the flight.
  function acknowledgeSend(client: MailClient) {
    cancelPending()
    if (client.id === 'mailto') watchForMailApp()
    if (reducedMotion) {
      showFeedback({ kind: 'opened', client }, `${client.opened}.`)
      return
    }
    setFeedback({ kind: 'idle' })
    setFlightClient(client)
  }

  // The offer never times out from under someone using it; once they move on, it gives them a
  // few more seconds.
  function holdOffer(key: 'hover' | 'focus', held: boolean) {
    if (feedbackKind.current !== 'no-mail-app') return
    offerHeld.current[key] = held
    if (offerHeld.current.hover || offerHeld.current.focus) clearFeedbackTimeout()
    else startFeedbackTimer(3000)
  }

  // The offer's button is about to go, so keyboard focus moves to the pill instead of the page.
  function copyFromOffer(event: MouseEvent<HTMLButtonElement>) {
    if (event.currentTarget === document.activeElement) triggerRef.current?.focus()
    void copyEmail()
  }

  function landFlight() {
    const client = flightRef.current
    if (!client) return
    setFlightClient(null)
    showFeedback({ kind: 'opened', client }, `${client.opened}.`)
  }

  // A webmail tab takes focus straight away, and the page's animation frames stop with it. Land
  // the flight there and then, so a visitor coming back finds it settled, not still to play.
  useEffect(() => {
    if (!flight) return
    const land = () => landFlight()
    window.addEventListener('blur', land)
    document.addEventListener('visibilitychange', land)
    return () => {
      window.removeEventListener('blur', land)
      document.removeEventListener('visibilitychange', land)
    }
  })

  // Real links, so the client opens straight from the click and no pop-up blocker objects.
  function renderClientLink(client: MailClient, label: string) {
    return (
      <Menu.LinkItem
        key={client.id}
        className={MENU_ITEM}
        closeOnClick
        href={client.href}
        onClick={() => acknowledgeSend(client)}
        {...(client.id === 'mailto' ? {} : { target: '_blank', rel: 'noreferrer' })}
      >
        <client.Icon aria-hidden="true" className="size-4" />
        {label}
      </Menu.LinkItem>
    )
  }

  // The pill only says "Email"; the tooltip gives the address itself.
  const emailTooltip = feedback.kind === 'error' ? 'Could not copy email' : portfolioOwner.email
  // Results the pill reports itself. The pill stays "Email" for the rest, whose notes sit beside it.
  const showingFeedback = feedback.kind === 'copied' || feedback.kind === 'opened'

  // The visible label is also the button's accessible name, so the two never disagree.
  const labelContent = feedback.kind === 'opened' ? (
    <span className="text-foreground">{feedback.client.opened}</span>
  ) : feedback.kind === 'copied' ? (
    <span className="text-foreground">Copied</span>
  ) : (
    'Email'
  )

  const labelKey = feedback.kind === 'opened'
    ? `opened-${feedback.client.id}`
    : showingFeedback ? `${feedback.kind}-label` : 'email-label'
  const iconKey = showingFeedback ? `${feedback.kind}-icon-${feedbackCount}` : 'chevron'
  // The label rolls: the old text lifts away, the new one rises from just below under a soft blur.
  const copyMotionInitial = reducedMotion
    ? { opacity: 0 }
    : { opacity: 0, y: 6, filter: 'blur(2px)' }
  const copyMotionAnimate = reducedMotion
    ? { opacity: 1 }
    : { opacity: 1, y: 0, filter: 'blur(0px)' }
  const copyMotionExit = reducedMotion
    ? { opacity: 0 }
    : { opacity: 0, y: -6, filter: 'blur(2px)' }
  // The new icon pops in with a small twist; the old one shrinks away. When the envelope takes
  // off, the flying copy replaces it at once instead.
  const copyIconInitial = reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.5, rotate: -20 }
  const copyIconAnimate = reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, rotate: 0 }
  const copyIconExit = reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.5, rotate: 20 }
  const copyIconVariants = {
    entering: copyIconInitial,
    shown: copyIconAnimate,
    hidden: (launching: boolean) => (launching ? { opacity: 0, transition: { duration: 0 } } : copyIconExit),
  }
  const copyMotionTransition = reducedMotion ? { duration: 0.12, ease: EASE_OUT } : SPRING_SWAP

  return (
    <nav aria-label="Social links and contact information" className="mt-5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      <TooltipGroup side="top">
      {socialLinks.map((link) => {
        const Icon = socialIcons[link.platform]

        return (
          <Tooltip key={link.platform} content={link.label}>
            <a
              aria-label={'ariaLabel' in link ? link.ariaLabel : undefined}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 font-medium press hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              href={link.href}
              target="_blank"
              rel="noreferrer"
            >
              {link.text}
              <Icon aria-hidden="true" />
            </a>
          </Tooltip>
        )
      })}
      <Menu.Root open={menuOpen} onOpenChange={setMenuOpen}>
      {/* The pill and any note about it stay together when the row wraps. */}
      <span className="inline-flex max-w-full min-w-0 items-center gap-2">
      {/* While the pill speaks for itself, or the menu is open, the tooltip steps aside. */}
      <Tooltip content={emailTooltip} side="top" disabled={showingFeedback || flight !== null || menuOpen}>
        <Menu.Trigger
          ref={triggerRef}
          className="email-trigger group inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background pr-2 pl-2.5 leading-none font-medium text-muted-foreground press hover:bg-muted hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-expanded:bg-muted aria-expanded:text-foreground"
        >
          <span ref={labelMeasureRef} aria-hidden="true" className="invisible absolute whitespace-nowrap">
            {labelContent}
          </span>
          <motion.span
            className="inline-grid place-items-start overflow-hidden"
            initial={false}
            animate={labelWidth === null ? undefined : { width: labelWidth }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.24, ease: EASE_OUT }}
          >
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                key={labelKey}
                animate={copyMotionAnimate}
                className="col-start-1 row-start-1 whitespace-nowrap"
                exit={copyMotionExit}
                initial={copyMotionInitial}
                transition={copyMotionTransition}
              >
                {labelContent}
              </motion.span>
            </AnimatePresence>
          </motion.span>
          <span aria-hidden="true" className="relative size-4 shrink-0">
            {/* The envelope leaves for its flight and pops back once it has gone. */}
            <AnimatePresence custom={flight !== null} initial={false} mode="popLayout">
              {!flight && (
                <motion.span
                  key="email-icon"
                  animate="shown"
                  className="absolute inset-0 flex items-center justify-center"
                  exit="hidden"
                  initial="entering"
                  transition={copyMotionTransition}
                  variants={copyIconVariants}
                >
                  <FiMail className="size-4" />
                </motion.span>
              )}
            </AnimatePresence>
            {/* Launched from the slot itself, so the envelope never leaves a frame of empty pill. */}
            {flight && <MailFlight onComplete={landFlight} />}
          </span>
          {/* The end of the pill says what a press does next: the chevron while it opens a menu,
              turning over while the menu is open (driven by the menu's aria-expanded, since the
              tooltip marks the trigger open on hover too), and the result in its place while one
              shows: a tick once copied, an arrow once a client opened. */}
          <span aria-hidden="true" className="relative -ml-0.5 size-3.5 shrink-0">
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                key={iconKey}
                animate={copyIconAnimate}
                className="absolute inset-0 flex items-center justify-center"
                exit={copyIconExit}
                initial={copyIconInitial}
                transition={copyMotionTransition}
              >
                {feedback.kind === 'copied' ? (
                  <FiCheck className="size-3.5 text-green-600 dark:text-green-400" />
                ) : feedback.kind === 'opened' ? (
                  <FiArrowUpRight className="size-3.5 text-foreground" />
                ) : (
                  <FiChevronDown className="size-3 opacity-60 transition-[rotate] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-aria-expanded:rotate-180 motion-reduce:transition-none" />
                )}
              </motion.span>
            </AnimatePresence>
          </span>
        </Menu.Trigger>
      </Tooltip>
      {/* If the mail app may not have opened, the way out sits right beside the question. */}
      <AnimatePresence initial={false}>
        {feedback.kind === 'no-mail-app' && (
          <motion.span
            className="inline-flex items-center gap-1.5 whitespace-nowrap"
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, x: -4 }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            onBlur={() => holdOffer('focus', false)}
            onFocus={() => holdOffer('focus', true)}
            onPointerEnter={() => holdOffer('hover', true)}
            onPointerLeave={() => holdOffer('hover', false)}
            transition={{ duration: 0.2, ease: EASE_OUT }}
          >
            Didn't open?
            <button
              className="h-8 rounded-md px-1 font-medium text-foreground underline decoration-muted-foreground underline-offset-4 press hover:decoration-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={copyFromOffer}
              type="button"
            >
              Copy address
            </button>
          </motion.span>
        )}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {feedback.kind === 'error' && (
          <motion.a
            className="min-w-0 break-all text-foreground underline underline-offset-4"
            href={`mailto:${portfolioOwner.email}?subject=${emailSubject}`}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, x: -4 }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
          >
            {portfolioOwner.email}
          </motion.a>
        )}
      </AnimatePresence>
      </span>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="start" sideOffset={6} className="z-50 outline-none">
          {/* Focus goes back to the pill only for keyboard users, so a click leaves no ring behind. */}
          <Menu.Popup finalFocus={(closeType) => closeType === 'keyboard'} className="min-w-48 origin-(--transform-origin) rounded-lg border border-border bg-background p-1 shadow-lg outline-none transition-[opacity,scale,filter] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] data-ending-style:scale-95 data-ending-style:opacity-0 data-ending-style:blur-[2px] data-starting-style:scale-95 data-starting-style:opacity-0 data-starting-style:blur-[2px] motion-reduce:transition-none">
            <Menu.Group>
              <Menu.GroupLabel className={MENU_LABEL}>{portfolioOwner.email}</Menu.GroupLabel>
              <Menu.Item className={MENU_ITEM} onClick={copyEmail}>
                <TbCopy aria-hidden="true" className="size-4" />
                Copy address
              </Menu.Item>
              {/* On a phone the device's mail app is the only client, so it sits with the copy
                  rather than heading a group of one. */}
              {touchDevice && renderClientLink(mailApp, 'Open mail app')}
            </Menu.Group>
            {!touchDevice && (
              <>
                <Menu.Separator className="mx-1 my-1 h-px bg-border" />
                <Menu.Group>
                  <Menu.GroupLabel className={MENU_LABEL}>Open in</Menu.GroupLabel>
                  {mailClients.map((client) => renderClientLink(client, client.label))}
                </Menu.Group>
              </>
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
      </Menu.Root>
      </TooltipGroup>
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </nav>
  )
}
