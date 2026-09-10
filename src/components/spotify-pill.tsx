import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react"
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  type Variants,
} from "motion/react"
import { SiSpotify } from "react-icons/si"

import { cn } from "@/lib/utils"
import type { PlaybackStatus } from "../../shared/now-playing"

export type SpotifyPillVariant = "inline" | "stacked"
export type SpotifyPillArtistSize = "xs" | "sm" | "base"

export interface SpotifyPillProps {
  trackName: string
  artistName: string
  spotifyUrl: string
  status: Exclude<PlaybackStatus, "idle">
  variant?: SpotifyPillVariant
  artistSize?: SpotifyPillArtistSize
  maxWidth?: number
}

const DEFAULT_MAX_TEXT_WIDTH = 180
const MIN_TEXT_WIDTH = 96
const VIEWPORT_SAFE_GUTTER = 32
const EXPANDED_LEFT_PADDING = 8
const ICON_TEXT_GAP = 10
const INLINE_ITEM_GAP = 6
const INLINE_SEPARATOR_WIDTH = 1
const INLINE_MARQUEE_GAP = 32
const INLINE_MARQUEE_REPEAT_DELAY = 1.2

const COLLAPSE_DELAY = 2_000
const SCROLL_DELAY = 800

const FONT_FAMILY = "'Geist Variable', sans-serif"
const TRACK_FONT = `500 14px ${FONT_FAMILY}`
const STATUS_FONT = `600 11px ${FONT_FAMILY}`

const STATUS_LABELS: Record<Exclude<PlaybackStatus, "idle">, string> = {
  playing: "Now playing",
  recent: "Recently played",
}

const ARTIST_TEXT_CLASS: Record<SpotifyPillArtistSize, string> = {
  xs: "text-xs",
  sm: "text-sm",
  base: "text-base",
}

const ARTIST_FONT_SIZE: Record<SpotifyPillArtistSize, number> = {
  xs: 12,
  sm: 14,
  base: 16,
}

const VARIANT_CONFIG = {
  inline: {
    size: 36,
    iconClassName: "size-[21px]",
    textPadding: 16,
    contentClassName: "flex-row items-center gap-1.5",
  },
  stacked: {
    size: 48,
    iconClassName: "size-8",
    textPadding: 24,
    contentClassName: "flex-col items-start",
  },
} as const

type VariantCustom = {
  size: number
  textWidth: number
}

const containerVariants: Variants = {
  collapsed: ({ size }: VariantCustom) => ({ width: size, paddingLeft: 0 }),
  expanded: ({ size, textWidth }: VariantCustom) => ({
    width: size + textWidth + EXPANDED_LEFT_PADDING,
    paddingLeft: EXPANDED_LEFT_PADDING,
  }),
}

const textAreaVariants: Variants = {
  collapsed: { width: 0, opacity: 0, marginLeft: 0 },
  expanded: ({ textWidth }: VariantCustom) => ({
    width: textWidth,
    opacity: 1,
    marginLeft: ICON_TEXT_GAP,
  }),
}

const trackVariants: Variants = {
  collapsed: { opacity: 0, y: 4 },
  expanded: {
    opacity: 1,
    y: 0,
  },
}

const artistVariants: Variants = {
  collapsed: { opacity: 0, y: 4 },
  expanded: {
    opacity: 0.8,
    y: 0,
  },
}

function clearTimer(
  timer: MutableRefObject<ReturnType<typeof setTimeout> | null>
) {
  if (!timer.current) return

  clearTimeout(timer.current)
  timer.current = null
}

function getViewportTextWidth(size: number, maxWidth: number) {
  if (typeof window === "undefined") {
    return maxWidth
  }

  const availableWidth =
    window.innerWidth -
    VIEWPORT_SAFE_GUTTER * 2 -
    size -
    EXPANDED_LEFT_PADDING -
    ICON_TEXT_GAP

  return Math.min(maxWidth, Math.max(MIN_TEXT_WIDTH, availableWidth))
}

function getTextWidth(text: string, font: string) {
  const canvas = document.createElement("canvas")
  const context = canvas.getContext("2d")

  if (!context) return 0

  context.font = font
  return context.measureText(text).width
}

function getTrackDetailsWidth({
  trackName,
  artistName,
  artistSize,
  status,
  variant,
}: Required<
  Pick<
    SpotifyPillProps,
    "trackName" | "artistName" | "artistSize" | "status" | "variant"
  >
>) {
  const trackWidth = getTextWidth(trackName, TRACK_FONT)
  const statusWidth = getTextWidth(`${STATUS_LABELS[status]}:`, STATUS_FONT)
  const artistFontSize =
    variant === "inline" ? 14 : ARTIST_FONT_SIZE[artistSize]
  const artistWidth = getTextWidth(
    artistName,
    `500 ${artistFontSize}px ${FONT_FAMILY}`
  )

  if (variant === "inline") {
    return (
      statusWidth +
      trackWidth +
      artistWidth +
      INLINE_SEPARATOR_WIDTH +
      INLINE_ITEM_GAP * 3
    )
  }

  return Math.max(statusWidth, trackWidth, artistWidth)
}

export function SpotifyPill({
  trackName,
  artistName,
  spotifyUrl,
  status,
  variant = "stacked",
  artistSize = "xs",
  maxWidth = DEFAULT_MAX_TEXT_WIDTH,
}: SpotifyPillProps) {
  const [expanded, setExpanded] = useState(false)
  const prefersReducedMotion = useReducedMotion() ?? false

  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollDelayTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollAnimation = useRef<ReturnType<typeof animate> | null>(null)
  const shouldExpandOnTouch = useRef(false)

  const scrollX = useMotionValue(0)

  const prevTrackRef = useRef({ trackName, artistName, status })

  const config = VARIANT_CONFIG[variant]
  const [responsiveMaxWidth, setResponsiveMaxWidth] = useState(() =>
    getViewportTextWidth(config.size, maxWidth)
  )
  const contentWidth = useMemo(
    () =>
      getTrackDetailsWidth({
        trackName,
        artistName,
        artistSize,
        status,
        variant,
      }),
    [artistName, artistSize, status, trackName, variant]
  )
  const animationState = expanded ? "expanded" : "collapsed"
  const paddedContentWidth = Math.ceil(contentWidth) + config.textPadding
  const shouldScroll =
    !prefersReducedMotion && paddedContentWidth > responsiveMaxWidth
  const textAreaWidth = Math.min(paddedContentWidth, responsiveMaxWidth)
  const animationCustom: VariantCustom = {
    size: config.size,
    textWidth: textAreaWidth,
  }

  useEffect(() => {
    const updateResponsiveWidth = () => {
      setResponsiveMaxWidth(getViewportTextWidth(config.size, maxWidth))
    }
    const frame = window.requestAnimationFrame(updateResponsiveWidth)

    window.addEventListener("resize", updateResponsiveWidth)

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener("resize", updateResponsiveWidth)
    }
  }, [config.size, maxWidth])

  const stopScroll = useCallback(() => {
    clearTimer(scrollDelayTimer)
    scrollAnimation.current?.stop()
    scrollAnimation.current = null

    if (prefersReducedMotion) {
      scrollX.set(0)
    } else {
      animate(scrollX, 0, { duration: 0.3, ease: "easeOut" })
    }
  }, [prefersReducedMotion, scrollX])

  const startScroll = useCallback(() => {
    if (prefersReducedMotion || !shouldScroll) return

    clearTimer(scrollDelayTimer)
    scrollAnimation.current?.stop()
    scrollX.set(0)

    scrollDelayTimer.current = setTimeout(() => {
      const distance =
        variant === "inline"
          ? contentWidth + INLINE_MARQUEE_GAP
          : Math.max(0, contentWidth - textAreaWidth + config.textPadding)

      scrollAnimation.current = animate(scrollX, -distance, {
        duration: Math.max(2, distance / 40),
        ease: "linear",
        repeat: Infinity,
        repeatDelay: variant === "inline" ? INLINE_MARQUEE_REPEAT_DELAY : 0,
        repeatType: variant === "inline" ? "loop" : "reverse",
      })
    }, SCROLL_DELAY)
  }, [
    config.textPadding,
    contentWidth,
    prefersReducedMotion,
    scrollX,
    shouldScroll,
    textAreaWidth,
    variant,
  ])

  const expand = useCallback(() => {
    clearTimer(collapseTimer)
    setExpanded(true)
    startScroll()
  }, [startScroll])

  const collapseNow = useCallback(() => {
    clearTimer(collapseTimer)
    setExpanded(false)
    stopScroll()
  }, [stopScroll])

  const collapse = useCallback(() => {
    clearTimer(collapseTimer)
    collapseTimer.current = setTimeout(collapseNow, COLLAPSE_DELAY)
  }, [collapseNow])

  useEffect(() => {
    if (prefersReducedMotion) stopScroll()
  }, [prefersReducedMotion, stopScroll])

  useEffect(() => {
    return () => {
      clearTimer(collapseTimer)
      clearTimer(scrollDelayTimer)
      scrollAnimation.current?.stop()
    }
  }, [])

  useEffect(() => {
    const prev = prevTrackRef.current
    if (
      prev.trackName !== trackName ||
      prev.artistName !== artistName ||
      prev.status !== status
    ) {
      prevTrackRef.current = { trackName, artistName, status }
      expand()
      collapse()
    }
  }, [trackName, artistName, status, expand, collapse])

  const trackDetails = (ariaHidden = false) => (
    <div
      aria-hidden={ariaHidden || undefined}
      className={cn("flex shrink-0", config.contentClassName)}
    >
      <motion.span
        className="shrink-0 text-[11px] font-semibold tracking-wide text-white/70"
        variants={artistVariants}
        animate={animationState}
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : { duration: 0.3, ease: "easeOut", delay: 0.2 }
        }
      >
        {STATUS_LABELS[status]}:
      </motion.span>
      <motion.p
        className="m-0 shrink-0 text-sm font-medium"
        variants={trackVariants}
        animate={animationState}
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : { duration: 0.3, ease: "easeOut", delay: 0.1 }
        }
      >
        {trackName}
      </motion.p>
      {variant === "inline" && (
        <span
          aria-hidden="true"
          className="h-3 w-px shrink-0 self-center rounded-full bg-[#1DB954]/50 dark:bg-white/35"
        />
      )}
      <motion.span
        className={cn(
          "shrink-0",
          variant === "inline" ? "text-sm" : ARTIST_TEXT_CLASS[artistSize]
        )}
        variants={artistVariants}
        animate={animationState}
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : { duration: 0.3, ease: "easeOut", delay: 0.2 }
        }
      >
        {artistName}
      </motion.span>
    </div>
  )

  return (
    <motion.a
      href={spotifyUrl}
      target="_blank"
      rel="noreferrer"
      aria-label={`${STATUS_LABELS[status]} on Spotify: ${trackName} by ${artistName}. Open track on Spotify`}
      title={`${STATUS_LABELS[status]}: ${trackName} — ${artistName}`}
      className={cn(
        "relative flex items-center justify-center overflow-hidden rounded-full text-white",
        "bg-[#191414] dark:border dark:border-white/15 dark:bg-zinc-950 dark:text-white",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1DB954] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      )}
      style={{ height: config.size }}
      variants={containerVariants}
      custom={animationCustom}
      initial={false}
      animate={animationState}
      transition={
        prefersReducedMotion
          ? { duration: 0 }
          : { duration: 0.3, ease: "easeInOut" }
      }
      whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
      onHoverStart={expand}
      onHoverEnd={collapse}
      onFocus={expand}
      onBlur={collapseNow}
      onPointerDown={(event) => {
        shouldExpandOnTouch.current =
          event.pointerType === "touch" && !expanded
      }}
      onPointerCancel={() => {
        shouldExpandOnTouch.current = false
      }}
      onClick={(event) => {
        if (shouldExpandOnTouch.current) {
          event.preventDefault()
          expand()
        }
        shouldExpandOnTouch.current = false
      }}
    >
      <span className="z-10 shrink-0">
        <SiSpotify className={config.iconClassName} aria-hidden="true" />
      </span>

      <motion.div
        className="flex min-w-0 shrink-0 overflow-hidden leading-tight whitespace-nowrap"
        variants={textAreaVariants}
        custom={animationCustom}
        initial={false}
        animate={animationState}
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : { duration: 0.3, ease: "easeInOut" }
        }
      >
        <motion.div
          className="flex shrink-0 text-[#1DB954] dark:text-white/90"
          style={{ x: shouldScroll ? scrollX : 0 }}
        >
          {trackDetails()}
          {variant === "inline" && shouldScroll && (
            <div style={{ width: INLINE_MARQUEE_GAP }} className="shrink-0" />
          )}
          {variant === "inline" && shouldScroll && trackDetails(true)}
        </motion.div>
      </motion.div>
    </motion.a>
  )
}

export function SpotifyInlinePill(props: Omit<SpotifyPillProps, "variant">) {
  return <SpotifyPill {...props} variant="inline" />
}

export function SpotifyStackedPill(props: Omit<SpotifyPillProps, "variant">) {
  return <SpotifyPill {...props} variant="stacked" />
}
