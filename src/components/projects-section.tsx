import { IconArrowUpRight, IconBrandGithub } from '@tabler/icons-react'

import { portfolio, type PortfolioProject } from '@/config/portfolio'

function ProjectRow({ project }: { project: PortfolioProject }) {
  const { website, repository } = project.destinations
  const resolvedWebsite = website === '#' ? undefined : website
  const href = resolvedWebsite ?? repository
  const destination = resolvedWebsite ? 'website' : repository ? 'repository' : null
  const content = (
    <>
      <span className="min-w-0 flex-1 truncate">
        <span className="border-b border-transparent font-mono text-xs text-foreground transition-colors group-hover:border-foreground sm:text-sm">
          {project.name}
        </span>
        <span className="ml-2 hidden font-mono text-xs text-muted-foreground sm:inline sm:text-sm">
          {project.description}
        </span>
      </span>
      <span className="hidden shrink-0 font-mono text-xs text-muted-foreground md:flex md:gap-2 md:text-sm">
        {project.stack.map((tech) => (
          <span key={tech} className="rounded border border-line bg-muted/40 px-1.5 py-0.5 text-[10px] sm:text-xs">
            {tech}
          </span>
        ))}
      </span>
      <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
        {destination === 'repository' && (
          <IconBrandGithub className="size-4 transition-colors group-hover:text-foreground" aria-hidden="true" />
        )}
        {destination === 'website' && (
          <IconArrowUpRight
            className="size-4 opacity-0 transition-opacity group-hover:opacity-100"
            aria-hidden="true"
          />
        )}
      </span>
    </>
  )

  const rowClassName = 'group flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/40 sm:px-3'

  return (
    <li className="border-b border-line last:border-b-0">
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className={rowClassName}>
          {content}
        </a>
      ) : (
        <div className={rowClassName}>{content}</div>
      )}
    </li>
  )
}

export default function ProjectsSection({ className }: { className?: string }) {
  return (
    <section className={className} aria-label="Projects">
      <h2 className="px-2 pb-2 font-mono text-xs text-muted-foreground sm:px-3 sm:text-sm">
        $ ls ~/projects
      </h2>
      <ul className="border-y border-line">
        {portfolio.projects.map((project) => (
          <ProjectRow key={project.name} project={project} />
        ))}
      </ul>
    </section>
  )
}
