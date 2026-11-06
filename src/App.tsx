import { LayoutGroup, motion, useReducedMotion } from 'motion/react'

import { GitHubCalendar } from '@/components/github-calendar'
import { ProfileSection } from '@/components/portfolio/profile-section'
import { ProjectsSection } from '@/components/portfolio/projects-section'
import { SiteFooter } from '@/components/portfolio/site-footer'
import { portfolioOwner } from '@/data'
import { revealFade, revealRise, revealViewport } from '@/lib/reveal'

function App() {
  const reducedMotion = useReducedMotion()

  return (
    <div id="top" className="relative min-h-svh overflow-x-clip bg-background text-foreground">
      <div className="mx-auto w-full max-w-3xl px-6 sm:px-8">
        {/* Lets the footer glide along when the projects change height. */}
        <LayoutGroup>
          <main className="flex flex-col gap-14 pb-12 sm:gap-16 sm:pb-16">
            <ProfileSection />
            <motion.section
              id="github-activity"
              aria-labelledby="activity-heading"
              variants={reducedMotion ? revealFade : revealRise}
              initial="hidden"
              whileInView="shown"
              viewport={revealViewport}
            >
              <GitHubCalendar
                heading={<h2 id="activity-heading" className="font-heading text-3xl leading-[1.05] tracking-[-0.01em] sm:text-4xl">Activity</h2>}
                username={portfolioOwner.githubUsername}
                fromYear={2026}
                color="var(--portfolio-blue)"
                showYearPicker
                showProfileLink={false}
              />
            </motion.section>
            <ProjectsSection />
          </main>
          <SiteFooter />
        </LayoutGroup>
      </div>
    </div>
  )
}

export default App
