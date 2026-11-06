import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { FaXTwitter } from 'react-icons/fa6'
import { FiCheck, FiGithub, FiMail } from 'react-icons/fi'

import { Tooltip } from '@/components/tooltip'
import { portfolioOwner, socialLinks } from '@/data'
import { EASE_OUT, SPRING_SWAP } from '@/lib/ease'

const socialIcons = {
  x: FaXTwitter,
  github: FiGithub,
} as const

export function SocialLinks() {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const copyStatusTimeout = useRef<number | null>(null)
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

  function clearCopyStatusTimeout() {
    if (copyStatusTimeout.current === null) return
    window.clearTimeout(copyStatusTimeout.current)
    copyStatusTimeout.current = null
  }

  useEffect(() => () => {
    if (copyStatusTimeout.current !== null) window.clearTimeout(copyStatusTimeout.current)
  }, [])

  async function copyEmail() {
    clearCopyStatusTimeout()

    try {
      await navigator.clipboard.writeText(portfolioOwner.email)
      setCopyStatus('copied')
      copyStatusTimeout.current = window.setTimeout(() => {
        copyStatusTimeout.current = null
        setCopyStatus('idle')
      }, 1500)
    } catch {
      clearCopyStatusTimeout()
      setCopyStatus('error')
    }
  }

  const emailTooltip = copyStatus === 'copied'
    ? 'Copied to clipboard'
    : copyStatus === 'error'
      ? 'Could not copy email'
      : 'Click to copy email'

  const labelContent = copyStatus === 'copied' ? (
    <span className="text-foreground">Copied<span className="hidden sm:inline"> to clipboard</span></span>
  ) : (
    <>
      <span className="sm:hidden">Email</span>
      <span className="hidden sm:inline">{portfolioOwner.email}</span>
    </>
  )

  const emailLabel = copyStatus === 'copied'
    ? 'Email copied to clipboard'
    : copyStatus === 'error'
      ? 'Retry copying email address'
      : 'Copy email address'
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
  // The check pops in with a small twist; the envelope shrinks away.
  const copyIconInitial = reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.5, rotate: -20 }
  const copyIconAnimate = reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, rotate: 0 }
  const copyIconExit = reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.5, rotate: 20 }
  const copyMotionTransition = reducedMotion ? { duration: 0.12, ease: EASE_OUT } : SPRING_SWAP

  return (
    <nav aria-label="Social links and contact information" className="mt-5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
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
      {/* While the pill says "Copied", the tooltip steps aside instead of repeating it. */}
      <Tooltip content={emailTooltip} side="top" disabled={copyStatus === 'copied'}>
        <button
          aria-label={emailLabel}
          className="email-trigger inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 leading-none font-medium text-muted-foreground press hover:bg-muted hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={copyEmail}
          type="button"
        >
          <span aria-hidden="true" className="relative size-4 shrink-0">
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                key={copyStatus === 'copied' ? 'copied-icon' : 'email-icon'}
                animate={copyIconAnimate}
                className="absolute inset-0 flex items-center justify-center"
                exit={copyIconExit}
                initial={copyIconInitial}
                transition={copyMotionTransition}
              >
                {copyStatus === 'copied' ? (
                  <FiCheck className="size-4 text-green-600 dark:text-green-400" />
                ) : (
                  <FiMail className="size-4" />
                )}
              </motion.span>
            </AnimatePresence>
          </span>
          <span ref={labelMeasureRef} aria-hidden="true" className="invisible absolute whitespace-nowrap">
            {labelContent}
          </span>
          <motion.span
            className="inline-grid min-w-[2.875rem] place-items-center overflow-hidden sm:place-items-start"
            initial={false}
            animate={labelWidth === null ? undefined : { width: labelWidth }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.24, ease: EASE_OUT }}
          >
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                key={copyStatus === 'copied' ? 'copied-label' : 'email-label'}
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
        </button>
      </Tooltip>
      <AnimatePresence initial={false}>
        {copyStatus === 'error' && (
          <motion.a
            className="max-w-full break-all text-foreground underline underline-offset-4"
            href={`mailto:${portfolioOwner.email}`}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, x: -4 }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
          >
            {portfolioOwner.email}
          </motion.a>
        )}
      </AnimatePresence>
      <span aria-live="polite" className="sr-only">
        {copyStatus === 'copied' ? 'Email address copied to clipboard.' : copyStatus === 'error' ? 'Could not copy email address. Use the email link to open your mail app.' : ''}
      </span>
    </nav>
  )
}
