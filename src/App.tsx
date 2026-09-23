import { useState } from 'react'
import { FiArrowUpRight } from 'react-icons/fi'

import { DraggableDecorations } from '@/components/draggable-decorations'
import { GitHubActivity } from '@/components/github-activity'
import { ThemeDotCursor } from '@/components/theme-dot-cursor'
import { ProfileSection } from '@/components/portfolio/profile-section'
import { ProjectsSection } from '@/components/portfolio/projects-section'
import { SiteFooter } from '@/components/portfolio/site-footer'
import { portfolioOwner } from '@/data'

function App() {
  const [bannerAnimationComplete, setBannerAnimationComplete] = useState(false)

  return (
    <div id="top" className="relative min-h-svh overflow-x-clip bg-background text-foreground">
      <ThemeDotCursor />
      <DraggableDecorations entryReady={bannerAnimationComplete} />
      <div className="mx-auto w-full max-w-3xl px-6 sm:px-8">
        <main className="flex flex-col gap-14 pb-12 sm:gap-16 sm:pb-16">
          <ProfileSection onBannerAnimationComplete={() => setBannerAnimationComplete(true)} />
          <section id="github-activity" aria-label="GitHub contributions" className="-mt-6 sm:-mt-8">
            <a
              className="animated-arrow-link mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground"
              href={portfolioOwner.githubUrl}
              target="_blank"
              rel="noreferrer"
            >
              <span className="animated-arrow-link-label relative">{portfolioOwner.githubUsername}</span>
              <FiArrowUpRight aria-hidden="true" className="animated-arrow-link-icon size-3.5" />
            </a>
            <GitHubActivity />
          </section>
          <ProjectsSection />
        </main>
        <SiteFooter />
      </div>
    </div>
  )
}

export default App
