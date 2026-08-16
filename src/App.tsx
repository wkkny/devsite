import { AsciiText } from '@/components/ascii-text'
import { ModeToggle } from '@/components/mode-toggle'
import { ProfileHero } from '@/components/profile-hero'
import { StripeDivider } from '@/components/stripe-divider'

function App() {
  return (
    <main className="min-h-svh overflow-x-clip bg-background px-2 text-foreground">
      <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-sm">
        <nav
          className="nav-shine screen-line-bottom mx-auto flex h-14 max-w-3xl items-center justify-between"
          onMouseMove={(event) => {
            event.currentTarget.style.setProperty('--shine-x', `${event.clientX}px`)
            event.currentTarget.style.setProperty('--shine-opacity', '1')
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.setProperty('--shine-opacity', '0')
          }}
        >
          <a href="/" className="block text-foreground">
            <AsciiText
              text="KB"
              variant="pixel"
              size="md"
              animation="wave"
              animationDirection="ttb"
              animationKey="load"
            />
          </a>

          <ModeToggle />
        </nav>
      </header>

      <div className="mx-auto max-w-3xl">
        <ProfileHero />
        <StripeDivider />
      </div>
    </main>
  )
}

export default App
