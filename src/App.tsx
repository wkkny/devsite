import { AsciiText } from '@/components/ascii-text'
import { BottomNav } from '@/components/bottom-nav'
import { Connections } from '@/components/connections'
import { GithubCalendar } from '@/components/grootstudio/github-calendar'
import { ModeToggle } from '@/components/mode-toggle'
import { ProfileHero } from '@/components/profile-hero'
import { InfoSection } from '@/components/info-section'
import { PixelReveal } from '@/components/pixel-reveal'
import ProjectsSection from '@/components/projects-section'
import { portfolio } from '@/config/portfolio'

// Rolling 12-month window: first day of last month through one year later
function toISODate(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

const calendarStart = new Date()
calendarStart.setDate(1)
calendarStart.setMonth(calendarStart.getMonth() - 1)
const calendarEnd = new Date(calendarStart)
calendarEnd.setFullYear(calendarEnd.getFullYear() + 1)
calendarEnd.setDate(0)
const calendarStartDate = toISODate(calendarStart)
const calendarEndDate = toISODate(calendarEnd)

function App() {
  return (
    <main id="top" className="min-h-svh overflow-x-clip bg-background px-2 pb-32 text-foreground md:pb-8">
      <PixelReveal />
      <header className="sticky top-0 z-50 hidden bg-background/90 backdrop-blur-sm md:block">
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
        <div id="info" className="hidden scroll-mt-20 md:block">
          <InfoSection />
        </div>
        <div className="-mt-6 md:hidden">
          <Connections />
        </div>
        <section id="github" className="scroll-mt-20">
          <GithubCalendar
            username={portfolio.links.github.username}
            startDate={calendarStartDate}
            endDate={calendarEndDate}
            cellSize={11}
            cellGap={3}
            cellShape="circle"
            theme="minimal"
            className="border-0"
          />
        </section>
        <section id="projects" className="scroll-mt-20">
          <ProjectsSection />
        </section>
      </div>
      <BottomNav />
    </main>
  )
}

export default App
