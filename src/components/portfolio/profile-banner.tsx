import { useEffect, useRef, useState } from 'react'

import { DitherCanvas } from '@/components/dither-canvas'
import { useTheme } from '@/components/theme-context'
import { sendDitherPulse } from '@/lib/dither-pulse'

const HINT_KEY = 'banner-hinted'
// Once the hero has settled and the visitor has had a moment with it.
const HINT_DELAY_MS = 2600
// After the avatar has landed, so the clearing is measured where it ends up rather than mid-spring.
const AVATAR_SETTLED_MS = 900

type Calm = { x: number; y: number; radius: number; strength: number }

// Site defaults for the banner. Colors come from the theme tokens, so restyle it with classes.
// Kept in its own chunk so the banner stays optional.
export default function ProfileBanner() {
  const { theme } = useTheme()
  const ref = useRef<HTMLDivElement>(null)
  const [calm, setCalm] = useState<Calm>()

  // Keep a soft clearing behind the avatar, wherever the content column puts it, so the face
  // never sits on busy dots.
  useEffect(() => {
    const banner = ref.current
    if (!banner) return
    const measure = () => {
      const avatar = document.querySelector<HTMLElement>('#profile img')
      if (!avatar) return
      const box = banner.getBoundingClientRect()
      const face = avatar.getBoundingClientRect()
      setCalm({
        x: face.left + face.width / 2 - box.left,
        y: face.top + face.height * 0.4 - box.top,
        radius: face.width * 0.7,
        strength: 0.45,
      })
    }
    measure()
    const settled = window.setTimeout(measure, AVATAR_SETTLED_MS)
    const observer = new ResizeObserver(measure)
    observer.observe(banner)
    return () => {
      window.clearTimeout(settled)
      observer.disconnect()
    }
  }, [])

  // One ring from beside the avatar, once per visit, so people learn the banner answers them.
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(HINT_KEY)) return
    } catch {
      return
    }
    const timer = window.setTimeout(() => {
      const avatar = document.querySelector<HTMLElement>('#profile img')
      if (!avatar || window.scrollY > 120) return
      try {
        window.sessionStorage.setItem(HINT_KEY, '1')
      } catch {
        // Without storage the hint may repeat on reload, which is harmless.
      }
      const rect = avatar.getBoundingClientRect()
      sendDitherPulse({ clientX: rect.right - rect.width * 0.2, clientY: rect.top + rect.height * 0.25, strength: 5, duration: 1.2 })
    }, HINT_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <div ref={ref} className="absolute inset-0">
      <DitherCanvas
        className="bg-background text-portfolio-blue [--dither-tone:var(--portfolio-tint)]"
        rotation={70}
        // Blue on black reads much louder than blue on white, so the dark field is thinned out.
        density={theme === 'dark' ? 0.3 : 0.38}
        contrast={theme === 'dark' ? 2.1 : 1.8}
        // Flowing shapes that dissolve into the page under the avatar, with soft dots at their edges
        // so each shape has a body and a cooler halo instead of one flat blue. Under the cursor the
        // halo lights up to full blue, like a lamp passing over it.
        warp={1.6}
        fade={0.45}
        tone={0.15}
        toneAlpha={theme === 'dark' ? 0.4 : 0.5}
        hoverGlow={1}
        calm={calm}
        hoverDisplacement={9}
        hoverRadius={18}
        hoverBoost={0.12}
        // A tighter, quicker ring than the default reads as a snap rather than a screensaver.
        shockwaveSpeed={170}
        shockwaveWidth={7}
        shockwaveDuration={1.25}
        shockwaveStrength={10}
        shockwaveBoost={0.35}
        // The field prints itself in behind the blade in three Bayer steps, rather than fading in over
        // a placeholder, and then drifts and breathes slowly so it reads as alive at rest.
        printIn={720}
        breathe={0.025}
        speed={0.24}
      />
    </div>
  )
}
