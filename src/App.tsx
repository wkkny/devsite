import { AsciiText } from '@/components/ascii-text'
import { GithubCalendar } from '@/components/grootstudio/github-calendar'
import { ModeToggle } from '@/components/mode-toggle'
import { ProfileHero } from '@/components/profile-hero'
import { InfoSection } from '@/components/info-section'
import { PixelReveal } from '@/components/pixel-reveal'
import ProjectsSection from '@/components/projects-section'
import { portfolio } from '@/config/portfolio'

function App() {
  return (
    <main className="min-h-svh overflow-x-clip bg-background px-2 text-foreground">
      <PixelReveal />
      <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-sm">
        <nav
          className="mx-auto flex h-14 max-w-3xl items-center justify-between"
        >
          <a href="/" className="block text-foreground" aria-label={portfolio.profile.homeLabel}>
            <AsciiText
              text={portfolio.profile.monogram}
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
            startDate={`${new Date().getFullYear()}-01-01`}
            fillWidth
            cellSize={11}
            cellGap={3}
            cellShape="circle"
            theme="minimal"
            className="border-0"
          />
        </section>
        <ProjectsSection />
      </div>
    </main>
  )
}

export default App
