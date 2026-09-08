import { useEffect, useState } from 'react'

import backgroundImg from '@/assets/background.jpeg'
import profileImg from '@/assets/profile.webp'
import { ShimmerTextFlip } from '@/components/grootstudio/shimmer-text-flip'
import { SpotifyInlinePill } from '@/components/spotify-pill'
import { useBackgroundReveal } from '@/lib/use-background-reveal'
import { useNowPlaying } from '@/lib/use-now-playing'
import { cn } from '@/lib/utils'
import { motion } from 'motion/react'

const PROFILE_ROLES = [
  'Full Stack Developer.',
  'UI/UX Designer.',
  'I love terminal apps.',
]

function useImageLoader(src: string) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    const img = new Image()
    img.src = src
    img.onload = () => setIsLoading(false)
    img.onerror = () => {
      setIsLoading(false)
      setHasError(true)
    }
  }, [src])

  return { isLoading, hasError }
}

function ProfileHero() {
  const backgroundReveal = useBackgroundReveal()
  const { data } = useNowPlaying()
  const trackName = data?.item?.name ?? ''
  const artistName = data?.item?.artists?.[0]?.name ?? ''
  const hasTrack = Boolean(trackName)

  return (
    <section
      className="relative min-h-[460px]"
      onMouseMove={backgroundReveal.onMouseMove}
      onMouseLeave={backgroundReveal.onMouseLeave}
    >
      <HeroBackground />

      <div className="relative flex min-h-[460px] items-end">
        <div data-disable-bg-hover className="shrink-0">
          <div className="relative size-40 overflow-hidden rounded-full border border-line/60 bg-muted/40">
            <ProfileImage />
          </div>
        </div>

        <div
          data-disable-bg-hover
          className="flex min-h-40 min-w-0 flex-1 flex-col justify-end pt-4"
        >
          <p className="truncate px-4 py-1 font-mono text-2xl font-medium tracking-tight whitespace-nowrap sm:text-3xl">
            Kritiraj B
          </p>
          <p className="px-4 py-1 font-pixel text-base text-muted-foreground">
            <ShimmerTextFlip interval={2.8} as={motion.span}>
              {PROFILE_ROLES}
            </ShimmerTextFlip>
          </p>
        </div>

        {hasTrack && (
          <div data-disable-bg-hover className="absolute top-4 right-4 z-20">
            <SpotifyInlinePill trackName={trackName} artistName={artistName} />
          </div>
        )}
      </div>
    </section>
  )
}

function ProfileImage() {
  const { isLoading, hasError } = useImageLoader(profileImg)

  return (
    <>
      {isLoading && (
        <div className="absolute inset-0 animate-pulse bg-muted/60" />
      )}
      {hasError ? (
        <div className="flex size-full items-center justify-center bg-muted/40 text-muted-foreground">
          <span className="text-xs">Failed to load</span>
        </div>
      ) : (
        <img
          src={profileImg}
          alt="Kritiraj B"
          draggable={false}
          className={cn(
            'size-full select-none object-cover object-[center_60%] transition-opacity duration-500',
            isLoading ? 'opacity-0' : 'opacity-100'
          )}
        />
      )}
    </>
  )
}

function HeroBackground() {
  const { isLoading } = useImageLoader(backgroundImg)

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 animate-pulse bg-muted/30" />
      )}
      <div
        className={cn(
          'halftone-bg absolute inset-0 transition-opacity duration-500',
          isLoading && 'opacity-0'
        )}
        style={{ backgroundImage: `url(${backgroundImg})` }}
      />
      <div
        className={cn(
          'halftone-bg halftone-bg-color absolute inset-0',
          isLoading && 'opacity-0'
        )}
        style={{ backgroundImage: `url(${backgroundImg})` }}
      />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background via-background/80 to-transparent" />
    </div>
  )
}

export { ProfileHero }
