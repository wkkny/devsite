import { useState } from 'react'
import { FiGithub, FiMail } from 'react-icons/fi'
import { FaXTwitter } from 'react-icons/fa6'

import { Tooltip } from '@/components/motion/tooltip'
import { portfolioOwner, socialLinks } from '@/data'

const socialIcons = {
  x: FaXTwitter,
  github: FiGithub,
} as const

export function SocialLinks() {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(portfolioOwner.email)
      setCopyStatus('copied')
      window.setTimeout(() => setCopyStatus('idle'), 1500)
    } catch {
      setCopyStatus('error')
      window.setTimeout(() => setCopyStatus('idle'), 1500)
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
      ? 'Could not copy email'
      : 'Copy email address'

  return (
    <nav aria-label="Social links and contact information" className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
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
      <span className="inline-flex items-center">
        <Tooltip content={emailTooltip} side="top">
          <button
            aria-label={emailLabel}
            className="email-trigger inline-flex items-center gap-1.5 leading-none text-muted-foreground hover:text-foreground focus-visible:text-foreground"
            onClick={copyEmail}
            type="button"
          >
            <FiMail aria-hidden="true" className="size-4 shrink-0" />
            {portfolioOwner.email}
          </button>
        </Tooltip>
        <span aria-live="polite" className="sr-only">
          {copyStatus === 'copied' ? 'Email address copied to clipboard.' : copyStatus === 'error' ? 'Could not copy email address.' : ''}
        </span>
      </span>
    </nav>
  )
}
