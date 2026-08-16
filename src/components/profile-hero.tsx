import backgroundImg from '@/assets/background.jpeg'
import profileImg from '@/assets/profile.png'
import { ShimmerTextFlip } from '@/components/grootstudio/shimmer-text-flip'
import { useBackgroundReveal } from '@/lib/use-background-reveal'
import { motion } from 'motion/react'

const PROFILE_ROLES = [
  'Full Stack Developer.',
  'UI/UX Designer.',
  'I love terminal apps.',
]

function ProfileHero() {
  const backgroundReveal = useBackgroundReveal()

  return (
    <section
      className="relative min-h-[460px] border-x border-line"
      onMouseMove={backgroundReveal.onMouseMove}
      onMouseLeave={backgroundReveal.onMouseLeave}
    >
      <HeroBackground />
      <div aria-hidden="true" className="screen-wide-line bottom-40 z-10" />

      <div className="relative flex min-h-[460px] items-end">
        <div data-disable-bg-hover className="shrink-0">
          <div className="size-40 overflow-hidden rounded-full border border-line/60">
            <img
              src={profileImg}
              alt="Kritiraj B"
              draggable={false}
              className="size-full select-none object-cover object-[center_60%]"
            />
          </div>
        </div>

        <div
          data-disable-bg-hover
          className="flex min-h-40 min-w-0 flex-1 flex-col justify-end pt-4"
        >
          <p className="border-y border-l border-line px-4 py-1 font-mono text-3xl font-medium tracking-tight">
            Kritiraj B
          </p>
          <p className="border-l border-line px-4 py-1 font-mono text-base text-muted-foreground">
            <ShimmerTextFlip interval={2.8} as={motion.span}>
              {PROFILE_ROLES}
            </ShimmerTextFlip>
          </p>
        </div>
      </div>
    </section>
  )
}

function HeroBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="halftone-bg absolute inset-0"
        style={{ backgroundImage: `url(${backgroundImg})` }}
      />
      <div
        className="halftone-bg halftone-bg-color absolute inset-0"
        style={{ backgroundImage: `url(${backgroundImg})` }}
      />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background via-background/80 to-transparent" />
    </div>
  )
}

export { ProfileHero }
