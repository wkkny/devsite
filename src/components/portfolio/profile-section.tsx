import { lazy, Suspense, useState, type ComponentType } from 'react'
import { MapPin } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'

import { SpotifyStatus } from '@/components/spotify-status'
import { Tooltip } from '@/components/ui/tooltip'
import { ThemeToggle } from '@/components/theme-toggle'
import { ViewerCounter } from '@/components/viewer-counter'
import { SocialLinks } from '@/components/portfolio/social-links'
import { useTheme } from '@/components/theme-context'
import { EASE_OUT } from '@/lib/ease'
import { portfolioOwner } from '@/data'

// The optional banner chunk loads on first render, and only when motion is allowed.
const ProfileBanner = lazy<ComponentType>(() => import('./profile-banner').catch(() => ({ default: () => null })))

// Eases in as well as out so the wipe doesn't launch at full speed.
const bannerTransition = { duration: 1.3, ease: [0.5, 0, 0.15, 1], delay: 0.1 } as const

export function ProfileSection() {
  const { theme } = useTheme()
  const reducedMotion = useReducedMotion()
  const [profileContentEntered, setProfileContentEntered] = useState(false)
  const contentInitial = reducedMotion ? { opacity: 0 } : { opacity: 0, transform: 'translate3d(0, 8px, 0)' }
  const contentAnimate = reducedMotion ? { opacity: 1 } : { opacity: 1, transform: 'translate3d(0, 0, 0)' }
  const contentTransition = reducedMotion
    ? { duration: 0.2, ease: EASE_OUT }
    : { duration: 0.36, ease: EASE_OUT, delay: 1.2 }

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
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, transform: 'translate3d(0, 12px, 0)' }}
          animate={reducedMotion ? { opacity: 1 } : { opacity: 1, transform: 'translate3d(0, 0, 0)' }}
          transition={reducedMotion ? { duration: 0.2, ease: EASE_OUT } : { duration: 0.42, ease: EASE_OUT, delay: 0.7 }}
        />
        <motion.div
          onAnimationComplete={() => setProfileContentEntered(true)}
          initial={contentInitial}
          animate={contentAnimate}
          transition={contentTransition}
        >
          <div className="relative flex min-w-0 items-center justify-between gap-2">
            <h1 id="profile-name" className="min-w-0 text-3xl font-medium tracking-tight sm:text-4xl">
              {portfolioOwner.displayName}
            </h1>
            <div
              role="group"
              aria-label="Site controls"
              className="inline-flex h-10 shrink-0 items-center gap-1 rounded-xl p-1 sm:absolute sm:-top-[7.5rem] sm:right-0"
            >
              <ViewerCounter startAnimation={profileContentEntered} />
              <span aria-hidden="true" className="h-5 w-px bg-border" />
              <Tooltip content={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} side="bottom">
                <ThemeToggle />
              </Tooltip>
            </div>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <p>{portfolioOwner.role}</p>
            <p className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <MapPin aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.8} />
              {portfolioOwner.location}
            </p>
          </div>
          <p className="mt-4 max-w-lg text-sm leading-6">{portfolioOwner.bio}</p>
          <SocialLinks />
          <div className="mt-5 min-h-6 w-fit max-w-xs sm:max-w-none">
            <SpotifyStatus />
          </div>
        </motion.div>
      </div>
    </section>
  )
}
