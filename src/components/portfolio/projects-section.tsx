import { useState, useSyncExternalStore } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { FiArrowUpRight, FiGrid, FiList } from 'react-icons/fi'

import { Tooltip } from '@/components/tooltip'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ProjectCard, type ProjectView } from '@/components/portfolio/project-card'
import { portfolioOwner, projects } from '@/data'
import { EASE_OUT } from '@/lib/ease'

const desktopProjectsQuery = '(min-width: 768px)'

function subscribeToDesktopProjects(onChange: () => void) {
  const mediaQuery = window.matchMedia(desktopProjectsQuery)
  mediaQuery.addEventListener('change', onChange)
  return () => mediaQuery.removeEventListener('change', onChange)
}

function isDesktopProjectsWidth() {
  return window.matchMedia(desktopProjectsQuery).matches
}

export function ProjectsSection() {
  const reducedMotion = useReducedMotion()
  const desktopProjects = useSyncExternalStore(subscribeToDesktopProjects, isDesktopProjectsWidth, () => false)
  const [projectView, setProjectView] = useState<ProjectView>('grid')
  const [hasSwitchedView, setHasSwitchedView] = useState(false)
  const visibleProjectView: ProjectView = desktopProjects ? projectView : 'grid'

  function changeProjectView(nextView: string) {
    if (nextView !== 'grid' && nextView !== 'list') return
    if (nextView === projectView) return

    setHasSwitchedView(true)
    setProjectView(nextView)
  }

  return (
    <motion.section
      id="projects"
      aria-labelledby="projects-heading"
      initial={reducedMotion ? false : { opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={reducedMotion ? { duration: 0 } : { duration: 0.4, ease: EASE_OUT }}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <h2 id="projects-heading" className="font-heading text-3xl leading-[1.05] tracking-[-0.01em] sm:text-4xl">Projects</h2>
        <div className="flex flex-wrap items-center gap-3 sm:gap-6">
          <a
            className="animated-arrow-link inline-flex items-center gap-1 type-label text-muted-foreground"
            href={portfolioOwner.githubRepositoriesUrl}
            target="_blank"
            rel="noreferrer"
          >
            <span className="animated-arrow-link-label relative">All repositories</span>
            <FiArrowUpRight aria-hidden="true" className="animated-arrow-link-icon size-3" />
          </a>
          {desktopProjects ? (
            <ToggleGroup
              aria-label="Project view"
              value={[projectView]}
              onValueChange={(values) => changeProjectView(values[0])}
              variant="outline"
              size="sm"
            >
              <Tooltip content="Grid view">
                <ToggleGroupItem value="grid" aria-label="Grid view">
                  <FiGrid aria-hidden="true" />
                </ToggleGroupItem>
              </Tooltip>
              <Tooltip content="List view">
                <ToggleGroupItem value="list" aria-label="List view">
                  <FiList aria-hidden="true" />
                </ToggleGroupItem>
              </Tooltip>
            </ToggleGroup>
          ) : null}
        </div>
      </div>
      <div className={visibleProjectView === 'grid' ? 'grid gap-5 md:grid-cols-2' : 'flex flex-col divide-y divide-border'}>
        {projects.map((project) => (
          <ProjectCard key={project.name} project={project} view={visibleProjectView} animateSwap={hasSwitchedView} />
        ))}
      </div>
    </motion.section>
  )
}
