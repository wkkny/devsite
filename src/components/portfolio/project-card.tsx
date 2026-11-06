import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FiArrowUpRight } from 'react-icons/fi'
import type { PortfolioProject } from '@/data'
import { EASE_OUT, LAYOUT_SWAP } from '@/lib/ease'

export type ProjectView = 'grid' | 'list'

type ProjectCardProps = {
  project: PortfolioProject
  view: ProjectView
  /** Fade the rewrapped text in after a view switch. Off for the first render. */
  animateSwap: boolean
}

const MotionCard = motion.create(Card)

export function ProjectCard({ project, view, animateSwap }: ProjectCardProps) {
  const reducedMotion = useReducedMotion()
  const isList = view === 'list'
  const layoutTransition = reducedMotion ? { duration: 0 } : LAYOUT_SWAP

  // The card, mark, title and link keep their shape between views, so they glide to their new places.
  // The description and tags rewrap, so the old copy fades out at once and the new copy fades in at
  // its new width while the card is still gliding: the card is never empty.
  const swapIn = animateSwap
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0, transition: { duration: 0.1, ease: EASE_OUT } },
        transition: reducedMotion ? { duration: 0.2, ease: EASE_OUT } : { duration: 0.24, ease: EASE_OUT, delay: 0.1 },
      }
    : { initial: false as const }

  return (
    <MotionCard
      layout
      initial={false}
      animate={{ borderRadius: isList ? 0 : 12 }}
      transition={{ layout: layoutTransition, borderRadius: layoutTransition }}
      className={
        isList
          ? 'arrow-host gap-3 overflow-visible bg-transparent py-4 ring-0 transition-[background-color,box-shadow] duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]'
          : // The card answers the cursor: a second ring layered on the first firms the edge as a soft shadow lifts it,
            // both in one box-shadow so they ease together, and its GitHub arrow slides out.
            // The frame's fill and ring dissolve over the same 400ms as the glide when the view changes.
            'arrow-host h-full transition-[background-color,box-shadow] duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] hover:duration-200 pointer-fine:hover:shadow-[0_0_0_1px_color-mix(in_srgb,var(--foreground)_10%,transparent),0_10px_30px_-14px_color-mix(in_srgb,var(--foreground)_28%,transparent)]'
      }
    >
      <CardHeader className={isList ? 'gap-1.5 px-0' : 'gap-3'}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {/* The list view drops the mark to stay compact; it fades back in with the grid. */}
            {!isList && (
              <motion.div layout="position" transition={{ layout: layoutTransition }}>
                <motion.div {...swapIn}>
                  <Avatar size="lg" className="rounded-lg after:rounded-lg">
                    <AvatarFallback className="rounded-lg bg-muted font-mono text-xs font-medium tracking-tight text-muted-foreground">
                      {project.mark}
                    </AvatarFallback>
                  </Avatar>
                </motion.div>
              </motion.div>
            )}
            <motion.div layout="position" transition={{ layout: layoutTransition }}>
              <CardTitle className="font-sans text-lg leading-snug font-medium tracking-[-0.015em]">{project.name}</CardTitle>
            </motion.div>
          </div>
          <motion.a
            layout="position"
            transition={{ layout: layoutTransition }}
            className="animated-arrow-link inline-flex shrink-0 items-center gap-1 type-label text-muted-foreground"
            href={project.href}
            target="_blank"
            rel="noreferrer"
          >
            <span className="animated-arrow-link-label relative">GitHub</span>
            <FiArrowUpRight aria-hidden="true" className="animated-arrow-link-icon size-3" />
          </motion.a>
        </div>
        <motion.div layout="position" transition={{ layout: layoutTransition }} className="relative">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.p key={view} {...swapIn} className="leading-6 text-pretty text-muted-foreground">
              {project.description}
            </motion.p>
          </AnimatePresence>
        </motion.div>
      </CardHeader>
      <CardContent className={isList ? 'px-0' : 'flex flex-1 flex-col'}>
        <motion.div layout="position" transition={{ layout: layoutTransition }} className="relative">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.ul
              key={view}
              {...swapIn}
              aria-label={`${project.name} technologies`}
              className={isList ? 'flex flex-wrap gap-1.5' : 'flex flex-wrap gap-1.5 pt-4'}
            >
              {project.stack.map((item) => (
                <li key={item} className="rounded-[5px] bg-muted px-1.5 py-0.5 type-label text-muted-foreground">{item}</li>
              ))}
            </motion.ul>
          </AnimatePresence>
        </motion.div>
      </CardContent>
    </MotionCard>
  )
}
