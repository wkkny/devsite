import { lazy, Suspense, useState, type ComponentType } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { FiMapPin } from 'react-icons/fi'

import { SpotifyStatus } from '@/components/spotify-status'
import { Tooltip } from '@/components/tooltip'
import { ThemeToggle } from '@/components/theme-toggle'
import { ViewerCounter } from '@/components/viewer-counter'
import { SocialLinks } from '@/components/portfolio/social-links'
import { useTheme } from '@/components/theme-context'
import { EASE_OUT } from '@/lib/ease'
import { portfolioOwner } from '@/data'

// The optional banner chunk loads on first render, and only when motion is allowed.
const ProfileBanner = lazy<ComponentType>(() => import('./profile-banner').catch(() => ({ default: () => null })))

// A short ease-in so the blade has weight, then a long settle. The hero is done by about 1s.
const bannerTransition = { duration: 0.95, ease: [0.3, 0, 0.1, 1], delay: 0.04 } as const

// The hero copy rises line by line from under a soft blur, 55ms apart, while the avatar lands.
const COPY_DELAY = 0.38
const COPY_STAGGER = 0.055

export function ProfileSection() {
  const { theme } = useTheme()
  const reducedMotion = useReducedMotion()
  const [profileContentEntered, setProfileContentEntered] = useState(false)

  // Each line of copy enters at its own beat.
  function rise(step: number) {
    if (reducedMotion) {
      return { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.2, ease: EASE_OUT } }
    }
    return {
      initial: { opacity: 0, y: 10, filter: 'blur(4px)' },
      animate: { opacity: 1, y: 0, filter: 'blur(0px)', transitionEnd: { filter: 'none' } },
      transition: { duration: 0.5, ease: EASE_OUT, delay: COPY_DELAY + step * COPY_STAGGER },
    }
  }

  return (
    <section id="profile" aria-labelledby="profile-name">
      <div className="relative left-1/2 h-72 w-screen -translate-x-1/2 overflow-hidden bg-background text-foreground sm:h-96">
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          initial={reducedMotion ? { opacity: 0 } : { clipPath: 'polygon(0 0, 0 0, 0 100%, 0 100%)' }}
          animate={reducedMotion ? { opacity: 1 } : { clipPath: 'polygon(0 0, 116% 0, 100% 100%, 0 100%)' }}
          transition={reducedMotion ? { duration: 0.2, ease: EASE_OUT } : bannerTransition}
        >
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(var(--portfolio-blue) 1px, transparent 1px)', backgroundSize: '4px 4px', opacity: 0.25 }} />
          {!reducedMotion && (
            <Suspense fallback={null}>
              <ProfileBanner />
            </Suspense>
          )}
        </motion.div>
      </div>
      <div className="relative z-20 -mt-24 flex flex-col gap-5 sm:-mt-32 sm:gap-6">
        <motion.img
          src={portfolioOwner.profilePicture}
          alt={portfolioOwner.profilePictureAlt}
          className="size-44 object-contain sm:size-56"
          fetchPriority="high"
          width={448}
          height={448}
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96, filter: 'blur(6px)' }}
          animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', transitionEnd: { filter: 'none' } }}
          transition={reducedMotion ? { duration: 0.2, ease: EASE_OUT } : { duration: 0.55, ease: EASE_OUT, delay: 0.24 }}
        />
        <div>
          <div className="relative flex min-w-0 items-center justify-between gap-2">
            {/* The name slides up out of its own line, so the serif gets a beat to itself. */}
            <h1 id="profile-name" className="min-w-0 overflow-hidden pb-[0.08em] font-heading text-[2.5rem] leading-[1.05] tracking-[-0.015em] text-balance sm:text-[3.5rem]">
              <motion.span
                className="inline-block"
                initial={reducedMotion ? { opacity: 0 } : { y: '110%' }}
                animate={reducedMotion ? { opacity: 1 } : { y: 0 }}
                transition={reducedMotion ? { duration: 0.2, ease: EASE_OUT } : { duration: 0.7, ease: EASE_OUT, delay: COPY_DELAY - 0.06 }}
              >
                {portfolioOwner.displayName}
              </motion.span>
            </h1>
            <motion.div
              role="group"
              aria-label="Site controls"
              className="inline-flex h-10 shrink-0 items-center gap-1 rounded-xl p-1 sm:absolute sm:-top-[7.5rem] sm:right-0"
              {...rise(0)}
              onAnimationComplete={() => setProfileContentEntered(true)}
            >
              <ViewerCounter startAnimation={profileContentEntered} />
              <span aria-hidden="true" className="h-5 w-px bg-border" />
              <Tooltip content={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} side="bottom" gap={6}>
                <ThemeToggle />
              </Tooltip>
            </motion.div>
          </div>
          <motion.div {...rise(1)} className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 type-label text-muted-foreground">
            <p>{portfolioOwner.role}</p>
            <p className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <FiMapPin aria-hidden="true" className="size-3 shrink-0" strokeWidth={2} />
              {portfolioOwner.location}
            </p>
          </motion.div>
          <motion.p {...rise(2)} className="mt-5 max-w-[60ch] text-[0.9375rem] leading-[1.65] text-pretty text-foreground/85">{portfolioOwner.bio}</motion.p>
          <motion.div {...rise(3)}>
            <SocialLinks />
          </motion.div>
          <motion.div {...rise(4)} className="mt-5 min-h-6 w-fit max-w-full">
            <SpotifyStatus />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
