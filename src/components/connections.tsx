import { IconArrowUpRight, IconBrandGithub, IconBrandX } from '@tabler/icons-react'

import { portfolio } from '@/config/portfolio'

type Connection = {
  title: string
  subtitle: string
  href: string
  icon: typeof IconBrandGithub
}

// Discord-style connections list for the socials.
function Connections() {
  const connections: Connection[] = [
    {
      title: portfolio.links.twitter.label,
      subtitle: `@${portfolio.links.twitter.username}`,
      href: portfolio.links.twitter.href,
      icon: IconBrandX,
    },
    {
      title: portfolio.links.github.label,
      subtitle: `@${portfolio.links.github.username}`,
      href: portfolio.links.github.href,
      icon: IconBrandGithub,
    },
  ]

  return (
    <section aria-label="Connections" className="px-2">
      <h2 className="px-2 pb-2 font-mono text-xs uppercase tracking-wide text-muted-foreground">
        Connections
      </h2>
      <div className="divide-y divide-line/60 overflow-hidden rounded-2xl border border-line bg-card/40">
        {connections.map((connection) => {
          const Icon = connection.icon

          return (
            <a
              key={connection.title}
              href={connection.href}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 p-4 transition-colors hover:bg-muted/30"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-muted/40 text-muted-foreground">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {connection.title}
                </span>
                <span className="block truncate font-mono text-xs text-muted-foreground">
                  {connection.subtitle}
                </span>
              </span>
              <IconArrowUpRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </a>
          )
        })}
      </div>
    </section>
  )
}

export { Connections }
