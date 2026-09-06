import { AsciiText } from '@/components/ascii-text'
import { GithubCalendar } from '@/components/grootstudio/github-calendar'
import { ModeToggle } from '@/components/mode-toggle'
import { ProfileHero } from '@/components/profile-hero'
import { InfoSection } from '@/components/info-section'

function App() {
  return (
    <main className="min-h-svh overflow-x-clip bg-background px-2 text-foreground">
      <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-sm">
        <nav
          className="mx-auto flex h-14 max-w-3xl items-center justify-between"
        >
          <a href="/" className="block text-foreground" aria-label="Kritiraj's Portfolio">
            <AsciiText
              text="KB"
              variant="pixel"
              size="md"
              animation="tetris"
              animationDirection="ttb"
              animationKey="load"
            />
          </a>

          <ModeToggle />
        </nav>
      </header>

      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <ProfileHero />
        <InfoSection />
        <section>
          <GithubCalendar
            username="fuzzyKenny"
            startDate={`${new Date().getFullYear()}-01-01`}
            fillWidth
            cellSize={11}
            cellGap={3}
            cellShape="circle"
            theme="minimal"
            className="border-0"
          />
        </section>
      </div>
    </main>
  )
}

export default App
