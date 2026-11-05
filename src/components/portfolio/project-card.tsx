import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FiArrowUpRight } from 'react-icons/fi'
import type { PortfolioProject } from '@/data'

export type ProjectView = 'grid' | 'list'

type ProjectCardProps = {
  project: PortfolioProject
  view: ProjectView
}

export function ProjectCard({ project, view }: ProjectCardProps) {
  const isList = view === 'list'

  return (
    <Card
      className={isList ? 'flex-row items-stretch rounded-none bg-transparent py-4 ring-0' : 'h-full'}
      style={{ viewTransitionName: `project-${project.name.toLowerCase()}` }}
    >
      {isList && (
        <div className="flex w-32 shrink-0 items-center p-3 sm:w-40">
          <Avatar className="size-24 rounded-lg after:rounded-lg sm:size-32">
            <AvatarFallback className="rounded-lg bg-muted font-mono text-2xl font-medium tracking-tight text-muted-foreground">
              {project.mark}
            </AvatarFallback>
          </Avatar>
        </div>
      )}
      <div className={isList ? 'min-w-0 flex-1' : 'flex flex-1 flex-col'}>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              {!isList && (
                <Avatar size="lg" className="rounded-lg after:rounded-lg">
                  <AvatarFallback className="rounded-lg bg-muted font-mono text-xs font-medium tracking-tight text-muted-foreground">
                    {project.mark}
                  </AvatarFallback>
                </Avatar>
              )}
              <CardTitle className="font-sans text-lg leading-snug font-medium tracking-[-0.015em]">{project.name}</CardTitle>
            </div>
            <a
              className="animated-arrow-link inline-flex shrink-0 items-center gap-1 type-label text-muted-foreground"
              href={project.href}
              target="_blank"
              rel="noreferrer"
            >
              <span className="animated-arrow-link-label relative">GitHub</span>
              <FiArrowUpRight aria-hidden="true" className="animated-arrow-link-icon size-3" />
            </a>
          </div>
          <p className="leading-6 text-pretty text-muted-foreground">
            {project.description}
          </p>
        </CardHeader>
        <CardContent className={isList ? 'space-y-4' : 'flex flex-1 flex-col'}>
          <ul aria-label={`${project.name} technologies`} className="flex flex-wrap gap-1.5 pt-4">
            {project.stack.map((item) => (
              <li key={item} className="rounded-[5px] bg-muted px-1.5 py-0.5 type-label text-muted-foreground">{item}</li>
            ))}
          </ul>
        </CardContent>
      </div>
    </Card>
  )
}
