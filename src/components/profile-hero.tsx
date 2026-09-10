import { useEffect, useState } from 'react'

import backgroundImg from '@/assets/background.jpeg'
import profileImg from '@/assets/profile.webp'
import { ShimmerTextFlip } from '@/components/grootstudio/shimmer-text-flip'
import { SpotifyInlinePill } from '@/components/spotify-pill'
import { portfolio } from '@/config/portfolio'
import { useBackgroundReveal } from '@/lib/use-background-reveal'
import { useNowPlaying } from '@/lib/use-now-playing'
import { cn } from '@/lib/utils'
import { motion } from 'motion/react'

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
  const trackName = data?.track?.title ?? ''
  const artistName = data?.track?.artist ?? ''
  const spotifyUrl = data?.track?.spotifyUrl ?? ''
  const playbackStatus = data?.status
  const hasTrack =
    Boolean(trackName && artistName && spotifyUrl) &&
    (playbackStatus === 'playing' || playbackStatus === 'recent')

  return (
    <section
      className="relative min-h-[460px]"
      onMouseMove={backgroundReveal.onMouseMove}
      onMouseLeave={backgroundReveal.onMouseLeave}
      onPointerDown={backgroundReveal.onPointerDown}
    >
      <HeroBackground />

      <div className="relative flex min-h-[460px] flex-wrap items-end">
        <div data-disable-bg-hover className="shrink-0">
          <div className="relative size-40 overflow-hidden rounded-full border border-line/60 bg-muted/40">
            <ProfileImage />
          </div>
        </div>

        <div
          data-disable-bg-hover
          className="flex min-w-0 flex-1 flex-col"
        >
          <h1 className="break-words px-4 py-1 font-mono text-2xl font-medium tracking-tight sm:text-3xl">
            {portfolio.profile.displayName}
          </h1>
          <p className="px-4 py-1 font-pixel text-base text-muted-foreground">
            <ShimmerTextFlip interval={2.8} as={motion.span}>
              {portfolio.profile.roles}
            </ShimmerTextFlip>
          </p>
        </div>

        {hasTrack && (
          <div data-disable-bg-hover className="absolute top-4 right-4 z-20">
            <SpotifyInlinePill
              trackName={trackName}
              artistName={artistName}
              spotifyUrl={spotifyUrl}
              status={playbackStatus}
            />
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
          alt={portfolio.profile.displayName}
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
