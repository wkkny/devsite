import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { FaXTwitter } from 'react-icons/fa6'
import { FiCheck, FiGithub, FiMail } from 'react-icons/fi'

import { Tooltip } from '@/components/motion/tooltip'
import { portfolioOwner, socialLinks } from '@/data'
import { EASE_OUT, SPRING_SWAP } from '@/lib/ease'

const socialIcons = {
  x: FaXTwitter,
  github: FiGithub,
} as const

export function SocialLinks() {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const reducedMotion = useReducedMotion()

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(portfolioOwner.email)
      setCopyStatus('copied')
      window.setTimeout(() => setCopyStatus('idle'), 1500)
    } catch {
      setCopyStatus('error')
    }
  }

  const emailTooltip = copyStatus === 'copied'
    ? 'Copied to clipboard'
    : copyStatus === 'error'
      ? 'Could not copy email'
      : 'Click to copy email'

  const emailLabel = copyStatus === 'copied'
    ? 'Email copied to clipboard'
    : copyStatus === 'error'
      ? 'Retry copying email address'
      : 'Copy email address'
  const copyMotionInitial = reducedMotion
    ? { opacity: 0 }
    : { opacity: 0, transform: 'translate3d(0, 2px, 0) scale(0.95)' }
  const copyMotionAnimate = reducedMotion
    ? { opacity: 1 }
    : { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' }
  const copyMotionExit = reducedMotion
    ? { opacity: 0 }
    : { opacity: 0, transform: 'translate3d(0, -2px, 0) scale(0.95)' }
  const copyMotionTransition = reducedMotion ? { duration: 0.12, ease: EASE_OUT } : SPRING_SWAP

  return (
    <nav aria-label="Social links and contact information" className="mt-5 flex flex-wrap items-center gap-x-1 gap-y-2 text-sm text-muted-foreground sm:gap-x-4">
      {socialLinks.map((link) => {
        const Icon = socialIcons[link.platform]

        return (
          <Tooltip key={link.platform} content={link.label}>
            <a
              aria-label={'ariaLabel' in link ? link.ariaLabel : undefined}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 font-medium transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
      <Tooltip content={emailTooltip} side="top">
        <button
          aria-label={emailLabel}
          className="email-trigger inline-flex items-center gap-1.5 leading-none text-muted-foreground hover:text-foreground focus-visible:text-foreground max-sm:h-8 max-sm:rounded-lg max-sm:border max-sm:border-border max-sm:bg-background max-sm:px-2.5 max-sm:font-medium max-sm:transition-colors max-sm:hover:bg-muted max-sm:hover:text-foreground max-sm:focus-visible:outline-none max-sm:focus-visible:ring-2 max-sm:focus-visible:ring-ring"
          onClick={copyEmail}
          type="button"
        >
          <span aria-hidden="true" className="relative size-4 shrink-0 sm:hidden">
            <AnimatePresence initial={false} mode="wait">
              <motion.span
                key={copyStatus === 'copied' ? 'copied-icon' : 'email-icon'}
                animate={copyMotionAnimate}
                className="absolute inset-0 flex items-center justify-center"
                exit={copyMotionExit}
                initial={copyMotionInitial}
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
          <FiMail aria-hidden="true" className="hidden size-4 shrink-0 sm:inline-block" />
          <span className="inline-grid min-w-[2.875rem] place-items-center sm:hidden">
            <AnimatePresence initial={false} mode="wait">
              <motion.span
                key={copyStatus === 'copied' ? 'copied-label' : 'email-label'}
                animate={copyMotionAnimate}
                className="col-start-1 row-start-1 whitespace-nowrap"
                exit={copyMotionExit}
                initial={copyMotionInitial}
                transition={copyMotionTransition}
              >
                {copyStatus === 'copied' ? 'Copied' : 'Email'}
              </motion.span>
            </AnimatePresence>
          </span>
          <span className="hidden sm:inline">{portfolioOwner.email}</span>
        </button>
      </Tooltip>
      {copyStatus === 'error' && (
        <a
          className="max-w-full break-all text-foreground underline underline-offset-4 sm:hidden"
          href={`mailto:${portfolioOwner.email}`}
        >
          {portfolioOwner.email}
        </a>
      )}
      <span aria-live="polite" className="sr-only">
        {copyStatus === 'copied' ? 'Email address copied to clipboard.' : copyStatus === 'error' ? 'Could not copy email address. Use the email link to open your mail app.' : ''}
      </span>
    </nav>
  )
}
