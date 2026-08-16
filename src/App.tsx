import { AsciiText } from '@/components/ascii-text'
import { ModeToggle } from '@/components/mode-toggle'
import profileImg from '@/assets/profile.png'
import { StripeDivider } from '@/components/stripe-divider'

function App() {
  return (
    <main className="min-h-svh overflow-x-clip bg-background px-2 text-foreground">
      <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-sm">
        <nav
          className="nav-shine screen-line-bottom mx-auto flex h-14 max-w-3xl items-center justify-between px-4"
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
        <StripeDivider line="bottom" />

        <section className="screen-line-bottom border-x border-line p-0">
          <div className="flex items-start">
            <div className="shrink-0 border-r border-line">
              <img
                src={profileImg}
                alt="Kritiraj B"
                className="size-40 rounded-full border border-line object-cover object-[center_60%]"
              />
            </div>

            <div className="flex min-h-40 min-w-0 flex-1 flex-col justify-end pt-4 pb-0">
              <p className="border-y border-line px-4 py-1 text-4xl font-medium tracking-wide">
                Kritiraj B
              </p>
              <p className="border-b border-line px-4 py-1 text-base text-muted-foreground">
                I love terminal apps.
              </p>
            </div>
          </div>
        </section>

        <section className="screen-line-bottom min-h-[calc(100svh-14.5rem)] border-x border-line" />
      </div>
    </main>
  )
}

export default App
