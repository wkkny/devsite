import { Dithering } from '@paper-design/shaders-react'
import { motion, useReducedMotion } from 'motion/react'

import { SpotifyStatus } from '@/components/spotify-status'
import { Tooltip } from '@/components/motion/tooltip'
import { ThemeToggle } from '@/components/theme-toggle'
import { ViewerCounter } from '@/components/viewer-counter'
import { SocialLinks } from '@/components/portfolio/social-links'
import { useTheme } from '@/components/theme-context'
import { EASE_OUT } from '@/lib/ease'
import { portfolioOwner } from '@/data'

const bannerTransition = { type: 'spring', visualDuration: 1.2, bounce: 0 } as const

export type ProfileSectionProps = {
  onBannerAnimationComplete: () => void
}

export function ProfileSection({ onBannerAnimationComplete }: ProfileSectionProps) {
  const { theme } = useTheme()
  const reducedMotion = useReducedMotion()
  const styles = getComputedStyle(document.documentElement)
  const shaderColors = {
    back: styles.getPropertyValue('--background').trim(),
    front: styles.getPropertyValue('--portfolio-blue').trim(),
  }
  const contentInitial = reducedMotion ? { opacity: 0 } : { opacity: 0, transform: 'translate3d(0, 8px, 0)' }
  const contentAnimate = reducedMotion ? { opacity: 1 } : { opacity: 1, transform: 'translate3d(0, 0, 0)' }
  const contentTransition = reducedMotion
    ? { duration: 0.2, ease: EASE_OUT }
    : { duration: 0.36, ease: EASE_OUT, delay: 1.12 }

  return (
    <section id="profile" aria-labelledby="profile-name">
      <div className="relative left-1/2 h-72 w-screen -translate-x-1/2 overflow-hidden bg-background text-foreground sm:h-96">
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          onAnimationComplete={onBannerAnimationComplete}
          initial={reducedMotion ? { opacity: 0 } : { clipPath: 'polygon(0 0, 0 0, 0 100%, 0 100%)' }}
          animate={reducedMotion ? { opacity: 1 } : { clipPath: 'polygon(0 0, 116% 0, 100% 100%, 0 100%)' }}
          transition={reducedMotion ? { duration: 0.2, ease: EASE_OUT } : bannerTransition}
        >
          <Dithering
            className="absolute inset-0"
            width="100%"
            height="100%"
            colorBack={shaderColors.back}
            colorFront={shaderColors.front}
            shape="simplex"
            type="4x4"
            size={4}
            speed={reducedMotion ? 0 : 0.3}
            scale={0.4}
            rotation={70}
            offsetX={-0.4}
          />
          {!reducedMotion && (
            <motion.span
              className="banner-shimmer"
              initial={{ transform: 'translate3d(0%, 0, 0) skewX(-16deg)' }}
              animate={{ transform: 'translate3d(116%, 0, 0) skewX(-16deg)' }}
              transition={bannerTransition}
            />
          )}
        </motion.div>
      </div>
      <div className="relative z-20 -mt-24 flex flex-col gap-5 sm:-mt-32 sm:gap-6">
        <motion.img
          src={portfolioOwner.profilePicture}
          alt={portfolioOwner.profilePictureAlt}
          className="size-44 rounded-lg border-8 border-background bg-background object-contain sm:size-56"
          fetchPriority="high"
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, transform: 'translate3d(0, 12px, 0)' }}
          animate={reducedMotion ? { opacity: 1 } : { opacity: 1, transform: 'translate3d(0, 0, 0)' }}
          transition={reducedMotion ? { duration: 0.2, ease: EASE_OUT } : { duration: 0.42, ease: EASE_OUT, delay: 0.7 }}
        />
        <motion.div
          initial={contentInitial}
          animate={contentAnimate}
          transition={contentTransition}
        >
          <div className="relative flex min-w-0 items-center justify-between gap-2">
            <h1 id="profile-name" className="min-w-0 text-3xl font-medium tracking-tight sm:text-4xl">
              {portfolioOwner.displayName}
            </h1>
            <div className="flex shrink-0 items-center gap-2 sm:absolute sm:-top-[7.5rem] sm:right-0">
              <ViewerCounter />
              <Tooltip content={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} side="bottom">
                <ThemeToggle />
              </Tooltip>
            </div>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{portfolioOwner.role}</p>
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
