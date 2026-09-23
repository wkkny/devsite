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
            <AvatarFallback className="rounded-lg bg-muted text-xl font-medium text-muted-foreground">
              {project.mark}
            </AvatarFallback>
          </Avatar>
        </div>
      )}
      <div className={isList ? 'min-w-0 flex-1' : undefined}>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              {!isList && (
                <Avatar size="lg" className="rounded-lg after:rounded-lg">
                  <AvatarFallback className="rounded-lg bg-muted text-xs font-medium text-muted-foreground">
                    {project.mark}
                  </AvatarFallback>
                </Avatar>
              )}
              <CardTitle>{project.name}</CardTitle>
            </div>
            <a
              className="inline-flex shrink-0 items-center gap-2 text-sm font-medium transition-colors hover:text-muted-foreground"
              href={project.href}
              target="_blank"
              rel="noreferrer"
            >
              GitHub <FiArrowUpRight aria-hidden="true" />
            </a>
          </div>
          <p className={`${isList ? '' : 'min-h-20 '}leading-6 text-muted-foreground`}>
            {project.description}
          </p>
        </CardHeader>
        <CardContent className={isList ? 'space-y-4' : 'flex flex-1 flex-col'}>
          <ul aria-label={`${project.name} technologies`} className="flex flex-wrap gap-x-3 gap-y-1">
            {project.stack.map((item) => (
              <li key={item} className="text-xs text-muted-foreground/70">{item}</li>
            ))}
          </ul>
        </CardContent>
      </div>
    </Card>
  )
}
