import { useState, useSyncExternalStore } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { FiArrowUpRight, FiGrid, FiList } from 'react-icons/fi'

import { MaskReveal } from '@/components/mask-reveal'
import { Tooltip, TooltipGroup } from '@/components/tooltip'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ProjectCard, type ProjectView } from '@/components/portfolio/project-card'
import { portfolioOwner, projects } from '@/data'
import { LAYOUT_SWAP } from '@/lib/ease'
import { revealFade, revealItem, revealRise, revealStagger, revealViewport } from '@/lib/reveal'

const desktopProjectsQuery = '(min-width: 768px)'

function subscribeToDesktopProjects(onChange: () => void) {
  const mediaQuery = window.matchMedia(desktopProjectsQuery)
  mediaQuery.addEventListener('change', onChange)
  return () => mediaQuery.removeEventListener('change', onChange)
}

function isDesktopProjectsWidth() {
  return window.matchMedia(desktopProjectsQuery).matches
}

// The pressed fill is drawn by ViewPill instead, so it can slide between the two buttons.
const VIEW_ITEM = 'relative isolate aria-pressed:bg-transparent data-[pressed]:bg-transparent'

// Slides to the chosen view on the same timing as the cards morphing below it.
function ViewPill({ reducedMotion }: { reducedMotion: boolean | null }) {
  return (
    <motion.span
      layoutId="project-view-pill"
      aria-hidden="true"
      className="absolute inset-0 -z-10 rounded-[inherit] bg-muted"
      transition={reducedMotion ? { duration: 0 } : LAYOUT_SWAP}
    />
  )
}

export function ProjectsSection() {
  const reducedMotion = useReducedMotion()
  const desktopProjects = useSyncExternalStore(subscribeToDesktopProjects, isDesktopProjectsWidth, () => false)
  const [projectView, setProjectView] = useState<ProjectView>('grid')
  const [hasSwitchedView, setHasSwitchedView] = useState(false)
  // The list row under the pointer, which holds the shared hover highlight.
  const [highlightedProject, setHighlightedProject] = useState<string | null>(null)
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
      initial="hidden"
      whileInView="shown"
      viewport={{ ...revealViewport, amount: 0.15 }}
    >
      <motion.div variants={reducedMotion ? revealFade : revealRise} className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <h2 id="projects-heading" className="font-heading text-3xl leading-[1.05] tracking-[-0.01em] sm:text-4xl"><MaskReveal>Projects</MaskReveal></h2>
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
            <TooltipGroup side="top">
              {/* One label slides between the two buttons, like every other row of controls. */}
              <ToggleGroup
                aria-label="Project view"
                value={[projectView]}
                onValueChange={(values) => changeProjectView(values[0])}
                variant="outline"
                size="sm"
              >
                <Tooltip content="Grid view">
                  <ToggleGroupItem value="grid" aria-label="Grid view" className={VIEW_ITEM}>
                    {projectView === 'grid' && <ViewPill reducedMotion={reducedMotion} />}
                    <FiGrid aria-hidden="true" />
                  </ToggleGroupItem>
                </Tooltip>
                <Tooltip content="List view">
                  <ToggleGroupItem value="list" aria-label="List view" className={VIEW_ITEM}>
                    {projectView === 'list' && <ViewPill reducedMotion={reducedMotion} />}
                    <FiList aria-hidden="true" />
                  </ToggleGroupItem>
                </Tooltip>
              </ToggleGroup>
            </TooltipGroup>
          ) : null}
        </div>
      </motion.div>
      {/* Cards rise in one after another the first time the section is seen. In the list each row
          carries its own top rule, so the dividers travel with the rows. */}
      <motion.div
        variants={reducedMotion ? revealFade : revealStagger}
        data-view={visibleProjectView}
        onPointerLeave={() => setHighlightedProject(null)}
        className={visibleProjectView === 'grid' ? 'grid gap-5 md:grid-cols-2' : 'isolate flex flex-col [&>*+*>[data-slot=card]]:border-t [&>*+*>[data-slot=card]]:border-border'}
      >
        {projects.map((project) => (
          <motion.div key={project.name} variants={reducedMotion ? undefined : revealItem} className={visibleProjectView === 'grid' ? 'h-full' : undefined}>
            <ProjectCard
              project={project}
              view={visibleProjectView}
              animateSwap={hasSwitchedView}
              highlighted={highlightedProject === project.name}
              onHighlight={() => setHighlightedProject(project.name)}
            />
          </motion.div>
        ))}
      </motion.div>
    </motion.section>
  )
}
