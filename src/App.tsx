import { AsciiText } from '@/components/ascii-text'
import { GithubCalendar } from '@/components/grootstudio/github-calendar'
import { ModeToggle } from '@/components/mode-toggle'
import { ProfileHero } from '@/components/profile-hero'
import { InfoSection } from '@/components/info-section'
import { StripeDivider } from '@/components/stripe-divider'

function getCalendarStartDate() {
  const date = new Date()
  date.setFullYear(date.getFullYear() - 1)
  date.setMonth(date.getMonth(), 1)

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')

  return `${year}-${month}-01`
}

function App() {
  const calendarStartDate = getCalendarStartDate()

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
              animation="tetris"
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
        <InfoSection />
        <StripeDivider />
        <section className="border-x border-line">
          <GithubCalendar
            username="fuzzyKenny"
            startDate={calendarStartDate}
            cellSize={11}
            cellGap={3}
            cellShape="circle"
            theme="minimal"
            className="border-0"
          />
        </section>
        <StripeDivider />
      </div>
    </main>
  )
}

export default App
