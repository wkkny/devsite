import type { PointerEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FiArrowUpRight } from 'react-icons/fi'
import type { PortfolioProject } from '@/data'
import { EASE_OUT, LAYOUT_SWAP } from '@/lib/ease'
import { cn } from '@/lib/utils'

export type ProjectView = 'grid' | 'list'

type ProjectCardProps = {
  project: PortfolioProject
  view: ProjectView
  /** Fade the rewrapped text in after a view switch. Off for the first render. */
  animateSwap: boolean
  /** List view: draw a rule above this row. */
  divided?: boolean
  /** List view: this row holds the shared hover highlight. */
  highlighted?: boolean
  /** List view: the pointer moved onto this row. */
  onHighlight?: () => void
}

const MotionCard = motion.create(Card)

const CARD_SPRING = { type: 'spring', stiffness: 520, damping: 34, mass: 0.6 } as const

export function ProjectCard({ project, view, animateSwap, divided = false, highlighted = false, onHighlight }: ProjectCardProps) {
  const reducedMotion = useReducedMotion()
  const isList = view === 'list'
  const layoutTransition = reducedMotion ? { duration: 0 } : LAYOUT_SWAP

  // The card, mark, title and link keep their shape between views, so they glide to their new places.
  // The description and tags rewrap, so the old copy fades out at once and the new copy fades in at
  // its new width while the card is still gliding, overlapping the old so the card is never empty.
  const swapIn = animateSwap
    ? {
        initial: reducedMotion ? { opacity: 0 } : { opacity: 0, y: 3 },
        animate: reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 },
        exit: { opacity: 0, transition: { duration: 0.07, ease: EASE_OUT } },
        transition: reducedMotion ? { duration: 0.2, ease: EASE_OUT } : { duration: 0.22, ease: EASE_OUT, delay: 0.045 },
      }
    : { initial: false as const }

  // A whole-card link gets a whole-card response: a 2px lift on hover and a slight dip on press,
  // on a stiff spring so it answers at once. Grid only; list rows stay flat.
  const lift = !isList && !reducedMotion
    ? { whileHover: { y: -2 }, whileTap: { scale: 0.985 }, transition: { layout: layoutTransition, borderRadius: layoutTransition, default: CARD_SPRING } }
    : { transition: { layout: layoutTransition, borderRadius: layoutTransition } }

  return (
    <MotionCard
      layout
      initial={false}
      animate={{ borderRadius: isList ? 0 : 12 }}
      {...lift}
      onPointerEnter={isList ? (event: PointerEvent) => event.pointerType === 'mouse' && onHighlight?.() : undefined}
      onPointerMove={
        isList
          ? undefined
          : (event: PointerEvent<HTMLDivElement>) => {
              const rect = event.currentTarget.getBoundingClientRect()
              event.currentTarget.style.setProperty('--mx', `${event.clientX - rect.left}px`)
              event.currentTarget.style.setProperty('--my', `${event.clientY - rect.top}px`)
            }
      }
      className={
        // The whole card is the link (see the title), so it takes the keyboard focus ring.
        isList
          ? // The row rule is always there but transparent; it takes its color 250ms in, once the rows
            // have nearly landed, so no line rides on a card that is still moving.
            cn(
              'relative gap-3 overflow-visible border-t border-transparent bg-transparent py-4 ring-0 transition-[background-color,box-shadow,border-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]',
              'has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring has-[a:focus-visible]:ring-offset-4 has-[a:focus-visible]:ring-offset-background',
              divided && 'border-t-border [transition-delay:0ms,0ms,250ms]',
            )
          : // The card answers the cursor: a second ring layered on the first firms the edge as a soft shadow lifts it,
            // both in one box-shadow so they ease together. The frame's fill and ring dissolve in 200ms when the
            // view changes, well inside the 400ms glide, so no ghost edge trails the moving card.
            'relative h-full border-t border-transparent transition-[background-color,box-shadow,border-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] pointer-fine:hover:shadow-[0_0_0_1px_color-mix(in_srgb,var(--foreground)_10%,transparent),0_10px_30px_-14px_color-mix(in_srgb,var(--foreground)_28%,transparent)] has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring'
      }
    >
      {/* List rows share one soft highlight that glides from row to row, like the tooltips do. It sits
          behind every row (the list is its stacking context), so it never covers a neighbour mid-glide. */}
      <AnimatePresence>
        {isList && highlighted && (
          <motion.span
            // Reduced motion keeps the highlight but drops its travel between rows.
            layoutId={reducedMotion ? undefined : 'project-row-highlight'}
            aria-hidden="true"
            className="pointer-events-none absolute -inset-x-3 inset-y-1 -z-10 rounded-lg bg-muted/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 40, mass: 0.6, opacity: { duration: 0.15 } }}
          />
        )}
      </AnimatePresence>
      {/* Grid cards: a patch of the banner's dither prints in under the cursor and follows it, so the
          card answers like a small piece of the banner. */}
      {!isList && <span aria-hidden="true" className="project-dither pointer-events-none absolute inset-0" />}
      <CardHeader className={isList ? 'gap-1.5 px-0' : 'gap-3'}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {/* The list view drops the mark to stay compact: it shrinks away as the title slides into its
                place, and grows back with the grid. */}
            <AnimatePresence initial={false} mode="popLayout">
              {!isList && (
                <motion.div
                  key="mark"
                  layout="position"
                  transition={{ layout: layoutTransition, duration: 0.2, ease: EASE_OUT }}
                  initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
                  animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                  exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
                >
                  <Avatar size="lg" className="rounded-lg after:rounded-lg">
                    <AvatarFallback className="rounded-lg bg-muted font-mono text-xs font-medium tracking-tight text-muted-foreground">
                      {project.mark}
                    </AvatarFallback>
                  </Avatar>
                </motion.div>
              )}
            </AnimatePresence>
            <motion.div layout="position" transition={{ layout: layoutTransition }}>
              <CardTitle className="font-sans text-lg leading-snug font-medium tracking-[-0.015em]">
                {/* The title is the card's one link; its ::after stretches over the whole card, so anywhere
                    on it opens the repo. Hovering draws the title's underline and slides the arrow out. */}
                <a
                  className="project-link inline-flex items-center gap-1.5 outline-none after:absolute after:inset-0 after:z-10 after:rounded-[inherit] after:content-['']"
                  href={project.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="project-link-label">{project.name}</span>
                  <span className="sr-only"> on GitHub</span>
                  <FiArrowUpRight aria-hidden="true" className="project-link-icon size-4 text-muted-foreground" />
                </a>
              </CardTitle>
            </motion.div>
          </div>
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
        {/* The tags keep their identity across views: each pill slides to its new place in the reflow,
            all together, so none trails behind the card. */}
        <motion.ul
          aria-label={`${project.name} technologies`}
          className={isList ? 'flex flex-wrap gap-1.5' : 'flex flex-wrap gap-1.5 pt-4'}
        >
          {project.stack.map((item) => (
            <motion.li
              key={item}
              layout="position"
              transition={{ layout: layoutTransition }}
              className="rounded-[5px] bg-muted px-1.5 py-0.5 type-label text-muted-foreground"
            >
              {item}
            </motion.li>
          ))}
        </motion.ul>
      </CardContent>
    </MotionCard>
  )
}
