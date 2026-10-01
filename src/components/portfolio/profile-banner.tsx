import { Dithering } from '@paper-design/shaders-react'

// Keep the optional WebGL shader outside the initial application bundle.
export default function ProfileBanner({ theme }: { theme: string }) {
  const styles = getComputedStyle(document.documentElement)
  return (
    <Dithering
      key={theme}
      className="absolute inset-0"
      width="100%"
      height="100%"
      colorBack={styles.getPropertyValue('--background').trim()}
      colorFront={styles.getPropertyValue('--portfolio-blue').trim()}
      shape="simplex"
      type="4x4"
      size={4}
      speed={0.3}
      scale={0.4}
      rotation={70}
      offsetX={-0.4}
    />
  )
}
