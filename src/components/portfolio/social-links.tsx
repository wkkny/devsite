import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react'
import { Menu } from '@base-ui/react/menu'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { FaXTwitter } from 'react-icons/fa6'
import { FiArrowUpRight, FiCheck, FiChevronDown, FiGithub, FiMail } from 'react-icons/fi'
import { TbCopy } from 'react-icons/tb'

import { MailFlight } from '@/components/portfolio/mail-flight'
import { mailApp, mailClients, type MailClient } from '@/components/portfolio/mail-clients'
import { useEmailFeedback } from '@/components/portfolio/use-email-feedback'
import { Tooltip, TooltipGroup } from '@/components/tooltip'
import { portfolioOwner, socialLinks } from '@/data'
import { EASE_OUT, SPRING_SWAP } from '@/lib/ease'
import { useMediaQuery } from '@/lib/media'

const socialIcons = {
  x: FaXTwitter,
  github: FiGithub,
} as const

// Phones and tablets: no hover, and a finger for a pointer. Webmail compose links don't open a
// compose window in mobile browsers, so there the menu offers only the device's own mail app.
const TOUCH_QUERY = '(hover: none) and (pointer: coarse)'

const MENU_LABEL = 'truncate px-2 pt-1.5 pb-1 font-mono text-[11px] text-muted-foreground'
const MENU_ITEM = 'flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-sm font-medium text-muted-foreground outline-none select-none pointer-coarse:h-10 data-highlighted:bg-muted data-highlighted:text-foreground'

export function SocialLinks() {
  const { feedback, feedbackCount, announcement, show, showError, reset, cancel, watchForMailApp, holdOffer } =
    useEmailFeedback()
  // The client the envelope is flying off to acknowledge, while it flies. The ref lets a landing
  // tell whether a newer action has already replaced its flight.
  const [flight, setFlight] = useState<MailClient | null>(null)
  const flightRef = useRef<MailClient | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
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
  const touchDevice = useMediaQuery(TOUCH_QUERY)

  function setFlightClient(client: MailClient | null) {
    flightRef.current = client
    setFlight(client)
  }

  // Every new action starts clean: no earlier flight landing on it, no earlier result or check.
  function cancelPending() {
    cancel()
    setFlightClient(null)
  }

  async function copyEmail() {
    cancelPending()
    try {
      await navigator.clipboard.writeText(portfolioOwner.email)
      show({ kind: 'copied' }, 'Email address copied to clipboard.')
    } catch {
      showError('Could not copy email address. Use the email link to open your mail app.')
    }
  }

  // The link itself opens the client, straight from the click; this only acknowledges it. The
  // label waits for the envelope to leave, so it doesn't grow underneath the flight.
  function acknowledgeSend(client: MailClient) {
    cancelPending()
    if (client.id === 'mailto') watchForMailApp()
    if (reducedMotion) {
      show({ kind: 'opened', client }, `${client.opened}.`)
      return
    }
    reset()
    setFlightClient(client)
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
    show({ kind: 'opened', client }, `${client.opened}.`)
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
  // Results the pill reports itself: its label, and the icon at its end. The pill stays "Email"
  // for the rest, whose notes sit beside it.
  const pillResult =
    feedback.kind === 'copied'
      ? { id: 'copied', label: 'Copied', icon: <FiCheck className="size-3.5 text-green-600 dark:text-green-400" /> }
      : feedback.kind === 'opened'
        ? { id: `opened-${feedback.client.id}`, label: feedback.client.opened, icon: <FiArrowUpRight className="size-3.5 text-foreground" /> }
        : null
  const showingFeedback = pillResult !== null

  // The visible label is also the button's accessible name, so the two never disagree.
  const labelContent = pillResult ? <span className="text-foreground">{pillResult.label}</span> : 'Email'
  const labelKey = pillResult ? `${pillResult.id}-label` : 'email-label'
  const iconKey = pillResult ? `${pillResult.id}-icon-${feedbackCount}` : 'chevron'
  // The label rolls: the old text lifts away, the new one rises from just below under a soft blur.
  const labelInitial = reducedMotion
    ? { opacity: 0 }
    : { opacity: 0, y: 6, filter: 'blur(2px)' }
  const labelAnimate = reducedMotion
    ? { opacity: 1 }
    : { opacity: 1, y: 0, filter: 'blur(0px)' }
  const labelExit = reducedMotion
    ? { opacity: 0 }
    : { opacity: 0, y: -6, filter: 'blur(2px)' }
  // The new icon pops in with a small twist; the old one shrinks away. When the envelope takes
  // off, the flying copy replaces it at once instead.
  const iconInitial = reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.5, rotate: -20 }
  const iconAnimate = reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, rotate: 0 }
  const iconExit = reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.5, rotate: 20 }
  const mailIconVariants = {
    entering: iconInitial,
    shown: iconAnimate,
    hidden: (launching: boolean) => (launching ? { opacity: 0, transition: { duration: 0 } } : iconExit),
  }
  const swapTransition = reducedMotion ? { duration: 0.12, ease: EASE_OUT } : SPRING_SWAP
  // The notes beside the pill slide in from it.
  const noteMotion = {
    initial: reducedMotion ? { opacity: 0 } : { opacity: 0, x: -4 },
    animate: reducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 },
    exit: { opacity: 0 },
    transition: { duration: 0.2, ease: EASE_OUT },
  }

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
                animate={labelAnimate}
                className="col-start-1 row-start-1 whitespace-nowrap"
                exit={labelExit}
                initial={labelInitial}
                transition={swapTransition}
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
                  transition={swapTransition}
                  variants={mailIconVariants}
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
                animate={iconAnimate}
                className="absolute inset-0 flex items-center justify-center"
                exit={iconExit}
                initial={iconInitial}
                transition={swapTransition}
              >
                {pillResult?.icon ?? (
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
            {...noteMotion}
            className="inline-flex items-center gap-1.5 whitespace-nowrap"
            onBlur={() => holdOffer('focus', false)}
            onFocus={() => holdOffer('focus', true)}
            onPointerEnter={() => holdOffer('hover', true)}
            onPointerLeave={() => holdOffer('hover', false)}
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
            {...noteMotion}
            className="min-w-0 break-all text-foreground underline underline-offset-4"
            href={mailApp.href}
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
